import {
  Component,
  computed,
  effect,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { MenuItem } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { MenuModule } from 'primeng/menu'
import { TooltipModule } from 'primeng/tooltip'

import { VoiceWaveformComponent } from './voice-waveform.component'
import { VoiceService } from '../../services/voice.service'

@Component({
  selector: 'app-voice',
  templateUrl: './voice.component.html',
  styleUrl: './voice.component.scss',
  standalone: true,
  imports: [ButtonModule, MenuModule, TooltipModule, TranslateModule, VoiceWaveformComponent]
})
export class VoiceComponent implements OnDestroy {
  private readonly voiceService = inject(VoiceService)
  private readonly translateService = inject(TranslateService)

  @Input() chatId = ''
  @Input() voiceChatEnabled = false

  @Output() voiceChatStarted = new EventEmitter<void>()
  @Output() voiceChatStopped = new EventEmitter<void>()
  @Output() userTranscript = new EventEmitter<{ text: string; isFinal: boolean }>()
  @Output() botTranscript = new EventEmitter<{ text: string; spoken: boolean }>()

  @ViewChild('botAudio') botAudioElement?: ElementRef<HTMLAudioElement>

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

  constructor() {
    // Sync bot stream to audio element
    effect(() => {
      const stream = this.voiceService.botStream()
      if (this.botAudioElement?.nativeElement) {
        this.botAudioElement.nativeElement.srcObject = stream ?? null
      }
    })

    // Bridge transcript events
    this.voiceService.userTranscript$
      .pipe(takeUntilDestroyed())
      .subscribe((t) => this.userTranscript.emit({ text: t.text, isFinal: t.isFinal ?? false }))
    this.voiceService.botTranscript$
      .pipe(takeUntilDestroyed())
      .subscribe((t) => this.botTranscript.emit({ text: t.text, spoken: t.spoken ?? false }))
  }

  ngOnDestroy(): void {
    this.voiceService.cleanup()
  }

  async onClick(): Promise<void> {
    if (this.voiceChatEnabled) {
      this.voiceService.cleanup()
      this.voiceChatStopped.emit()
      return
    }

    if (!this.chatId) return

    try {
      await this.voiceService.start(this.chatId)
      this.voiceChatStarted.emit()
    } catch (error) {
      this.voiceChatStopped.emit()
      throw error
    }
  }

  toggleMute(): void {
    this.voiceService.toggleMute()
  }
}
