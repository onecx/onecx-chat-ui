import { Injectable, OnDestroy, signal } from '@angular/core'
import { Subject } from 'rxjs'

export interface Transcript {
  text: string
  isFinal?: boolean
  spoken?: boolean
}

const SELECTED_MICROPHONE_STORAGE_KEY = 'onecx-chat-ui.voice.microphone'

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

/**
 * Voice backend client.
 *
 * NOTE(#789): the real pipecat/voice-BFF WebSocket integration is intentionally
 * mocked out for now. `start()` simulates a connection delay and drives the UI
 * state (connecting/connected/muted) plus the local microphone stream used for
 * the waveform. It then plays a scripted user/bot transcript exchange through
 * the `userTranscript$`/`botTranscript$` Subjects so the full voice-conversation
 * UI is demonstrable. A real backend would instead push live transcripts.
 */
@Injectable({ providedIn: 'root' })
export class VoiceService implements OnDestroy {
  // State signals
  readonly isConnecting = signal(false)
  readonly isConnected = signal(false)
  readonly isMuted = signal(false)
  readonly micStream = signal<MediaStream | undefined>(undefined)
  readonly botStream = signal<MediaStream | undefined>(undefined)

  // Microphone selection. Device labels are only exposed by the browser once microphone
  // permission has been granted, so the list is refreshed after the microphone was acquired.
  readonly audioInputs = signal<MediaDeviceInfo[]>([])
  readonly selectedDeviceId = signal<string | undefined>(readStoredMicrophoneId())
  readonly activeDeviceId = signal<string | undefined>(undefined)

  // Transcript subjects — the mock emits a scripted exchange through these.
  readonly userTranscript$ = new Subject<Transcript>()
  readonly botTranscript$ = new Subject<Transcript>()

  private micStreamIsOwned = false
  private micRequestId = 0
  private timers: Array<ReturnType<typeof setTimeout>> = []

  private readonly onDeviceChange = (): void => {
    void this.handleDeviceChange()
  }

  start(chatId: string): Promise<void> {
    if (this.isConnected()) return Promise.resolve()

    this.isConnecting.set(true)

    // Simulate backend connection latency. A real client would establish the
    // WebSocket to the voice BFF here.
    this.schedule(() => {
      this.isConnecting.set(false)
      this.isConnected.set(true)
      this.isMuted.set(false)
      navigator.mediaDevices?.addEventListener?.('devicechange', this.onDeviceChange)
      void this.acquireMic()
      this.runScriptedExchange()
    }, 600)

    return Promise.resolve()
  }

  toggleMute(): void {
    this.isMuted.update((v) => !v)
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

  cleanup(): void {
    for (const timer of this.timers) {
      clearTimeout(timer)
    }
    this.timers = []

    navigator.mediaDevices?.removeEventListener?.('devicechange', this.onDeviceChange)
    this.micRequestId++
    this.stopMicStream()
    this.audioInputs.set([])
    this.botStream.set(undefined)

    this.isConnecting.set(false)
    this.isConnected.set(false)
    this.isMuted.set(false)
    this.userTranscript$.next({ text: '', isFinal: false })
  }

  ngOnDestroy(): void {
    this.cleanup()
  }

  /**
   * Requests the local microphone for the waveform visualization. This is pure
   * UI (not the backend). A failure must never block the connect flow — if the
   * mic is unavailable (permission denied, no device, insecure context) the
   * waveform simply stays idle.
   */
  private async acquireMic(): Promise<void> {
    const requestId = ++this.micRequestId
    try {
      const stream = await this.requestMic(this.selectedDeviceId())
      if (requestId !== this.micRequestId) {
        // Superseded by a newer selection or by cleanup() while the permission prompt was open.
        this.stopTracks(stream)
        return
      }
      this.micStreamIsOwned = true
      this.micStream.set(stream)
      this.activeDeviceId.set(stream.getTracks()[0]?.getSettings?.().deviceId ?? this.selectedDeviceId())
    } catch (error) {
      console.warn('Voice: unable to access microphone, waveform will stay idle:', error)
      if (requestId === this.micRequestId) {
        this.micStream.set(undefined)
      }
    }
    if (requestId === this.micRequestId) {
      await this.refreshDevices()
    }
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
    try {
      const devices = (await navigator.mediaDevices?.enumerateDevices?.()) ?? []
      this.audioInputs.set(
        devices.filter((device) => device.kind === 'audioinput' && device.deviceId !== 'communications')
      )
    } catch {
      this.audioInputs.set([])
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

  /**
   * Plays a short scripted conversation so the mock is demonstrable end to
   * end. Real user/bot transcripts from the backend would arrive through the
   * same Subjects with the same event shapes.
   */
  private runScriptedExchange(): void {
    const userText = 'This is a mock message to show the voice chat UI.'
    const botText = 'Once the voice backend is implemented, this mock conversation will be replaced. Stay tuned.'

    const userChunks = splitIntoChunks(userText)
    userChunks.forEach((chunk, i) => {
      this.schedule(
        () => {
          this.userTranscript$.next({
            text: userChunks.slice(0, i + 1).join(' '),
            isFinal: false
          })
        },
        1400 + i * 420
      )
    })
    this.schedule(
      () => {
        this.userTranscript$.next({ text: userText, isFinal: true })
      },
      1400 + userChunks.length * 420
    )

    // The bot replies, streamed into the same message.
    // A real backend marks sentences that have already been read aloud with
    // `spoken: true` so the reducer skips them (they arrive again via the
    // normal message flow once the stream ends) — see the reducer spec for that
    // path. Here the sentence is un-spoken so it renders in the bubble.
    const botBase = 3600
    const botSentences = botText.split('. ').map((s) => s + (s.endsWith('.') ? '' : '.'))
    botSentences.forEach((sentence, i) => {
      this.schedule(
        () => {
          this.botTranscript$.next({ text: sentence, spoken: false })
        },
        botBase + i * 900
      )
    })
  }

  private schedule(fn: () => void, delay: number): void {
    this.timers.push(setTimeout(fn, delay))
  }

  private stopMicStream(): void {
    const micStream = this.micStream()
    if (micStream && this.micStreamIsOwned) {
      this.stopTracks(micStream)
    }
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

function splitIntoChunks(text: string, size = 4): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(' '))
  }
  return chunks
}
