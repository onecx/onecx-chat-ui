import { TestBed } from '@angular/core/testing'
import { AuthProxyService } from '@onecx/angular-auth'
import { AiContextGatherer, AiContextResponse } from '@onecx/integration-interface'
import { Observable } from 'rxjs'

import { CAPTURE_PROCESSOR_NAME, encodeBase64 } from './voice-audio'
import { VoiceConfigService } from './voice-config.service'
import {
  noPageContext,
  sessionEndMessageKey,
  startErrorMessageKey,
  voiceCaptureSupported,
  VoiceService,
  VoiceStartError
} from './voice.service'

class FakeWebSocket {
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  readyState = 0
  readonly sent: Record<string, unknown>[] = []
  onopen: (() => void) | null = null
  onmessage: ((message: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  readonly close = jest.fn(() => {
    this.readyState = FakeWebSocket.CLOSED
  })

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }

  types(): unknown[] {
    return this.sent.map((message) => message['type'])
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  receive(event: object): void {
    this.onmessage?.({ data: JSON.stringify(event) })
  }

  serverClose(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
}

interface FakeNode {
  connect: jest.Mock
  disconnect: jest.Mock
}

interface FakeBufferSource extends FakeNode {
  buffer: { duration: number; channels: Float32Array[] } | null
  onended: (() => void) | null
  start: jest.Mock
  stop: jest.Mock
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []

  currentTime = 0
  readonly destination = {}
  readonly audioWorklet = { addModule: jest.fn().mockResolvedValue(undefined) }
  readonly resume = jest.fn().mockResolvedValue(undefined)
  readonly close = jest.fn().mockResolvedValue(undefined)
  readonly streamSources: (FakeNode & { stream: MediaStream })[] = []
  readonly bufferSources: FakeBufferSource[] = []

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createMediaStreamSource(stream: MediaStream): FakeNode {
    const source = { stream, connect: jest.fn(), disconnect: jest.fn() }
    this.streamSources.push(source)
    return source
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
    return { duration: length / sampleRate, channels, getChannelData: (channel: number) => channels[channel] }
  }

  createBufferSource(): FakeBufferSource {
    const source = {
      buffer: null,
      onended: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn()
    }
    this.bufferSources.push(source)
    return source
  }
}

class FakeAudioWorkletNode {
  static instances: FakeAudioWorkletNode[] = []

  readonly port: { onmessage: ((event: { data: ArrayBuffer }) => void) | null } = { onmessage: null }
  readonly connect = jest.fn()
  readonly disconnect = jest.fn()

  constructor(
    readonly context: FakeAudioContext,
    readonly name: string,
    readonly options: AudioWorkletNodeOptions
  ) {
    FakeAudioWorkletNode.instances.push(this)
  }
}

interface FakeTrack {
  enabled: boolean
  stop: jest.Mock
  getSettings: () => MediaTrackSettings
  onended?: () => void
}

function createDeviceStream(deviceId = 'default'): { stream: MediaStream; track: FakeTrack; stop: jest.Mock } {
  const track: FakeTrack = { enabled: true, stop: jest.fn(), getSettings: () => ({ deviceId }) }
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track, stop: track.stop }
}

function collect<T>(source: Observable<T>): T[] {
  const values: T[] = []
  source.subscribe((value) => values.push(value))
  return values
}

const READY = { kind: 'session_ready', session_id: 's-1', agent_id: 'agent-1', schema_version: 1, protocol_version: 2 }

describe('VoiceService', () => {
  const originalWebSocket = globalThis.WebSocket
  let service: VoiceService
  let tokens: { principal: string }
  let authProxy: { getHeaderValues: jest.Mock; updateTokenIfNeeded: jest.Mock }
  let mic: ReturnType<typeof createDeviceStream>

  const defineMediaDevices = (impl: Partial<MediaDevices>): void => {
    Object.defineProperty(navigator, 'mediaDevices', { value: impl, configurable: true })
  }
  const createService = (): VoiceService => TestBed.runInInjectionContext(() => new VoiceService())
  const settle = (): Promise<void> => jest.advanceTimersByTimeAsync(0)
  const lastSocket = (): FakeWebSocket => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
  const lastContext = (): FakeAudioContext => FakeAudioContext.instances[FakeAudioContext.instances.length - 1]
  const lastNode = (): FakeAudioWorkletNode => FakeAudioWorkletNode.instances[FakeAudioWorkletNode.instances.length - 1]

  /** Starts a voice chat; the returned promise is marked as handled, so a test may leave it pending. */
  const begin = (chatId = 'chat-1', agentId = 'agent-1'): Promise<void> => {
    const started = service.start(chatId, agentId)
    started.catch(() => undefined)
    return started
  }

  /** Runs the whole start handshake and returns the connected socket. */
  const startSession = async (): Promise<FakeWebSocket> => {
    const started = begin()
    await settle()
    const socket = lastSocket()
    socket.open()
    socket.receive(READY)
    await started
    return socket
  }

  beforeEach(() => {
    jest.useFakeTimers()
    FakeWebSocket.instances = []
    FakeAudioContext.instances = []
    FakeAudioWorkletNode.instances = []
    Object.assign(globalThis, {
      WebSocket: FakeWebSocket,
      AudioContext: FakeAudioContext,
      AudioWorkletNode: FakeAudioWorkletNode
    })
    URL.createObjectURL = jest.fn(() => 'blob:capture')
    URL.revokeObjectURL = jest.fn()
    mic = createDeviceStream()
    defineMediaDevices({ getUserMedia: jest.fn().mockResolvedValue(mic.stream) })

    tokens = { principal: 'principal-1' }
    authProxy = {
      getHeaderValues: jest.fn(() => ({ 'apm-principal-token': tokens.principal, Authorization: 'Bearer access' })),
      updateTokenIfNeeded: jest.fn().mockResolvedValue(true)
    }
    TestBed.configureTestingModule({ providers: [VoiceService, { provide: AuthProxyService, useValue: authProxy }] })
    service = TestBed.inject(VoiceService)
  })

  afterEach(() => {
    service.cleanup()
    globalThis.WebSocket = originalWebSocket
    delete (globalThis as Record<string, unknown>)['AudioContext']
    delete (globalThis as Record<string, unknown>)['AudioWorkletNode']
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('should start disconnected and unmuted', () => {
    expect(service.isConnecting()).toBe(false)
    expect(service.isConnected()).toBe(false)
    expect(service.isMuted()).toBe(false)
    expect(service.micStream()).toBeUndefined()
  })

  describe('start', () => {
    it('should prepare microphone and playback synchronously before a chat is available', async () => {
      const getUserMedia = jest.fn().mockResolvedValue(mic.stream)
      defineMediaDevices({ getUserMedia })

      const prepared = service.prepareStart()

      expect(FakeAudioContext.instances).toHaveLength(1)
      expect(lastContext().resume).toHaveBeenCalled()
      expect(getUserMedia).toHaveBeenCalledWith({ audio: true })

      await settle()
      await prepared

      expect(FakeWebSocket.instances).toHaveLength(0)
      expect(service.isConnecting()).toBe(true)
      expect(service.isConnected()).toBe(false)
      expect(service.micStream()).toBe(mic.stream)
    })

    it('should start a prepared session against the persisted chat id', async () => {
      await service.prepareStart()
      const started = service.startPrepared('created-chat', 'agent-1')
      await settle()

      const socket = lastSocket()
      socket.open()
      expect(socket.sent[0]).toEqual({
        type: 'start_session',
        chat_id: 'created-chat',
        agent_id: 'agent-1',
        ai_context: [],
        apm_principal_token: 'principal-1',
        authorization: 'Bearer access'
      })
      socket.receive(READY)
      await started

      expect(service.isConnecting()).toBe(false)
      expect(service.isConnected()).toBe(true)
      expect(service.micStream()).toBe(mic.stream)
    })

    it('should reject a second audio preparation while one is pending', async () => {
      await service.prepareStart()

      await expect(service.prepareStart()).rejects.toThrow('start already in progress')

      expect(FakeAudioContext.instances).toHaveLength(1)
    })

    it('should reject a prepared-session start without prepared audio', async () => {
      await expect(service.startPrepared('chat-1', 'agent-1')).rejects.toThrow('audio has not been prepared')

      expect(FakeWebSocket.instances).toHaveLength(0)
    })

    it('should release prepared audio when no agent was provided', async () => {
      await service.prepareStart()

      await expect(service.startPrepared('chat-1', '')).rejects.toThrow('no agent selected')

      expect(service.isConnecting()).toBe(false)
      expect(lastContext().close).toHaveBeenCalled()
      expect(FakeWebSocket.instances).toHaveLength(0)
    })

    it('should start a session for the chat and agent and stream the microphone into the capture worklet', async () => {
      const started = begin()
      expect(service.isConnecting()).toBe(true)
      await settle()

      const context = lastContext()
      const node = lastNode()
      expect(context.resume).toHaveBeenCalled()
      expect(context.audioWorklet.addModule).toHaveBeenCalledWith('blob:capture')
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:capture')
      expect(node.name).toBe(CAPTURE_PROCESSOR_NAME)
      expect(node.options.processorOptions).toEqual({ targetSampleRate: 16000, chunkSamples: 640 })
      expect(node.connect).toHaveBeenCalledWith(context.destination)
      expect(context.streamSources[0].stream).toBe(mic.stream)
      expect(context.streamSources[0].connect).toHaveBeenCalledWith(node)
      expect(authProxy.updateTokenIfNeeded).toHaveBeenCalled()

      const socket = lastSocket()
      expect(socket.url).toBe('ws://localhost/ws/voice')
      socket.open()
      expect(socket.sent).toEqual([
        {
          type: 'start_session',
          ai_context: [],
          chat_id: 'chat-1',
          agent_id: 'agent-1',
          apm_principal_token: 'principal-1',
          authorization: 'Bearer access'
        }
      ])
      expect(service.isConnected()).toBe(false)

      socket.receive(READY)
      await started

      expect(service.isConnecting()).toBe(false)
      expect(service.isConnected()).toBe(true)
      expect(service.micStream()).toBe(mic.stream)
    })

    it('should connect to the configured voice service URL', async () => {
      TestBed.inject(VoiceConfigService).voiceWsUrl.set('wss://voice.example.com/ws/voice')

      begin()
      await settle()

      expect(lastSocket().url).toBe('wss://voice.example.com/ws/voice')
    })

    it('should connect to /ws/voice on the current host without a configured URL', async () => {
      TestBed.inject(VoiceConfigService).voiceWsUrl.set('')

      begin()
      await settle()

      expect(lastSocket().url).toBe(`ws://${location.host}/ws/voice`)
    })

    it('should ignore a second start while a session is starting', async () => {
      begin()
      await service.start('chat-2', 'agent-1')
      await settle()

      expect(FakeWebSocket.instances).toHaveLength(1)
    })

    it('should reject without an agent', async () => {
      await expect(service.start('chat-1', '')).rejects.toThrow('no agent selected')

      expect(service.isConnecting()).toBe(false)
      expect(FakeAudioContext.instances).toHaveLength(0)
    })

    it('should reject and release the audio when the microphone is unavailable', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      defineMediaDevices({ getUserMedia: jest.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) })

      await expect(service.start('chat-1', 'agent-1')).rejects.toMatchObject({
        code: 'microphone_unavailable',
        message: 'Voice: microphone unavailable'
      })

      expect(FakeWebSocket.instances).toHaveLength(0)
      expect(lastContext().close).toHaveBeenCalled()
      expect(service.isConnecting()).toBe(false)
    })

    it('should reject and release everything when the voice service refuses the session', async () => {
      const started = begin()
      await settle()
      const socket = lastSocket()
      socket.open()

      socket.receive({ kind: 'error', code: 'voice_not_permitted', message: 'Voice is disabled' })

      await expect(started).rejects.toThrow('Voice: voice_not_permitted: Voice is disabled')
      await expect(started).rejects.toMatchObject({ code: 'voice_not_permitted' })
      expect(socket.types()).toEqual(['start_session'])
      expect(socket.close).toHaveBeenCalledWith(1000)
      expect(mic.stop).toHaveBeenCalled()
      expect(lastNode().disconnect).toHaveBeenCalled()
      expect(lastContext().close).toHaveBeenCalled()
      expect(service.isConnecting()).toBe(false)
      expect(service.isConnected()).toBe(false)
    })

    it('should reject with an unknown code when the voice service refuses the session without one', async () => {
      const started = begin()
      await settle()
      const socket = lastSocket()
      socket.open()

      socket.receive({ kind: 'error', message: 'Something failed' })

      await expect(started).rejects.toMatchObject({ code: 'unknown' })
      expect(startErrorMessageKey(await started.catch((error) => error))).toBe('VOICE.START_FAILED')
    })

    it('should reject when the connection closes before the session is ready', async () => {
      const ended = collect(service.ended$)
      const started = begin()
      await settle()

      lastSocket().serverClose()

      await expect(started).rejects.toThrow('the session closed (connection_closed)')
      await expect(started).rejects.toMatchObject({ code: 'connection_closed' })
      expect(ended).toEqual([])
    })

    it('should reject when the voice service does not answer in time', async () => {
      const started = begin()
      const rejected = expect(started).rejects.toMatchObject({
        code: 'no_response',
        message: 'Voice: the voice service did not respond'
      })

      await jest.advanceTimersByTimeAsync(20000)

      await rejected
      expect(lastSocket().close).toHaveBeenCalled()
    })

    it('should not fail when the browser refuses to resume or close the audio context', async () => {
      class RefusingAudioContext extends FakeAudioContext {
        override readonly resume = jest.fn().mockRejectedValue(new DOMException('no user gesture', 'NotAllowedError'))
        override readonly close = jest.fn().mockRejectedValue(new DOMException('closed', 'InvalidStateError'))
      }
      Object.assign(globalThis, { AudioContext: RefusingAudioContext })

      await startSession()
      expect(service.isConnected()).toBe(true)

      service.cleanup()
      await settle()

      expect(lastContext().close).toHaveBeenCalled()
      expect(service.isConnected()).toBe(false)
    })

    it('should cancel a start in progress on cleanup', async () => {
      const started = begin()
      await settle()

      service.cleanup()

      await expect(started).rejects.toThrow('start cancelled')
      await expect(started).rejects.toMatchObject({ code: 'cancelled' })
      expect(lastSocket().close).toHaveBeenCalled()
      expect(service.isConnecting()).toBe(false)
    })
  })

  describe('during a session', () => {
    it('should send microphone chunks only once the session is ready', async () => {
      const started = begin()
      await settle()
      const socket = lastSocket()
      const chunk = new Int16Array([1, -1, 256]).buffer
      socket.open()
      lastNode().port.onmessage?.({ data: chunk })
      expect(socket.types()).toEqual(['start_session'])

      socket.receive(READY)
      await started
      lastNode().port.onmessage?.({ data: chunk })

      expect(socket.sent[1]).toEqual({ type: 'audio', audio: encodeBase64(chunk) })
    })

    it('should build the user message from the transcripts of a turn', async () => {
      const socket = await startSession()
      const user = collect(service.userTranscript$)

      socket.receive({ kind: 'user_started_speaking' })
      socket.receive({ kind: 'transcript', text: 'Hello', state: 'PARTIAL' })
      socket.receive({ kind: 'transcript', text: 'Hello there.', state: 'FINAL' })
      socket.receive({ kind: 'transcript', text: ' ', state: 'PARTIAL' })
      socket.receive({ kind: 'transcript', state: 'PARTIAL' })
      socket.receive({ kind: 'transcript', text: 'How', state: 'PARTIAL' })
      socket.receive({ kind: 'transcript', text: ' How are you? ', state: 'FINAL' })
      socket.receive({ kind: 'user_stopped_speaking' })

      expect(user).toEqual([
        { text: '', isFinal: false },
        { text: 'Hello', isFinal: false },
        { text: 'Hello there.', isFinal: false },
        { text: 'Hello there. How', isFinal: false },
        { text: 'Hello there. How are you?', isFinal: false },
        { text: 'Hello there. How are you?', isFinal: true }
      ])
    })

    it('should drop a turn without words and show a late final transcript as its own message', async () => {
      const socket = await startSession()
      const user = collect(service.userTranscript$)

      socket.receive({ kind: 'user_started_speaking' })
      socket.receive({ kind: 'user_stopped_speaking' })
      socket.receive({ kind: 'transcript', text: 'Late words', state: 'FINAL' })

      expect(user).toEqual([
        { text: '', isFinal: false },
        { text: '', isFinal: false },
        { text: 'Late words', isFinal: true }
      ])
    })

    it('should forward the assistant text', async () => {
      const socket = await startSession()
      const bot = collect(service.botTranscript$)

      socket.receive({ kind: 'assistant_text', text: 'Hi, how can I help?' })
      socket.receive({ kind: 'assistant_text', text: '' })

      expect(bot).toEqual([{ text: 'Hi, how can I help?', spoken: false }])
    })

    it('should play the assistant audio back to back and drop what is left when the user interrupts', async () => {
      const socket = await startSession()
      const context = lastContext()
      context.currentTime = 2
      const audio = encodeBase64(new Int16Array([16384, -32768, 0, 8192]).buffer)
      const chunk = { kind: 'assistant_audio', audio, sample_rate: 16000, num_channels: 1 }

      socket.receive(chunk)
      socket.receive(chunk)

      const [first, second] = context.bufferSources
      expect(Array.from(first.buffer?.channels[0] ?? [])).toEqual([0.5, -1, 0, 0.25])
      expect(first.connect).toHaveBeenCalledWith(context.destination)
      expect(first.start.mock.calls[0][0]).toBeCloseTo(2.05, 6)
      expect(second.start.mock.calls[0][0]).toBeCloseTo(2.05 + 4 / 16000, 6)

      first.onended?.()
      socket.receive({ kind: 'interrupted' })

      expect(first.stop).not.toHaveBeenCalled()
      expect(second.stop).toHaveBeenCalled()
      socket.receive(chunk)
      expect(context.bufferSources[2].start.mock.calls[0][0]).toBeCloseTo(2.05, 6)
    })

    it('should split interleaved channels', async () => {
      const socket = await startSession()
      const audio = encodeBase64(new Int16Array([16384, -16384, 8192, -8192]).buffer)

      socket.receive({ kind: 'assistant_audio', audio, sample_rate: 16000, num_channels: 2 })

      const channels = lastContext().bufferSources[0].buffer?.channels.map((channel) => Array.from(channel))
      expect(channels).toEqual([
        [0.5, 0.25],
        [-0.5, -0.25]
      ])
    })

    it('should play audio without a channel count as mono and skip audio it cannot play', async () => {
      const socket = await startSession()
      const context = lastContext()
      const audio = encodeBase64(new Int16Array([16384]).buffer)

      socket.receive({ kind: 'assistant_audio', sample_rate: 16000 })
      socket.receive({ kind: 'assistant_audio', audio })
      socket.receive({ kind: 'assistant_audio', audio, sample_rate: 16000, num_channels: 2 })
      expect(context.bufferSources).toEqual([])

      socket.receive({ kind: 'assistant_audio', audio, sample_rate: 16000 })

      expect(context.bufferSources[0].buffer?.channels.map((channel) => Array.from(channel))).toEqual([[0.5]])
    })

    it('should keep the session on errors and ignore messages it does not understand', async () => {
      const socket = await startSession()
      socket.receive({ kind: 'some_future_event' })
      expect(service.isConnected()).toBe(true)
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      const user = collect(service.userTranscript$)
      const bot = collect(service.botTranscript$)

      socket.receive({ kind: 'error', code: 'principal_mismatch', message: 'Different user' })
      socket.receive({ kind: 'degraded_capability', reason: 'stt_fallback' })
      socket.receive({ kind: 'turn_complete' })
      socket.onmessage?.({ data: 'not json' })
      socket.onmessage?.({ data: '{"type":"unknown"}' })
      socket.onmessage?.({ data: new ArrayBuffer(2) })

      expect(warn).toHaveBeenCalledWith('Voice: principal_mismatch: Different user')
      expect(warn).toHaveBeenCalledWith('Voice: running with reduced capabilities:', 'stt_fallback')
      expect(user).toEqual([])
      expect(bot).toEqual([])
      expect(service.isConnected()).toBe(true)
    })

    it('should hand a refreshed token to the voice service', async () => {
      const socket = await startSession()
      const refreshes = () => socket.sent.filter((message) => message['type'] === 'refresh_token')

      await jest.advanceTimersByTimeAsync(3000)
      expect(authProxy.updateTokenIfNeeded).toHaveBeenCalledTimes(2)
      expect(refreshes()).toEqual([])

      authProxy.getHeaderValues.mockReturnValueOnce({})
      await jest.advanceTimersByTimeAsync(3000)
      expect(refreshes()).toEqual([])

      tokens.principal = 'principal-2'
      await jest.advanceTimersByTimeAsync(3000)
      await jest.advanceTimersByTimeAsync(3000)

      expect(refreshes()).toEqual([
        { type: 'refresh_token', apm_principal_token: 'principal-2', authorization: 'Bearer access' }
      ])
    })

    it('should skip a token refresh while one is running and drop one that finishes after its session', async () => {
      await startSession()
      let finishRefresh: (refreshed: boolean) => void = () => undefined
      authProxy.updateTokenIfNeeded.mockReturnValueOnce(new Promise((resolve) => (finishRefresh = resolve)))

      await jest.advanceTimersByTimeAsync(6000)
      expect(authProxy.updateTokenIfNeeded).toHaveBeenCalledTimes(2)

      service.cleanup()
      begin()
      await settle()
      const next = lastSocket()
      next.open()
      tokens.principal = 'principal-2'
      finishRefresh(true)
      await settle()

      expect(next.types()).toEqual(['start_session'])
    })

    it('should keep the session when the token cannot be refreshed', async () => {
      await startSession()
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      authProxy.updateTokenIfNeeded.mockRejectedValue(new Error('offline'))

      await jest.advanceTimersByTimeAsync(3000)

      expect(warn).toHaveBeenCalledWith('Voice: unable to refresh the user token:', expect.any(Error))
      expect(service.isConnected()).toBe(true)
    })

    it('should mute the microphone tracks', async () => {
      await startSession()

      service.toggleMute()
      expect(service.isMuted()).toBe(true)
      expect(mic.track.enabled).toBe(false)

      service.toggleMute()
      expect(mic.track.enabled).toBe(true)
    })
  })

  describe('focused view state', () => {
    it('should follow a turn through listening, processing and speaking', async () => {
      const socket = await startSession()
      const state = (): string => service.activity()
      expect(state()).toBe('listening')

      socket.receive({ kind: 'user_started_speaking' })
      socket.receive({ kind: 'transcript', text: 'What is new?', state: 'FINAL' })
      expect(state()).toBe('listening')
      socket.receive({ kind: 'user_stopped_speaking' })
      expect(state()).toBe('processing')
      socket.receive({ kind: 'assistant_text', text: 'Not much.' })
      expect(state()).toBe('processing')
      socket.receive({ kind: 'bot_started_speaking' })
      expect(state()).toBe('speaking')
      socket.receive({ kind: 'bot_stopped_speaking' })
      expect(state()).toBe('listening')
      socket.receive({ kind: 'turn_complete', entry_id: 'e-1' })
      expect(state()).toBe('listening')
    })

    it('should go back to listening after a turn without words', async () => {
      const socket = await startSession()

      socket.receive({ kind: 'user_started_speaking' })
      socket.receive({ kind: 'user_stopped_speaking' })

      expect(service.activity()).toBe('listening')
    })

    it('should process a late final transcript', async () => {
      const socket = await startSession()

      socket.receive({ kind: 'user_started_speaking' })
      socket.receive({ kind: 'user_stopped_speaking' })
      socket.receive({ kind: 'transcript', text: 'Late words', state: 'FINAL' })

      expect(service.activity()).toBe('processing')
    })

    it('should finish a text-only reply with turn_complete', async () => {
      const socket = await startSession()
      socket.receive({ kind: 'user_started_speaking' })
      socket.receive({ kind: 'transcript', text: 'Hi', state: 'FINAL' })
      socket.receive({ kind: 'user_stopped_speaking' })

      socket.receive({ kind: 'assistant_text', text: 'Hello.' })
      socket.receive({ kind: 'turn_complete', entry_id: 'e-1' })

      expect(service.activity()).toBe('listening')
    })

    it('should keep speaking until playback ends when turn_complete arrives first', async () => {
      const socket = await startSession()
      socket.receive({ kind: 'bot_started_speaking' })

      socket.receive({ kind: 'turn_complete', entry_id: 'e-1' })

      expect(service.activity()).toBe('speaking')
    })

    it('should go back to listening when the user interrupts the assistant', async () => {
      const socket = await startSession()
      socket.receive({ kind: 'bot_started_speaking' })

      socket.receive({ kind: 'interrupted' })

      expect(service.activity()).toBe('listening')
    })

    it('should reset the state when the session ends', async () => {
      const socket = await startSession()
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      socket.receive({ kind: 'bot_started_speaking' })
      socket.receive({ kind: 'error', code: 'tts_failed', message: 'Polly failed' })

      service.cleanup()

      expect(service.activity()).toBe('listening')
      expect(service.notice()).toBeUndefined()
    })
  })

  describe('interruption', () => {
    it('should report an interruption of a reply whose text was shown, once', async () => {
      const socket = await startSession()
      const interrupted = collect(service.interrupted$)

      socket.receive({ kind: 'assistant_text', text: 'Let me explain.' })
      socket.receive({ kind: 'user_started_speaking' })
      socket.receive({ kind: 'interrupted' })
      socket.receive({ kind: 'interrupted' })

      expect(interrupted).toHaveLength(1)
    })

    it('should not report an interruption before the reply showed any text', async () => {
      const socket = await startSession()
      const interrupted = collect(service.interrupted$)

      socket.receive({ kind: 'interrupted' })

      expect(interrupted).toHaveLength(0)
    })

    it('should not mark a completed reply when the next user turn interrupts', async () => {
      const socket = await startSession()
      const interrupted = collect(service.interrupted$)

      socket.receive({ kind: 'assistant_text', text: 'Done.' })
      socket.receive({ kind: 'turn_complete', entry_id: 'e-1' })
      socket.receive({ kind: 'user_started_speaking' })
      socket.receive({ kind: 'interrupted' })

      expect(interrupted).toHaveLength(0)
    })
  })

  describe('service failures during a session', () => {
    it.each([
      ['stt_failed', 'VOICE.NOTICE.STT_FAILED'],
      ['llm_failed', 'VOICE.NOTICE.LLM_FAILED'],
      ['tts_failed', 'VOICE.NOTICE.TTS_FAILED'],
      ['persistence_failed', 'VOICE.NOTICE.NOT_SAVED']
    ])('should keep the session and show a notice for "%s"', async (code, key) => {
      const socket = await startSession()
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      const ended = collect(service.ended$)

      socket.receive({ kind: 'error', code, message: 'failed' })

      expect(service.notice()).toBe(key)
      expect(service.isConnected()).toBe(true)
      expect(ended).toEqual([])
    })

    it.each(['stt_failed', 'llm_failed'])('should stop processing after "%s"', async (code) => {
      const socket = await startSession()
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      socket.receive({ kind: 'user_started_speaking' })
      socket.receive({ kind: 'transcript', text: 'Hello', state: 'FINAL' })
      socket.receive({ kind: 'user_stopped_speaking' })

      socket.receive({ kind: 'error', code, message: 'failed' })

      expect(service.activity()).toBe('listening')
    })

    it('should keep speaking when the speech of another sentence failed', async () => {
      const socket = await startSession()
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      socket.receive({ kind: 'bot_started_speaking' })

      socket.receive({ kind: 'error', code: 'tts_failed', message: 'failed' })

      expect(service.activity()).toBe('speaking')
    })

    it('should clear the notice when the user speaks again', async () => {
      const socket = await startSession()
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      socket.receive({ kind: 'error', code: 'stt_failed', message: 'failed' })

      socket.receive({ kind: 'user_started_speaking' })

      expect(service.notice()).toBeUndefined()
    })

    it('should not show a notice for protocol errors', async () => {
      const socket = await startSession()
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)

      socket.receive({ kind: 'error', code: 'bad_command', message: 'bad' })
      socket.receive({ kind: 'error', code: 'illegal_state', message: 'bad' })

      expect(service.notice()).toBeUndefined()
    })
  })

  describe('page context', () => {
    const PAGE: AiContextResponse = {
      productName: 'event-app',
      appId: 'event-app',
      appPath: '/events',
      context: 'Event 42'
    }
    const PAGE_JSON = JSON.stringify(PAGE)
    let gather: jest.SpyInstance

    beforeEach(() => {
      gather = jest.spyOn(AiContextGatherer.prototype, 'gather').mockResolvedValue([PAGE, null])
    })

    it('should resolve to no page context for the gatherer own requests', async () => {
      await expect(noPageContext()).resolves.toBeNull()
    })

    const startWithContext = async (): Promise<FakeWebSocket> => {
      const started = service.start('chat-1', 'agent-1', 'assistant')
      await settle()
      const socket = lastSocket()
      socket.open()
      socket.receive(READY)
      await started
      return socket
    }

    it('should send the gathered context with the session start', async () => {
      const socket = await startWithContext()

      expect(gather).toHaveBeenCalledWith({ agent: { name: 'assistant' } })
      expect(socket.sent[0]).toEqual(expect.objectContaining({ type: 'start_session', ai_context: [PAGE_JSON] }))
    })

    it('should not gather context when no agent name is given', async () => {
      const socket = await startSession()

      expect(gather).not.toHaveBeenCalled()
      expect(socket.sent[0]).toEqual(expect.objectContaining({ ai_context: [] }))
    })

    it('should send the current context before each user turn', async () => {
      const socket = await startWithContext()
      gather.mockResolvedValue([{ ...PAGE, context: 'Event 43' }])
      socket.receive({ kind: 'user_started_speaking' })
      await settle()

      expect(socket.sent[socket.sent.length - 1]).toEqual({
        type: 'context_update',
        ai_context: [JSON.stringify({ ...PAGE, context: 'Event 43' })]
      })
    })

    it('should not let a slower refresh of an earlier turn overwrite a later context', async () => {
      const socket = await startWithContext()
      let finishEarlier: (responses: (AiContextResponse | null)[]) => void = () => undefined
      gather.mockReturnValueOnce(new Promise((resolve) => (finishEarlier = resolve)))
      gather.mockResolvedValueOnce([{ ...PAGE, context: 'Event 43' }])
      socket.receive({ kind: 'user_started_speaking' })
      socket.receive({ kind: 'user_started_speaking' })
      await settle()

      finishEarlier([{ ...PAGE, context: 'Event 42' }])
      await settle()

      const contexts = socket.sent.filter((message) => message['type'] === 'context_update')
      expect(contexts).toEqual([
        { type: 'context_update', ai_context: [JSON.stringify({ ...PAGE, context: 'Event 43' })] }
      ])
    })

    it('should drop oversized entries and keep at most twenty', async () => {
      gather.mockResolvedValue([{ ...PAGE, context: 'x'.repeat(9000) }, ...Array.from({ length: 25 }, () => PAGE)])
      const started = service.start('chat-1', 'agent-1', 'assistant')
      await settle()
      const socket = lastSocket()
      socket.open()
      socket.receive(READY)
      await started

      const sent = socket.sent[0]['ai_context'] as string[]
      expect(sent).toHaveLength(20)
      expect(sent.every((entry) => entry === PAGE_JSON)).toBe(true)
    })

    it('should start without context when gathering fails', async () => {
      gather.mockRejectedValue(new Error('gatherer not initialized'))
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      const started = service.start('chat-1', 'agent-1', 'assistant')
      await settle()
      const socket = lastSocket()
      socket.open()
      socket.receive(READY)
      await started

      expect(socket.sent[0]).toEqual(expect.objectContaining({ ai_context: [] }))
    })

    it('should keep the previous context when a refresh fails', async () => {
      const socket = await startWithContext()
      gather.mockRejectedValue(new Error('gatherer not initialized'))
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      socket.receive({ kind: 'user_started_speaking' })
      await settle()

      expect(socket.types()).toEqual(['start_session'])
    })
  })

  describe('session end', () => {
    it('should release everything without sending stop when the voice service closes the session', async () => {
      const socket = await startSession()
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      const ended = collect(service.ended$)
      const user = collect(service.userTranscript$)

      socket.receive({ kind: 'session_closed', reason: 'token_expired' })

      expect(ended).toEqual(['token_expired'])
      expect(user).toEqual([{ text: '', isFinal: false }])
      expect(socket.types()).not.toContain('stop')
      expect(socket.close).toHaveBeenCalledWith(1000)
      expect(mic.stop).toHaveBeenCalled()
      expect(lastContext().close).toHaveBeenCalled()
      expect(service.isConnected()).toBe(false)
      expect(service.micStream()).toBeUndefined()
    })

    it.each(['session_max_duration', 'session_idle_timeout', 'audio_message_too_large'])(
      'should report the session limit outcome "%s" as the end reason',
      async (reason) => {
        const socket = await startSession()
        jest.spyOn(console, 'warn').mockImplementation(() => undefined)
        const ended = collect(service.ended$)

        // The voice service sends the typed error first, then closes the session with the same reason.
        socket.receive({ kind: 'error', code: reason, message: 'limit reached' })
        expect(ended).toEqual([])
        socket.receive({ kind: 'session_closed', reason })

        expect(ended).toEqual([reason])
        expect(socket.close).toHaveBeenCalledWith(1000)
        expect(service.isConnected()).toBe(false)
      }
    )

    it('should report a session closed without a reason as closed', async () => {
      const socket = await startSession()
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      const ended = collect(service.ended$)

      socket.receive({ kind: 'session_closed' })

      expect(ended).toEqual(['closed'])
    })

    it('should report a lost connection', async () => {
      const socket = await startSession()
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      const ended = collect(service.ended$)

      socket.serverClose()

      expect(ended).toEqual(['connection_closed'])
      expect(service.isConnected()).toBe(false)
    })

    it('should send stop, release everything and flush the user transcript on cleanup', async () => {
      const socket = await startSession()
      const ended = collect(service.ended$)
      const user = collect(service.userTranscript$)
      service.toggleMute()

      service.cleanup()

      expect(socket.sent[socket.sent.length - 1]).toEqual({ type: 'stop' })
      expect(socket.close).toHaveBeenCalledWith(1000)
      expect(socket.onmessage).toBeNull()
      expect(mic.stop).toHaveBeenCalled()
      expect(service.isConnected()).toBe(false)
      expect(service.isMuted()).toBe(false)
      expect(user).toEqual([{ text: '', isFinal: false }])
      expect(ended).toEqual([])
    })

    it('should keep the socket after stop until the voice service closed the session', async () => {
      const socket = await startSession()
      const ended = collect(service.ended$)
      let stopped = false

      const done = service.stop().then(() => (stopped = true))

      expect(socket.sent[socket.sent.length - 1]).toEqual({ type: 'stop' })
      expect(mic.stop).toHaveBeenCalled()
      expect(service.isConnected()).toBe(false)
      expect(socket.close).not.toHaveBeenCalled()
      socket.receive({ kind: 'assistant_audio', audio: encodeBase64(new Int16Array([1]).buffer), sample_rate: 16000 })
      await settle()
      expect(stopped).toBe(false)

      socket.receive({ kind: 'session_closed', reason: 'client_stopped' })
      await done

      expect(stopped).toBe(true)
      expect(socket.close).toHaveBeenCalledWith(1000)
      expect(lastContext().bufferSources).toEqual([])
      expect(ended).toEqual([])
    })

    it('should finish a stop when the voice service closes the connection', async () => {
      const socket = await startSession()

      const done = service.stop()
      socket.serverClose()
      await done

      expect(socket.close).toHaveBeenCalledWith(1000)
    })

    it('should finish a stop after a timeout when the voice service does not answer', async () => {
      const socket = await startSession()
      let stopped = false

      void service.stop().then(() => (stopped = true))
      await jest.advanceTimersByTimeAsync(19999)
      expect(stopped).toBe(false)
      await jest.advanceTimersByTimeAsync(1)

      expect(stopped).toBe(true)
      expect(socket.close).toHaveBeenCalledWith(1000)
    })

    it('should finish a stop at once when no session is running', async () => {
      await expect(service.stop()).resolves.toBeUndefined()
    })

    it('should let a new session start while the previous one is still closing', async () => {
      const first = await startSession()
      void service.stop()

      const second = await startSession()

      expect(second).not.toBe(first)
      expect(service.isConnected()).toBe(true)
      first.receive({ kind: 'session_closed', reason: 'client_stopped' })
      expect(service.isConnected()).toBe(true)
    })

    it('should not stop a microphone stream it does not own', () => {
      const stop = jest.fn()
      service.micStream.set({ getTracks: () => [{ stop }] } as unknown as MediaStream)

      service.ngOnDestroy()

      expect(stop).not.toHaveBeenCalled()
      expect(service.micStream()).toBeUndefined()
    })
  })

  describe('microphone selection', () => {
    const STORAGE_KEY = 'onecx-chat-ui.voice.microphone'

    const device = (deviceId: string, kind: MediaDeviceKind = 'audioinput', label = deviceId): MediaDeviceInfo =>
      ({ deviceId, kind, label, groupId: '' }) as MediaDeviceInfo

    beforeEach(() => {
      localStorage.removeItem(STORAGE_KEY)
      service = createService()
    })

    afterEach(() => {
      localStorage.removeItem(STORAGE_KEY)
    })

    it('should list audio inputs once the microphone was acquired and ignore other devices', async () => {
      defineMediaDevices({
        getUserMedia: jest.fn().mockResolvedValue(createDeviceStream('a').stream),
        enumerateDevices: jest
          .fn()
          .mockResolvedValue([
            device('a'),
            device('b'),
            device('', 'audioinput', ''),
            device('communications'),
            device('cam', 'videoinput'),
            device('out', 'audiooutput')
          ])
      })

      await startSession()

      expect(service.audioInputs().map((d) => d.deviceId)).toEqual(['a', 'b'])
      expect(service.activeDeviceId()).toBe('a')
    })

    it('should request the remembered microphone', async () => {
      localStorage.setItem(STORAGE_KEY, 'b')
      const getUserMedia = jest.fn().mockResolvedValue(createDeviceStream('b').stream)
      defineMediaDevices({ getUserMedia })
      service = createService()

      await startSession()

      expect(getUserMedia).toHaveBeenCalledWith({ audio: { deviceId: { exact: 'b' } } })
      expect(service.activeDeviceId()).toBe('b')
    })

    it('should take the requested microphone as active when the browser does not report the device', async () => {
      localStorage.setItem(STORAGE_KEY, 'b')
      const unreported = createDeviceStream()
      unreported.track.getSettings = () => ({})
      defineMediaDevices({ getUserMedia: jest.fn().mockResolvedValue(unreported.stream) })
      service = createService()

      await startSession()

      expect(service.activeDeviceId()).toBe('b')
    })

    it('should fall back to the default microphone when the remembered one is gone', async () => {
      localStorage.setItem(STORAGE_KEY, 'gone')
      const fallback = createDeviceStream('default')
      const getUserMedia = jest
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error('gone'), { name: 'OverconstrainedError' }))
        .mockResolvedValueOnce(fallback.stream)
      defineMediaDevices({ getUserMedia })
      service = createService()

      await startSession()

      expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true })
      expect(service.micStream()).toBe(fallback.stream)
      expect(service.selectedDeviceId()).toBeUndefined()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('should switch the captured microphone and remember the choice when one is selected during voice chat', async () => {
      const first = createDeviceStream('a')
      const second = createDeviceStream('b')
      const getUserMedia = jest.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)
      defineMediaDevices({ getUserMedia })
      await startSession()
      service.toggleMute()

      service.selectDevice('b')
      await settle()

      const [firstSource, secondSource] = lastContext().streamSources
      expect(first.stop).toHaveBeenCalled()
      expect(firstSource.disconnect).toHaveBeenCalled()
      expect(secondSource.stream).toBe(second.stream)
      expect(secondSource.connect).toHaveBeenCalledWith(lastNode())
      expect(second.track.enabled).toBe(false)
      expect(getUserMedia).toHaveBeenLastCalledWith({ audio: { deviceId: { exact: 'b' } } })
      expect(service.activeDeviceId()).toBe('b')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('b')
    })

    it('should do nothing when the active microphone is selected again', async () => {
      const getUserMedia = jest.fn().mockResolvedValue(createDeviceStream('a').stream)
      defineMediaDevices({ getUserMedia })
      await startSession()

      service.selectDevice('a')

      expect(getUserMedia).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('should keep the remembered microphone when access to it is denied', async () => {
      localStorage.setItem(STORAGE_KEY, 'b')
      const getUserMedia = jest.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
      defineMediaDevices({ getUserMedia })
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      service = createService()

      await expect(service.start('chat-1', 'agent-1')).rejects.toThrow('microphone unavailable')

      expect(getUserMedia).toHaveBeenCalledTimes(1)
      expect(service.selectedDeviceId()).toBe('b')
    })

    it('should only remember the choice when no voice chat is running', () => {
      const getUserMedia = jest.fn()
      defineMediaDevices({ getUserMedia })

      service.selectDevice('b')

      expect(getUserMedia).not.toHaveBeenCalled()
      expect(service.selectedDeviceId()).toBe('b')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('b')
    })

    it('should stop a stream that arrives after cleanup', async () => {
      const late = createDeviceStream('a')
      let resolveStream: (stream: MediaStream) => void = () => undefined
      defineMediaDevices({
        getUserMedia: jest.fn().mockReturnValue(new Promise((resolve) => (resolveStream = resolve)))
      })
      const started = begin()
      await settle()

      service.cleanup()
      resolveStream(late.stream)

      await expect(started).rejects.toThrow('start cancelled')
      expect(late.stop).toHaveBeenCalled()
      expect(service.micStream()).toBeUndefined()
      expect(FakeWebSocket.instances).toHaveLength(0)
    })

    it('should keep the device list empty when enumerating devices fails', async () => {
      defineMediaDevices({
        getUserMedia: jest.fn().mockResolvedValue(createDeviceStream('a').stream),
        enumerateDevices: jest.fn().mockRejectedValue(new Error('enumerate failed'))
      })

      await startSession()

      expect(service.audioInputs()).toEqual([])
    })

    it('should ignore an unreadable microphone storage', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage blocked')
      })

      expect(createService().selectedDeviceId()).toBeUndefined()
    })

    it('should not fill the device list with a result that arrives after cleanup', async () => {
      let resolveDevices: (devices: MediaDeviceInfo[]) => void = () => undefined
      defineMediaDevices({
        getUserMedia: jest.fn().mockResolvedValue(createDeviceStream('a').stream),
        enumerateDevices: jest.fn().mockReturnValue(new Promise((resolve) => (resolveDevices = resolve)))
      })
      const started = begin()
      await settle()

      service.cleanup()
      resolveDevices([device('a')])

      await expect(started).rejects.toThrow('start cancelled')
      expect(service.audioInputs()).toEqual([])
    })

    it('should re-acquire the microphone when its track ends', async () => {
      const first = createDeviceStream('default')
      const second = createDeviceStream('default')
      const getUserMedia = jest.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)
      defineMediaDevices({ getUserMedia, enumerateDevices: jest.fn().mockResolvedValue([device('default')]) })
      await startSession()

      first.track.onended?.()
      await settle()

      expect(getUserMedia).toHaveBeenCalledTimes(2)
      expect(service.micStream()).toBe(second.stream)
      expect(lastContext().streamSources[1].stream).toBe(second.stream)
    })

    it('should ignore an ended track of a replaced stream', async () => {
      const first = createDeviceStream('a')
      const second = createDeviceStream('b')
      const getUserMedia = jest.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)
      defineMediaDevices({ getUserMedia })
      await startSession()
      service.selectDevice('b')
      await settle()

      first.track.onended?.()
      await settle()

      expect(getUserMedia).toHaveBeenCalledTimes(2)
      expect(service.micStream()).toBe(second.stream)
    })

    it('should re-acquire the default microphone when the active one is unplugged', async () => {
      const first = createDeviceStream('a')
      const second = createDeviceStream('b')
      const listeners: (() => void)[] = []
      const enumerateDevices = jest.fn().mockResolvedValueOnce([device('a'), device('b')])
      const getUserMedia = jest.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)
      const removeEventListener = jest.fn()
      defineMediaDevices({
        getUserMedia,
        enumerateDevices,
        addEventListener: ((_: string, listener: () => void) => listeners.push(listener)) as never,
        removeEventListener
      })
      await startSession()
      enumerateDevices.mockResolvedValue([device('b')])

      listeners[0]()
      await settle()

      expect(first.stop).toHaveBeenCalled()
      expect(service.micStream()).toBe(second.stream)

      service.cleanup()
      expect(removeEventListener).toHaveBeenCalledWith('devicechange', listeners[0])
    })
  })
})

describe('sessionEndMessageKey', () => {
  it.each([
    ['session_max_duration', 'VOICE.ENDED.MAX_DURATION'],
    ['session_idle_timeout', 'VOICE.ENDED.IDLE_TIMEOUT'],
    ['audio_message_too_large', 'VOICE.ENDED.AUDIO_TOO_LARGE'],
    ['token_expired', 'VOICE.ENDED.TOKEN_EXPIRED'],
    ['connection_closed', 'VOICE.ENDED.CONNECTION_LOST']
  ])('should map "%s" to its own message', (reason, key) => {
    expect(sessionEndMessageKey(reason)).toBe(key)
  })

  it.each(['context_inconsistent', 'pipeline_ended', 'start_failed', 'closed', 'toString', ''])(
    'should report the outcome "%s" as a failure',
    (reason) => {
      expect(sessionEndMessageKey(reason)).toBe('VOICE.ENDED.FAILED')
    }
  )

  it('should show nothing when the user stopped the session', () => {
    expect(sessionEndMessageKey('client_stopped')).toBeUndefined()
  })
})

describe('startErrorMessageKey', () => {
  it.each([
    ['authentication_failed', 'VOICE.START_ERRORS.AUTHENTICATION_FAILED'],
    ['chat_not_accessible', 'VOICE.START_ERRORS.CHAT_NOT_ACCESSIBLE'],
    ['voice_not_permitted', 'VOICE.START_ERRORS.NOT_PERMITTED'],
    ['config_unavailable', 'VOICE.START_ERRORS.CONFIG_UNAVAILABLE'],
    ['unsupported_language', 'VOICE.START_ERRORS.UNSUPPORTED_LANGUAGE'],
    ['microphone_unavailable', 'VOICE.START_ERRORS.MICROPHONE'],
    ['no_response', 'VOICE.START_ERRORS.NO_RESPONSE'],
    ['connection_closed', 'VOICE.START_ERRORS.UNREACHABLE'],
    ['bad_command', 'VOICE.START_FAILED'],
    ['toString', 'VOICE.START_FAILED']
  ])('should map the start error "%s"', (code, key) => {
    expect(startErrorMessageKey(new VoiceStartError(code, 'failed'))).toBe(key)
  })

  it.each([new Error('boom'), undefined, 'text'])('should map the unknown failure %p to a generic message', (error) => {
    expect(startErrorMessageKey(error)).toBe('VOICE.START_FAILED')
  })

  it('should show nothing for a cancelled start', () => {
    expect(startErrorMessageKey(new VoiceStartError('cancelled', 'cancelled'))).toBeUndefined()
  })
})

describe('voiceCaptureSupported', () => {
  const originalWebSocket = globalThis.WebSocket
  const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')

  beforeEach(() => {
    Object.assign(globalThis, { AudioContext: class {}, AudioWorkletNode: class {}, WebSocket: class {} })
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: jest.fn() }, configurable: true })
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
    delete (globalThis as Record<string, unknown>)['AudioContext']
    delete (globalThis as Record<string, unknown>)['AudioWorkletNode']
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices)
    } else {
      delete (navigator as unknown as Record<string, unknown>)['mediaDevices']
    }
  })

  it('should be supported with microphone access, Web Audio worklets and WebSockets', () => {
    expect(voiceCaptureSupported()).toBe(true)
  })

  it.each(['AudioContext', 'AudioWorkletNode', 'WebSocket'])('should not be supported without %s', (name) => {
    delete (globalThis as Record<string, unknown>)[name]
    expect(voiceCaptureSupported()).toBe(false)
  })

  it('should not be supported without microphone access', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    expect(voiceCaptureSupported()).toBe(false)
  })

  it('should not be supported outside a secure context', () => {
    Object.defineProperty(globalThis, 'isSecureContext', { value: false, configurable: true })
    try {
      expect(voiceCaptureSupported()).toBe(false)
    } finally {
      delete (globalThis as Record<string, unknown>)['isSecureContext']
    }
  })
})
