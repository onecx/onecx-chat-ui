import { inject, Injectable, Injector, NgZone, OnDestroy, runInInjectionContext, signal } from '@angular/core'
import { AuthProxyService } from '@onecx/angular-auth'
import { Subject } from 'rxjs'

import { environment } from '../../../environments/environment'
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

/** An event of the voice service's WebSocket protocol (onecx-pipecat, version 2). */
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
  private readonly injector = inject(Injector)
  private readonly zone = inject(NgZone)

  // State signals
  readonly isConnecting = signal(false)
  readonly isConnected = signal(false)
  readonly isMuted = signal(false)
  readonly micStream = signal<MediaStream | undefined>(undefined)

  // Microphone selection. Device labels are only exposed by the browser once microphone
  // permission has been granted, so the list is refreshed after the microphone was acquired.
  readonly audioInputs = signal<MediaDeviceInfo[]>([])
  readonly selectedDeviceId = signal<string | undefined>(readStoredMicrophoneId())
  readonly activeDeviceId = signal<string | undefined>(undefined)

  readonly userTranscript$ = new Subject<Transcript>()
  readonly botTranscript$ = new Subject<Transcript>()
  /** Emits the reason when the voice service ends the session; `cleanup()` does not emit. */
  readonly ended$ = new Subject<string>()

  private micStreamIsOwned = false
  private micRequestId = 0

  // Incremented by release(), so async work of an earlier session can tell it is stale.
  private generation = 0
  private socket: WebSocket | undefined
  private pendingStart: PendingStart | undefined
  private ready = false
  private principalToken = ''
  private refreshTimer: ReturnType<typeof setInterval> | undefined
  private refreshing = false

  private audioContext: AudioContext | undefined
  private captureNode: AudioWorkletNode | undefined
  private captureSource: MediaStreamAudioSourceNode | undefined
  private readonly playing = new Set<AudioBufferSourceNode>()
  private playhead = 0

  private userTurnActive = false
  private userTurnFinals: string[] = []

  private readonly onDeviceChange = (): void => {
    void this.handleDeviceChange()
  }

  async start(chatId: string, agentId: string): Promise<void> {
    if (this.isConnected() || this.isConnecting()) return

    const generation = this.generation
    this.isConnecting.set(true)
    try {
      if (!agentId) throw new Error('Voice: no agent selected')
      // Created before the first await, while the click that started the voice chat still
      // counts as a user gesture; otherwise the browser may keep the audio suspended.
      const context = new AudioContext()
      this.audioContext = context
      void context.resume().catch(() => undefined)

      const micAcquired = await this.acquireMic()
      this.assertCurrent(generation)
      if (!micAcquired) throw new Error('Voice: microphone unavailable')
      await this.startCapture(context, generation)
      await this.updateTokens()
      this.assertCurrent(generation)
      await this.openSession(chatId, agentId)
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

  /** Stops the voice chat on the user's request. Does not emit `ended$`. */
  cleanup(): void {
    this.release()
    this.userTranscript$.next({ text: '', isFinal: false })
  }

  ngOnDestroy(): void {
    this.cleanup()
  }

  // -- session ------------------------------------------------------------

  private openSession(chatId: string, agentId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Outside Angular: audio arrives every few milliseconds and must not trigger change detection.
      this.zone.runOutsideAngular(() => {
        const timer = setTimeout(
          () => this.settleStart(new Error('Voice: the voice service did not respond')),
          SESSION_READY_TIMEOUT_MS
        )
        this.pendingStart = { resolve, reject, timer }
        const socket = new WebSocket(this.socketUrl())
        socket.onopen = () => this.sendStartSession(chatId, agentId)
        socket.onmessage = (message: MessageEvent) => this.onSocketMessage(message)
        socket.onclose = () => this.zone.run(() => this.finish('connection_closed'))
        this.socket = socket
      })
    })
  }

  private socketUrl(): string {
    if (environment.voiceWsUrl) return environment.voiceWsUrl
    // Same origin as the app: http: becomes ws:, https: becomes wss:.
    return `${location.protocol.replace('http', 'ws')}//${location.host}/ws/voice`
  }

  private sendStartSession(chatId: string, agentId: string): void {
    const { apmPrincipalToken, authorization } = this.readTokens()
    this.principalToken = apmPrincipalToken
    this.send({
      type: 'start_session',
      chat_id: chatId,
      agent_id: agentId,
      apm_principal_token: apmPrincipalToken,
      authorization
    })
  }

  private onSocketMessage(message: MessageEvent): void {
    const event = parseEvent(message.data)
    if (!event) return
    if (event.kind === 'assistant_audio') {
      this.play(event)
    } else if (event.kind === 'interrupted') {
      this.stopPlayback()
    } else {
      this.zone.run(() => this.handleEvent(event))
    }
  }

  private handleEvent(event: VoiceEvent): void {
    switch (event.kind) {
      case 'session_ready':
        this.ready = true
        this.settleStart()
        break
      case 'transcript':
        this.onTranscript(event.text ?? '', event.state === 'FINAL')
        break
      case 'user_started_speaking':
        this.userTurnActive = true
        this.userTurnFinals = []
        // Closes the current assistant message, so the next reply gets its own message.
        this.userTranscript$.next({ text: '', isFinal: false })
        break
      case 'user_stopped_speaking':
        this.endUserTurn()
        break
      case 'assistant_text':
        if (event.text) this.botTranscript$.next({ text: event.text, spoken: false })
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
        // bot_started_speaking, bot_stopped_speaking and turn_complete need no handling.
        break
    }
  }

  private onServerError(event: VoiceEvent): void {
    const error = new Error(`Voice: ${event.code}: ${event.message}`)
    if (this.pendingStart) {
      // The session could not start; the socket may stay open (e.g. for a malformed request).
      this.settleStart(error)
    } else {
      console.warn(error.message)
    }
  }

  /** The voice service ended the session, or the connection was lost. */
  private finish(reason: string): void {
    if (this.pendingStart) {
      this.settleStart(new Error(`Voice: the session closed (${reason})`))
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
    if (generation !== this.generation) throw new Error('Voice: start cancelled')
  }

  private send(message: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }

  /** Ends the session locally and frees the socket, audio graph and microphone. Emits nothing. */
  private release(): void {
    this.generation++
    this.settleStart(new Error('Voice: start cancelled'))
    clearInterval(this.refreshTimer)
    this.refreshTimer = undefined
    this.closeSocket()
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
    this.audioContext?.close().catch(() => undefined)
    this.audioContext = undefined
    this.userTurnActive = false
    this.userTurnFinals = []
    this.principalToken = ''

    this.isConnecting.set(false)
    this.isConnected.set(false)
    this.isMuted.set(false)
  }

  private closeSocket(): void {
    const socket = this.socket
    this.socket = undefined
    if (!socket) return
    socket.onopen = null
    socket.onmessage = null
    socket.onclose = null
    if (this.ready && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'stop' }))
    }
    this.ready = false
    socket.close(1000)
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
