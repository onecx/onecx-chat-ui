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
import { VoiceService } from '../../services/voice.service'
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
  @Output() voiceChatStopped = new EventEmitter<void>()
  @Output() voiceChatPreparationStarted = new EventEmitter<{ attemptId: string }>()
  @Output() voiceChatStartRequested = new EventEmitter<{ attemptId: string; agentId: string }>()
  @Output() voiceChatStartFailed = new EventEmitter<{ attemptId: string }>()
  @Output() userTranscript = new EventEmitter<{ text: string; isFinal: boolean }>()
  @Output() botTranscript = new EventEmitter<{ text: string; spoken: boolean }>()

  // Bridge signals from service for the template
  readonly isConnecting = this.voiceService.isConnecting
  readonly isConnected = this.voiceService.isConnected
  readonly isMuted = this.voiceService.isMuted
  readonly micStream = this.voiceService.micStream

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
      this.permissions().includes('VOICE#USE') &&
      !!this.agentId &&
      this.agentId !== DEFAULT_AGENT_ID &&
      this.agentVoiceEnabled &&
      !!this.chatId &&
      (this.chatId !== 'new' || this.isAiChat)
    )
  }

  get recordButtonTooltipKey(): string {
    if (this.voiceChatEnabled) return 'VOICE.STOP_RECORDING_TOOLTIP'
    if (!this.permissions().includes('VOICE#USE')) return 'VOICE.START_REQUIRES_PERMISSION'
    if (!this.agentId || this.agentId === DEFAULT_AGENT_ID) return 'VOICE.START_REQUIRES_REAL_AGENT'
    if (!this.agentVoiceEnabled) return 'VOICE.START_AGENT_DISABLED'
    return this.canStart ? 'VOICE.START_RECORDING_TOOLTIP' : 'VOICE.START_REQUIRES_SAVED_CHAT'
  }

  constructor() {
    effect(() => {
      if (!this.permissions().includes('VOICE#USE') && (this.isConnected() || this.isConnecting())) {
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
    // The voice service ended the session, e.g. because the connection was lost
    this.voiceService.ended$.pipe(takeUntilDestroyed()).subscribe(() => this.voiceChatStopped.emit())
  }

  ngOnChanges(changes: SimpleChanges): void {
    const chatChange = changes['chatId']
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
      } catch {
        this.voiceChatStartFailed.emit({ attemptId })
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
      this.voiceChatStarted.emit()
    } catch (error) {
      this.voiceChatStopped.emit()
      throw error
    }
  }

  toggleMute(): void {
    this.voiceService.toggleMute()
  }

  private stop(): void {
    this.voiceService.cleanup()
    this.voiceChatStopped.emit()
  }
}
