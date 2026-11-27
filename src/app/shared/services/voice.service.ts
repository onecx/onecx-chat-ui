import { inject, Injectable, Injector, NgZone, OnDestroy, runInInjectionContext, signal } from '@angular/core'
import { AuthProxyService } from '@onecx/angular-auth'
import { AiContextGatherer, AiContextResponse } from '@onecx/integration-interface'
import { Subject } from 'rxjs'

import { VoiceConfigService } from './voice-config.service'
import {
  CAPTURE_CHUNK_SAMPLES,
  CAPTURE_PROCESSOR_NAME,
  CAPTURE_SAMPLE_RATE,
  CAPTURE_WORKLET_SOURCE,
  decodePcm16,
  encodeBase64
} from './voice-audio'

export interface Transcript {
  text: string
  isFinal?: boolean
  spoken?: boolean
}

/** What the focused voice view shows besides the microphone state. */
export type VoiceActivity = 'listening' | 'processing' | 'speaking'

function lookup(keys: Record<string, string>, code: unknown): string | undefined {
  return typeof code === 'string' && Object.hasOwn(keys, code) ? keys[code] : undefined
}

/**
 * Translation keys of the typed outcomes with which a running session ends (`session_closed.reason`,
 * onecx-pipecat protocol version 4) plus `connection_closed` for a lost connection.
 */
const SESSION_END_MESSAGE_KEYS: Record<string, string> = {
  session_max_duration: 'VOICE.ENDED.MAX_DURATION',
  session_idle_timeout: 'VOICE.ENDED.IDLE_TIMEOUT',
  audio_message_too_large: 'VOICE.ENDED.AUDIO_TOO_LARGE',
  token_expired: 'VOICE.ENDED.TOKEN_EXPIRED',
  connection_closed: 'VOICE.ENDED.CONNECTION_LOST'
}

/**
 * The message to show when a running session ended for `reason`; undefined only when the user
 * stopped it. Unknown or failure outcomes (e.g. `context_inconsistent`, `pipeline_ended`) get a
 * generic failure message, so a session never ends silently.
 */
export function sessionEndMessageKey(reason: string): string | undefined {
  if (reason === 'client_stopped') return undefined
  return lookup(SESSION_END_MESSAGE_KEYS, reason) ?? 'VOICE.ENDED.FAILED'
}

/** A voice session that could not be started; `code` is the voice service's error code or a local one. */
export class VoiceStartError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'VoiceStartError'
  }
}

/** Start was cancelled locally (stop, chat switch); not a failure to show. */
export const START_CANCELLED = 'cancelled'

const START_ERROR_MESSAGE_KEYS: Record<string, string> = {
  authentication_failed: 'VOICE.START_ERRORS.AUTHENTICATION_FAILED',
  chat_not_accessible: 'VOICE.START_ERRORS.CHAT_NOT_ACCESSIBLE',
  voice_not_permitted: 'VOICE.START_ERRORS.NOT_PERMITTED',
  config_unavailable: 'VOICE.START_ERRORS.CONFIG_UNAVAILABLE',
  unsupported_language: 'VOICE.START_ERRORS.UNSUPPORTED_LANGUAGE',
  microphone_unavailable: 'VOICE.START_ERRORS.MICROPHONE',
  no_response: 'VOICE.START_ERRORS.NO_RESPONSE',
  connection_closed: 'VOICE.START_ERRORS.UNREACHABLE'
}

/** The message to show for a failed start; undefined when the start was only cancelled. */
export function startErrorMessageKey(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | undefined)?.code
  if (code === START_CANCELLED) return undefined
  return lookup(START_ERROR_MESSAGE_KEYS, code) ?? 'VOICE.START_FAILED'
}

/** Service failures the voice service reports without ending the session. */
const NOTICE_MESSAGE_KEYS: Record<string, string> = {
  stt_failed: 'VOICE.NOTICE.STT_FAILED',
  llm_failed: 'VOICE.NOTICE.LLM_FAILED',
  tts_failed: 'VOICE.NOTICE.TTS_FAILED',
  persistence_failed: 'VOICE.NOTICE.NOT_SAVED'
}

/** Whether this browser can capture and stream the microphone to the voice service. */
export function voiceCaptureSupported(): boolean {
  const scope = globalThis as { isSecureContext?: boolean; AudioContext?: unknown; AudioWorkletNode?: unknown }
  return (
    scope.isSecureContext !== false &&
    typeof globalThis.navigator?.mediaDevices?.getUserMedia === 'function' &&
    typeof scope.AudioContext === 'function' &&
    typeof scope.AudioWorkletNode === 'function' &&
    typeof globalThis.WebSocket === 'function'
  )
}

/** An event of the voice service's WebSocket protocol (onecx-pipecat, version 4). */
interface VoiceEvent {
  kind: string
  text?: string
  state?: 'PARTIAL' | 'FINAL'
  audio?: string
  sample_rate?: number
  num_channels?: number
  code?: string
  message?: string
  reason?: string
}

interface PendingStart {
  resolve: () => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const SELECTED_MICROPHONE_STORAGE_KEY = 'onecx-chat-ui.voice.microphone'

// Delay before an assistant reply starts playing, so its first chunk is not cut off.
const PLAYBACK_LEAD_SECONDS = 0.05
// Keycloak only refreshes a token shortly before it expires, so check often enough to hand the
// new token to the voice service before the old one runs out.
const TOKEN_REFRESH_INTERVAL_MS = 3000
const SESSION_READY_TIMEOUT_MS = 20000
// How long a stop waits for the voice service to save the last turn and close the session; the voice
// service itself waits up to 20 s for its final saves. The typed composer is back already meanwhile.
const STOP_TIMEOUT_MS = 20000

function readStoredMicrophoneId(): string | undefined {
  try {
    return localStorage.getItem(SELECTED_MICROPHONE_STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function storeMicrophoneId(deviceId: string | undefined): void {
  try {
    if (deviceId) {
      localStorage.setItem(SELECTED_MICROPHONE_STORAGE_KEY, deviceId)
    } else {
      localStorage.removeItem(SELECTED_MICROPHONE_STORAGE_KEY)
    }
  } catch {
    // Storage can be unavailable (private mode, blocked); the selection then only lives for this session.
  }
}

// Limits of the voice service: it rejects the whole session start when they are exceeded.
/** Responder for the gatherer's own requests: the voice service has no page context of its own to contribute. */
export function noPageContext(): Promise<null> {
  return Promise.resolve(null)
}

const MAX_AI_CONTEXT_ENTRIES = 20
const MAX_AI_CONTEXT_ENTRY_CHARS = 8000

/** Keeps the entries the voice service accepts; oversized entries are dropped, not truncated. */
function limitAiContext(responses: AiContextResponse[]): string[] {
  return responses
    .map((response) => JSON.stringify(response))
    .filter((entry) => entry.length <= MAX_AI_CONTEXT_ENTRY_CHARS)
    .slice(0, MAX_AI_CONTEXT_ENTRIES)
}

function parseEvent(data: unknown): VoiceEvent | undefined {
  if (typeof data !== 'string') return undefined
  try {
    const event = JSON.parse(data)
    return typeof event?.kind === 'string' ? event : undefined
  } catch {
    return undefined
  }
}

/**
 * Client of the voice service (onecx-pipecat, WebSocket `/ws/voice`).
 *
 * `start()` opens the WebSocket, starts a session for the chat and agent with the user's tokens
 * and then streams the microphone as PCM16 mono 16 kHz. The voice service detects the user's
 * turns itself (server-side VAD), sends live transcripts plus the assistant's text and audio,
 * and saves every turn to the chat. Assistant audio is played gaplessly with the Web Audio API
 * and dropped when the user interrupts. The microphone stream also drives the waveform.
 */
@Injectable({ providedIn: 'root' })
export class VoiceService implements OnDestroy {
  private readonly authProxy = inject(AuthProxyService)
  private readonly voiceConfig = inject(VoiceConfigService)
  private readonly injector = inject(Injector)
  private readonly zone = inject(NgZone)

  // State signals
  readonly isConnecting = signal(false)
  readonly isConnected = signal(false)
  readonly isMuted = signal(false)
  readonly micStream = signal<MediaStream | undefined>(undefined)
  /** Listening, processing a user turn, or speaking the reply; listening while no session runs. */
  readonly activity = signal<VoiceActivity>('listening')
  /** Translation key of a service failure that did not end the session; cleared on the next user turn. */
  readonly notice = signal<string | undefined>(undefined)

  // Microphone selection. Device labels are only exposed by the browser once microphone
  // permission has been granted, so the list is refreshed after the microphone was acquired.
  readonly audioInputs = signal<MediaDeviceInfo[]>([])
  readonly selectedDeviceId = signal<string | undefined>(readStoredMicrophoneId())
  readonly activeDeviceId = signal<string | undefined>(undefined)

  readonly userTranscript$ = new Subject<Transcript>()
  readonly botTranscript$ = new Subject<Transcript>()
  /** Emits the reason when the voice service ends the session; `cleanup()` and `stop()` do not emit. */
  readonly ended$ = new Subject<string>()
  /** Emits when the user interrupted a reply of which text was already shown. */
  readonly interrupted$ = new Subject<void>()

  private micStreamIsOwned = false
  private micRequestId = 0
  private audioPrepared = false

  // Incremented by release(), so async work of an earlier session can tell it is stale.
  private generation = 0
  private socket: WebSocket | undefined
  private pendingStart: PendingStart | undefined
  private ready = false
  private principalToken = ''
  private refreshTimer: ReturnType<typeof setInterval> | undefined
  private refreshing = false
  // Orders page-context refreshes: a result is sent only if no newer refresh was already sent.
  private contextRefreshSequence = 0
  private contextSentSequence = 0
  // Agent whose page context is gathered for each turn; undefined when the agent has none.
  private contextAgentName: string | undefined
  private readonly aiContextGatherer = new AiContextGatherer(noPageContext)

  private audioContext: AudioContext | undefined
  private captureNode: AudioWorkletNode | undefined
  private captureSource: MediaStreamAudioSourceNode | undefined
  private readonly playing = new Set<AudioBufferSourceNode>()
  private playhead = 0

  private userTurnActive = false
  private userTurnFinals: string[] = []
  // The current reply already sent text, so an interruption cuts off visible text.
  private replyHasText = false

  private readonly onDeviceChange = (): void => {
    void this.handleDeviceChange()
  }

  /**
   * @param contextAgentName agent whose page context is sent with the session and before each
   * turn; leave undefined for agents that do not use page context.
   */
  async start(chatId: string, agentId: string, contextAgentName?: string): Promise<void> {
    if (this.isConnected() || this.isConnecting()) return
    if (!agentId) throw new Error('Voice: no agent selected')

    await this.prepareStart(contextAgentName)
    await this.startPrepared(chatId, agentId)
  }

  async prepareStart(contextAgentName?: string): Promise<void> {
    if (this.isConnected() || this.isConnecting()) throw new Error('Voice: start already in progress')

    const generation = this.generation
    this.isConnecting.set(true)
    this.contextAgentName = contextAgentName
    try {
      // Created before the first await, while the click that started the voice chat still
      // counts as a user gesture; otherwise the browser may keep the audio suspended.
      const context = new AudioContext()
      this.audioContext = context
      void context.resume().catch(() => undefined)

      const micAcquired = await this.acquireMic()
      this.assertCurrent(generation)
      if (!micAcquired) throw new VoiceStartError('microphone_unavailable', 'Voice: microphone unavailable')
      await this.startCapture(context, generation)
      this.audioPrepared = true
    } catch (error) {
      if (generation === this.generation) this.release()
      throw error
    }
  }

  async startPrepared(chatId: string, agentId: string): Promise<void> {
    if (!this.audioPrepared) throw new Error('Voice: audio has not been prepared')

    const generation = this.generation
    try {
      if (!agentId) throw new Error('Voice: no agent selected')
      await this.updateTokens()
      this.assertCurrent(generation)
      const aiContext = (await this.gatherAiContext()) ?? []
      this.assertCurrent(generation)
      await this.openSession(chatId, agentId, aiContext)
    } catch (error) {
      if (generation === this.generation) this.release()
      throw error
    }

    this.isConnecting.set(false)
    this.isConnected.set(true)
    navigator.mediaDevices?.addEventListener?.('devicechange', this.onDeviceChange)
    this.startTokenRefresh()
  }

  toggleMute(): void {
    this.isMuted.update((muted) => !muted)
    const stream = this.micStream()
    if (stream) this.applyMute(stream)
  }

  /**
   * Switches the microphone. The choice is remembered for the next voice chat; while a voice
   * chat is running the microphone stream is replaced immediately.
   */
  selectDevice(deviceId: string): void {
    if (deviceId === this.activeDeviceId()) return

    this.setSelectedDeviceId(deviceId)
    if (this.isConnected()) {
      this.stopMicStream()
      void this.acquireMic()
    }
  }

  /** Ends the voice chat at once, e.g. when the chat is left. Does not emit `ended$`. */
  cleanup(): void {
    void this.teardown(false)
    this.userTranscript$.next({ text: '', isFinal: false })
  }

  /**
   * Stops the voice chat on the user's request. Microphone and playback stop at once; the promise
   * resolves once the voice service has saved the last turn and closed the session (or after a
   * timeout), so that the chat history can be reloaded with it. Does not emit `ended$`.
   */
  stop(): Promise<void> {
    const closed = this.teardown(true)
    this.userTranscript$.next({ text: '', isFinal: false })
    return closed
  }

  ngOnDestroy(): void {
    this.cleanup()
    this.aiContextGatherer.destroy()
  }

  // -- session ------------------------------------------------------------

  /**
   * Gathers the page context of the agent's MFEs. Resolves to undefined when gathering fails,
   * so that a failure does not replace a context that was sent before.
   */
  private async gatherAiContext(): Promise<string[] | undefined> {
    if (!this.contextAgentName) return []
    try {
      const responses = await this.aiContextGatherer.gather({ agent: { name: this.contextAgentName } })
      return limitAiContext(responses.filter((response): response is AiContextResponse => response !== null))
    } catch (error) {
      console.warn('Voice: could not gather the page context:', error)
      return undefined
    }
  }

  /** Sends the current page context before a turn, so the assistant answers about the page the user is on. */
  private refreshAiContext(): void {
    if (!this.contextAgentName) return
    const generation = this.generation
    const sequence = ++this.contextRefreshSequence
    void this.gatherAiContext().then((aiContext) => {
      // A slower gather of an earlier turn must not overwrite the context of a later one.
      if (sequence <= this.contextSentSequence) return
      if (aiContext && generation === this.generation && this.ready) {
        this.contextSentSequence = sequence
        this.send({ type: 'context_update', ai_context: aiContext })
      }
    })
  }

  private openSession(chatId: string, agentId: string, aiContext: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Outside Angular: audio arrives every few milliseconds and must not trigger change detection.
      this.zone.runOutsideAngular(() => {
        const timer = setTimeout(
          () => this.settleStart(new VoiceStartError('no_response', 'Voice: the voice service did not respond')),
          SESSION_READY_TIMEOUT_MS
        )
        this.pendingStart = { resolve, reject, timer }
        const socket = new WebSocket(this.socketUrl())
        socket.onopen = () => this.sendStartSession(chatId, agentId, aiContext)
        socket.onmessage = (message: MessageEvent) => this.onSocketMessage(message)
        socket.onclose = () => this.zone.run(() => this.finish('connection_closed'))
        this.socket = socket
      })
    })
  }

  private socketUrl(): string {
    const configured = this.voiceConfig.voiceWsUrl()
    if (configured) return configured
    // Same origin as the app: http: becomes ws:, https: becomes wss:.
    return `${location.protocol.replace('http', 'ws')}//${location.host}/ws/voice`
  }

  private sendStartSession(chatId: string, agentId: string, aiContext: string[]): void {
    const { apmPrincipalToken, authorization } = this.readTokens()
    this.principalToken = apmPrincipalToken
    this.send({
      type: 'start_session',
      chat_id: chatId,
      agent_id: agentId,
      apm_principal_token: apmPrincipalToken,
      authorization,
      ai_context: aiContext
    })
  }

  private onSocketMessage(message: MessageEvent): void {
    const event = parseEvent(message.data)
    if (!event) return
    if (event.kind === 'assistant_audio') {
      this.play(event)
    } else if (event.kind === 'interrupted') {
      // Stops the assistant at once, without waiting for change detection.
      this.stopPlayback()
      this.zone.run(() => this.onInterrupted())
    } else {
      this.zone.run(() => this.handleEvent(event))
    }
  }

  private handleEvent(event: VoiceEvent): void {
    switch (event.kind) {
      case 'session_ready':
        this.ready = true
        this.activity.set('listening')
        this.settleStart()
        break
      case 'transcript':
        this.onTranscript(event.text ?? '', event.state === 'FINAL')
        break
      case 'user_started_speaking':
        this.userTurnActive = true
        this.userTurnFinals = []
        this.activity.set('listening')
        this.notice.set(undefined)
        // Closes the current assistant message, so the next reply gets its own message.
        this.userTranscript$.next({ text: '', isFinal: false })
        this.refreshAiContext()
        break
      case 'user_stopped_speaking':
        this.endUserTurn()
        break
      case 'assistant_text':
        if (event.text) {
          this.replyHasText = true
          this.botTranscript$.next({ text: event.text, spoken: false })
        }
        break
      case 'bot_started_speaking':
        this.activity.set('speaking')
        break
      case 'bot_stopped_speaking':
        this.activity.set('listening')
        break
      case 'turn_complete':
        this.replyHasText = false
        if (this.activity() !== 'speaking') this.activity.set('listening')
        break
      case 'error':
        this.onServerError(event)
        break
      case 'degraded_capability':
        console.warn('Voice: running with reduced capabilities:', event.reason)
        break
      case 'session_closed':
        this.finish(event.reason ?? 'closed')
        break
      default:
        break
    }
  }

  private onInterrupted(): void {
    if (this.activity() === 'speaking') this.activity.set('listening')
    // An interruption before the first sentence of a reply leaves no text to mark.
    if (!this.replyHasText) return
    this.replyHasText = false
    this.interrupted$.next()
  }

  private onServerError(event: VoiceEvent): void {
    const message = `Voice: ${event.code}: ${event.message}`
    if (this.pendingStart) {
      // The session could not start; the socket may stay open (e.g. for a malformed request).
      this.settleStart(new VoiceStartError(event.code ?? 'unknown', message))
      return
    }
    console.warn(message)
    const notice = lookup(NOTICE_MESSAGE_KEYS, event.code)
    if (!notice) return
    this.notice.set(notice)
    // No reply follows a failed recognition or model call.
    if ((event.code === 'stt_failed' || event.code === 'llm_failed') && this.activity() === 'processing') {
      this.activity.set('listening')
    }
  }

  /** The voice service ended the session, or the connection was lost. */
  private finish(reason: string): void {
    if (this.pendingStart) {
      this.settleStart(new VoiceStartError(reason, `Voice: the session closed (${reason})`))
      return
    }
    console.warn('Voice: the voice session ended:', reason)
    // The session is already over on the server, so release() must not send `stop`.
    this.ready = false
    this.release()
    this.userTranscript$.next({ text: '', isFinal: false })
    this.ended$.next(reason)
  }

  private settleStart(error?: Error): void {
    const pending = this.pendingStart
    if (!pending) return
    this.pendingStart = undefined
    clearTimeout(pending.timer)
    if (error) {
      pending.reject(error)
    } else {
      pending.resolve()
    }
  }

  private assertCurrent(generation: number): void {
    if (generation !== this.generation) throw new VoiceStartError(START_CANCELLED, 'Voice: start cancelled')
  }

  private send(message: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }

  /** Ends the session locally and frees the socket, audio graph and microphone. Emits nothing. */
  private release(): void {
    void this.teardown(false)
  }

  /**
   * Frees the socket, audio graph and microphone. With `awaitClose`, the socket of a running session
   * stays open after `stop` until the voice service closed the session; the promise resolves then.
   */
  private teardown(awaitClose: boolean): Promise<void> {
    this.generation++
    this.settleStart(new VoiceStartError(START_CANCELLED, 'Voice: start cancelled'))
    clearInterval(this.refreshTimer)
    this.refreshTimer = undefined
    const closed = this.closeSocket(awaitClose)
    this.stopPlayback()
    if (this.captureNode) {
      this.captureNode.port.onmessage = null
      this.captureNode.disconnect()
      this.captureNode = undefined
    }
    navigator.mediaDevices?.removeEventListener?.('devicechange', this.onDeviceChange)
    this.micRequestId++
    this.stopMicStream()
    this.audioInputs.set([])
    this.audioPrepared = false
    this.audioContext?.close().catch(() => undefined)
    this.audioContext = undefined
    this.userTurnActive = false
    this.userTurnFinals = []
    this.replyHasText = false
    this.principalToken = ''

    this.isConnecting.set(false)
    this.isConnected.set(false)
    this.isMuted.set(false)
    this.activity.set('listening')
    this.notice.set(undefined)
    return closed
  }

  private closeSocket(awaitClose: boolean): Promise<void> {
    const socket = this.socket
    this.socket = undefined
    if (!socket) return Promise.resolve()
    socket.onopen = null
    socket.onmessage = null
    socket.onclose = null
    const running = this.ready && socket.readyState === WebSocket.OPEN
    this.ready = false
    if (running) socket.send(JSON.stringify({ type: 'stop' }))
    if (!running || !awaitClose) {
      socket.close(1000)
      return Promise.resolve()
    }
    // The voice service saves the last turn before it answers `stop` with `session_closed`.
    return new Promise<void>((resolve) => {
      this.zone.runOutsideAngular(() => {
        const done = (): void => {
          clearTimeout(timer)
          socket.onmessage = null
          socket.onclose = null
          socket.close(1000)
          this.zone.run(() => resolve())
        }
        const timer = setTimeout(done, STOP_TIMEOUT_MS)
        // Remaining assistant audio is dropped; only the end of the session matters now.
        socket.onmessage = (message: MessageEvent) => {
          if (parseEvent(message.data)?.kind === 'session_closed') done()
        }
        socket.onclose = done
      })
    })
  }

  // -- tokens ---------------------------------------------------------------

  private startTokenRefresh(): void {
    this.zone.runOutsideAngular(() => {
      this.refreshTimer = setInterval(() => void this.refreshSessionTokens(), TOKEN_REFRESH_INTERVAL_MS)
    })
  }

  private async refreshSessionTokens(): Promise<void> {
    if (this.refreshing) return
    const generation = this.generation
    this.refreshing = true
    try {
      await this.updateTokens()
    } finally {
      this.refreshing = false
    }
    if (generation !== this.generation || !this.ready) return

    const { apmPrincipalToken, authorization } = this.readTokens()
    if (!apmPrincipalToken || apmPrincipalToken === this.principalToken) return
    this.principalToken = apmPrincipalToken
    this.send({ type: 'refresh_token', apm_principal_token: apmPrincipalToken, authorization })
  }

  private async updateTokens(): Promise<void> {
    try {
      // Without the shell's auth proxy, the library falls back to inject(), which needs an injection context.
      await runInInjectionContext(this.injector, () => this.authProxy.updateTokenIfNeeded())
    } catch (error) {
      console.warn('Voice: unable to refresh the user token:', error)
    }
  }

  private readTokens(): { apmPrincipalToken: string; authorization: string } {
    const headers = this.authProxy.getHeaderValues()
    return { apmPrincipalToken: headers['apm-principal-token'] ?? '', authorization: headers['Authorization'] ?? '' }
  }

  // -- transcripts ----------------------------------------------------------

  private onTranscript(text: string, isFinal: boolean): void {
    const segment = text.trim()
    if (!segment) return
    if (isFinal && !this.userTurnActive) {
      // A late final transcript of a turn the voice service has already ended.
      this.userTranscript$.next({ text: segment, isFinal: true })
      if (this.activity() === 'listening') this.activity.set('processing')
      return
    }
    if (isFinal) this.userTurnFinals.push(segment)
    const segments = isFinal ? this.userTurnFinals : [...this.userTurnFinals, segment]
    this.userTranscript$.next({ text: segments.join(' '), isFinal: false })
  }

  private endUserTurn(): void {
    const text = this.userTurnFinals.join(' ')
    this.userTurnActive = false
    this.userTurnFinals = []
    this.userTranscript$.next({ text, isFinal: text.length > 0 })
    // A turn with words goes to the assistant; a turn without words gets no reply.
    if (this.activity() !== 'speaking') this.activity.set(text.length > 0 ? 'processing' : 'listening')
  }

  // -- audio ----------------------------------------------------------------

  private async startCapture(context: AudioContext, generation: number): Promise<void> {
    const moduleUrl = URL.createObjectURL(new Blob([CAPTURE_WORKLET_SOURCE], { type: 'text/javascript' }))
    try {
      await context.audioWorklet.addModule(moduleUrl)
    } finally {
      URL.revokeObjectURL(moduleUrl)
    }
    this.assertCurrent(generation)

    this.zone.runOutsideAngular(() => {
      const node = new AudioWorkletNode(context, CAPTURE_PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
        processorOptions: { targetSampleRate: CAPTURE_SAMPLE_RATE, chunkSamples: CAPTURE_CHUNK_SAMPLES }
      })
      node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => this.sendAudio(event.data)
      // The processor only outputs silence; being connected keeps it rendering in every browser.
      node.connect(context.destination)
      this.captureNode = node
    })
    const stream = this.micStream()
    if (stream) this.connectCapture(stream)
  }

  private connectCapture(stream: MediaStream): void {
    if (!this.audioContext || !this.captureNode) return
    this.captureSource?.disconnect()
    this.captureSource = this.audioContext.createMediaStreamSource(stream)
    this.captureSource.connect(this.captureNode)
  }

  private sendAudio(chunk: ArrayBuffer): void {
    // The voice service rejects audio before the session is ready.
    if (this.ready) this.send({ type: 'audio', audio: encodeBase64(chunk) })
  }

  private play(event: VoiceEvent): void {
    const context = this.audioContext
    if (!context || !event.audio || !event.sample_rate) return
    const channels = Math.max(1, event.num_channels ?? 1)
    const samples = decodePcm16(event.audio)
    const frames = Math.floor(samples.length / channels)
    if (frames === 0) return

    const buffer = context.createBuffer(channels, frames, event.sample_rate)
    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel)
      for (let frame = 0; frame < frames; frame++) {
        data[frame] = samples[frame * channels + channel] / 0x8000
      }
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    // Chunks arrive faster than real time; queue each one right after the previous one.
    const startAt = Math.max(context.currentTime + PLAYBACK_LEAD_SECONDS, this.playhead)
    source.onended = () => this.playing.delete(source)
    source.start(startAt)
    this.playhead = startAt + buffer.duration
    this.playing.add(source)
  }

  /** Drops queued assistant audio, e.g. when the user interrupts the assistant. */
  private stopPlayback(): void {
    for (const source of this.playing) {
      source.onended = null
      source.stop()
      source.disconnect()
    }
    this.playing.clear()
    this.playhead = 0
  }

  // -- microphone -------------------------------------------------------------

  private applyMute(stream: MediaStream): void {
    // A muted track sends silence, so the voice service still notices that the user stopped speaking.
    for (const track of stream.getTracks()) {
      track.enabled = !this.isMuted()
    }
  }

  /**
   * Requests the microphone and feeds it to the capture graph and the waveform.
   * Resolves to false when no microphone could be opened.
   */
  private async acquireMic(): Promise<boolean> {
    const requestId = ++this.micRequestId
    let acquired = false
    try {
      const stream = await this.requestMic(this.selectedDeviceId())
      if (requestId !== this.micRequestId) {
        // Superseded by a newer selection or by cleanup() while the permission prompt was open.
        this.stopTracks(stream)
        return false
      }
      this.micStreamIsOwned = true
      this.micStream.set(stream)
      this.applyMute(stream)
      this.connectCapture(stream)
      const track = stream.getTracks()[0]
      this.activeDeviceId.set(track?.getSettings?.().deviceId ?? this.selectedDeviceId())
      if (track) {
        // Fires when the device is unplugged or access is revoked by the browser/OS, but not on our own stop().
        track.onended = () => {
          if (requestId === this.micRequestId && this.isConnected()) {
            this.stopMicStream()
            void this.acquireMic()
          }
        }
      }
      acquired = true
    } catch (error) {
      console.warn('Voice: unable to access the microphone:', error)
      if (requestId === this.micRequestId) {
        this.micStream.set(undefined)
      }
    }
    if (requestId === this.micRequestId) {
      await this.refreshDevices()
    }
    return acquired
  }

  private async requestMic(deviceId: string | undefined): Promise<MediaStream> {
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } })
      } catch (error) {
        const name = (error as DOMException).name
        if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw error
        // The remembered microphone is not connected anymore, fall back to the system default.
        this.setSelectedDeviceId(undefined)
      }
    }
    return navigator.mediaDevices.getUserMedia({ audio: true })
  }

  private async refreshDevices(): Promise<void> {
    const requestId = this.micRequestId
    let inputs: MediaDeviceInfo[] = []
    try {
      const devices = (await navigator.mediaDevices?.enumerateDevices?.()) ?? []
      // Without microphone permission browsers list placeholder entries with an empty deviceId.
      inputs = devices.filter(
        (device) => device.kind === 'audioinput' && device.deviceId !== '' && device.deviceId !== 'communications'
      )
    } catch {
      inputs = []
    }
    // cleanup() or a newer microphone request ran while waiting, so this result is stale.
    if (requestId === this.micRequestId) {
      this.audioInputs.set(inputs)
    }
  }

  private async handleDeviceChange(): Promise<void> {
    await this.refreshDevices()
    const active = this.activeDeviceId()
    if (this.isConnected() && active && !this.audioInputs().some((device) => device.deviceId === active)) {
      // The microphone in use was unplugged.
      this.stopMicStream()
      void this.acquireMic()
    }
  }

  private setSelectedDeviceId(deviceId: string | undefined): void {
    this.selectedDeviceId.set(deviceId)
    storeMicrophoneId(deviceId)
  }

  private stopMicStream(): void {
    const micStream = this.micStream()
    if (micStream && this.micStreamIsOwned) {
      this.stopTracks(micStream)
    }
    this.captureSource?.disconnect()
    this.captureSource = undefined
    this.micStream.set(undefined)
    this.activeDeviceId.set(undefined)
    this.micStreamIsOwned = false
  }

  private stopTracks(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
      track.stop()
    }
  }
}
