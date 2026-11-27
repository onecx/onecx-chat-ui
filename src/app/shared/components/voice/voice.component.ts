import {
  Component,
  computed,
  effect,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  signal,
  SimpleChanges,
  untracked
} from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { MenuItem } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { MenuModule } from 'primeng/menu'
import { TooltipModule } from 'primeng/tooltip'

import { VoiceWaveformComponent } from './voice-waveform.component'
import { sessionEndMessageKey, startErrorMessageKey, VoiceService } from '../../services/voice.service'
import { UserService } from '@onecx/angular-integration-interface'
import { DEFAULT_AGENT_ID } from 'src/app/chat/pages/chat-assistant/chat-assistant.state'
import { REMOTE_COMPONENT_CONFIG } from '@onecx/angular-utils'
import { map } from 'rxjs'

let voiceStartAttemptSequence = 0

@Component({
  selector: 'app-voice',
  templateUrl: './voice.component.html',
  styleUrl: './voice.component.scss',
  standalone: true,
  imports: [ButtonModule, MenuModule, TooltipModule, TranslateModule, VoiceWaveformComponent]
})
export class VoiceComponent implements OnChanges, OnDestroy {
  private readonly voiceService = inject(VoiceService)
  private readonly translateService = inject(TranslateService)
  private readonly remoteComponentConfig = inject(REMOTE_COMPONENT_CONFIG, { optional: true })
  private activeChatId: string | undefined
  private readonly permissions = toSignal(
    this.remoteComponentConfig
      ? this.remoteComponentConfig.pipe(map((config) => config.permissions))
      : inject(UserService).getPermissions(),
    { initialValue: [] as string[] }
  )

  @Input() chatId = ''
  @Input() isAiChat = false
  @Input() agentId = ''
  @Input() agentVoiceEnabled = false
  @Input() voiceChatEnabled = false
  @Input() voiceChatStartPending = false
  @Input() voiceChatStartError: string | undefined
  @Input() gatherContext = false
  @Input() contextAgentName = ''

  @Output() voiceChatStarted = new EventEmitter<void>()
  /** The focused voice view ends; the typed composer comes back. */
  @Output() voiceChatStopped = new EventEmitter<void>()
  /** A voice session is completely over and its turns are saved, so the chat history can be reloaded. */
  @Output() voiceSessionEnded = new EventEmitter<void>()
  @Output() voiceChatPreparationStarted = new EventEmitter<{ attemptId: string }>()
  @Output() voiceChatStartRequested = new EventEmitter<{ attemptId: string; agentId: string }>()
  @Output() voiceChatStartFailed = new EventEmitter<{ attemptId: string; messageKey?: string }>()
  @Output() userTranscript = new EventEmitter<{ text: string; isFinal: boolean }>()
  @Output() botTranscript = new EventEmitter<{ text: string; spoken: boolean }>()
  /** The user interrupted the assistant reply that is being shown. */
  @Output() assistantInterrupted = new EventEmitter<void>()

  // Bridge signals from service for the template
  readonly isConnecting = this.voiceService.isConnecting
  readonly isConnected = this.voiceService.isConnected
  readonly isMuted = this.voiceService.isMuted
  readonly micStream = this.voiceService.micStream
  readonly notice = this.voiceService.notice

  readonly hasPermission = computed(() => this.permissions().includes('VOICE#USE'))

  /** Translation key of the live status: muted, or listening, processing or speaking. */
  readonly statusKey = computed(() => {
    if (this.isMuted()) return 'VOICE.MUTED'
    switch (this.voiceService.activity()) {
      case 'processing':
        return 'VOICE.PROCESSING'
      case 'speaking':
        return 'VOICE.SPEAKING'
      default:
        return 'VOICE.LISTENING'
    }
  })
  readonly activity = this.voiceService.activity

  /**
   * Why the last voice session in this chat could not start or ended without the user stopping it;
   * cleared on the next start, on stop and when the chat changes.
   */
  readonly errorMessageKey = signal<string | undefined>(undefined)

  // The picker is always shown during voice chat and enabled as soon as the device list is known.
  readonly microphonesAvailable = computed(() => this.voiceService.audioInputs().length > 0)
  readonly microphoneMenuItems = computed<MenuItem[]>(() => {
    const activeDeviceId = this.voiceService.activeDeviceId()
    return this.voiceService.audioInputs().map((device, index) => {
      const label = device.label || this.translateService.instant('VOICE.MICROPHONE_FALLBACK', { index: index + 1 })
      const isActive = device.deviceId === activeDeviceId
      return {
        label: isActive ? this.translateService.instant('VOICE.MICROPHONE_SELECTED', { label }) : label,
        title: label,
        icon: isActive ? 'pi pi-check' : 'pi pi-fw',
        command: () => this.voiceService.selectDevice(device.deviceId)
      }
    })
  })

  get canStart(): boolean {
    return (
      this.hasPermission() &&
      !!this.agentId &&
      this.agentId !== DEFAULT_AGENT_ID &&
      this.agentVoiceEnabled &&
      !!this.chatId &&
      (this.chatId !== 'new' || this.isAiChat)
    )
  }

  get recordButtonTooltipKey(): string {
    if (this.voiceChatEnabled) return 'VOICE.STOP_RECORDING_TOOLTIP'
    if (!this.agentId || this.agentId === DEFAULT_AGENT_ID) return 'VOICE.START_REQUIRES_REAL_AGENT'
    if (!this.agentVoiceEnabled) return 'VOICE.START_AGENT_DISABLED'
    return this.canStart ? 'VOICE.START_RECORDING_TOOLTIP' : 'VOICE.START_REQUIRES_SAVED_CHAT'
  }

  constructor() {
    effect(() => {
      if (!this.hasPermission() && (this.isConnected() || this.isConnecting())) {
        untracked(() => this.stop())
      }
    })

    // Bridge transcript events
    this.voiceService.userTranscript$
      .pipe(takeUntilDestroyed())
      .subscribe((t) => this.userTranscript.emit({ text: t.text, isFinal: t.isFinal ?? false }))
    this.voiceService.botTranscript$
      .pipe(takeUntilDestroyed())
      .subscribe((t) => this.botTranscript.emit({ text: t.text, spoken: t.spoken ?? false }))
    this.voiceService.interrupted$.pipe(takeUntilDestroyed()).subscribe(() => this.assistantInterrupted.emit())
    // The voice service ended the session, e.g. because a session limit was reached or the connection was lost
    this.voiceService.ended$.pipe(takeUntilDestroyed()).subscribe((reason) => {
      this.errorMessageKey.set(sessionEndMessageKey(reason))
      this.voiceChatStopped.emit()
      const sessionChatId = this.activeChatId ?? this.chatId
      this.activeChatId = undefined
      if (sessionChatId === this.chatId) this.voiceSessionEnded.emit()
    })
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['voiceChatEnabled']?.currentValue) this.activeChatId = this.chatId
    const chatChange = changes['chatId']
    // The component stays mounted across chats; an end message belongs to the chat it happened in.
    if (chatChange && !chatChange.firstChange) this.errorMessageKey.set(undefined)
    if (
      chatChange &&
      !chatChange.firstChange &&
      (this.voiceService.isConnected() || this.voiceService.isConnecting())
    ) {
      if (this.voiceChatStartPending && chatChange.previousValue === 'new' && chatChange.currentValue !== 'new') {
        return
      }
      // The voice session belongs to the previous chat. Stopping it updates the parent's state,
      // which must not change while the parent is being checked, so it stops right afterwards.
      queueMicrotask(() => this.stop())
    }
  }

  ngOnDestroy(): void {
    this.voiceService.cleanup()
  }

  async onClick(): Promise<void> {
    if (this.voiceChatEnabled) {
      this.stop()
      return
    }

    // A disabled or loading p-button still receives clicks on its host element.
    if (!this.canStart || this.isConnecting()) return

    this.errorMessageKey.set(undefined)
    if (this.chatId === 'new') {
      const attemptId = `${Date.now()}-${++voiceStartAttemptSequence}`
      const agentId = this.agentId
      this.voiceChatPreparationStarted.emit({ attemptId })
      try {
        await this.voiceService.prepareStart(this.gatherContext ? this.contextAgentName : undefined)
        if (!this.canStart || this.agentId !== agentId) {
          this.voiceService.cleanup()
          this.voiceChatStartFailed.emit({ attemptId })
          return
        }
        this.voiceChatStartRequested.emit({ attemptId, agentId })
      } catch (error) {
        this.voiceChatStartFailed.emit({ attemptId, messageKey: startErrorMessageKey(error) })
      }
      return
    }

    const chatId = this.chatId
    const agentId = this.agentId
    try {
      await this.voiceService.prepareStart(this.gatherContext ? this.contextAgentName : undefined)
      if (!this.canStart || this.chatId !== chatId || this.agentId !== agentId) {
        this.stop()
        return
      }
      await this.voiceService.startPrepared(chatId, agentId)
      this.activeChatId = chatId
      this.voiceChatStarted.emit()
    } catch (error) {
      console.warn('Voice: the voice chat could not be started:', error)
      // Only shown while the chat it failed for is still open.
      if (this.chatId === chatId) this.errorMessageKey.set(startErrorMessageKey(error))
      this.voiceChatStopped.emit()
    }
  }

  toggleMute(): void {
    this.voiceService.toggleMute()
  }

  private stop(): void {
    this.errorMessageKey.set(undefined)
    const wasConnected = this.isConnected()
    const sessionChatId = this.activeChatId ?? this.chatId
    const closed = this.voiceService.stop()
    this.voiceChatStopped.emit()
    if (!wasConnected) return
    void closed.then(() => {
      // A voice chat started in the meantime keeps its live messages until it ends itself.
      if (this.activeChatId === sessionChatId) this.activeChatId = undefined
      if (!this.isConnected() && !this.isConnecting() && sessionChatId === this.chatId) {
        this.voiceSessionEnded.emit()
      }
    })
  }
}
