import { TestBed } from '@angular/core/testing'
import { AuthProxyService } from '@onecx/angular-auth'
import { Observable } from 'rxjs'

import { environment } from '../../../environments/environment'
import { CAPTURE_PROCESSOR_NAME, encodeBase64 } from './voice-audio'
import { VoiceService } from './voice.service'

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
      const configured = environment.voiceWsUrl
      environment.voiceWsUrl = 'wss://voice.example.com/ws/voice'
      try {
        begin()
        await settle()

        expect(lastSocket().url).toBe('wss://voice.example.com/ws/voice')
      } finally {
        environment.voiceWsUrl = configured
      }
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

      await expect(service.start('chat-1', 'agent-1')).rejects.toThrow('microphone unavailable')

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
      expect(socket.types()).toEqual(['start_session'])
      expect(socket.close).toHaveBeenCalledWith(1000)
      expect(mic.stop).toHaveBeenCalled()
      expect(lastNode().disconnect).toHaveBeenCalled()
      expect(lastContext().close).toHaveBeenCalled()
      expect(service.isConnecting()).toBe(false)
      expect(service.isConnected()).toBe(false)
    })

    it('should reject when the connection closes before the session is ready', async () => {
      const ended = collect(service.ended$)
      const started = begin()
      await settle()

      lastSocket().serverClose()

      await expect(started).rejects.toThrow('the session closed (connection_closed)')
      expect(ended).toEqual([])
    })

    it('should reject when the voice service does not answer in time', async () => {
      const started = begin()
      const rejected = expect(started).rejects.toThrow('the voice service did not respond')

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
