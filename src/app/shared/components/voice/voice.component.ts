import { CommonModule } from '@angular/common';
import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { MenuModule } from 'primeng/menu';
import { Chat } from '../../generated';
import { VoiceWaveformComponent } from './voice-waveform.component';
import { VoiceService } from '../../services/voice.service';

@Component({
  selector: 'app-voice',
  templateUrl: './voice.component.html',
  styleUrl: './voice.component.css',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TranslateModule,
    DropdownModule,
    MenuModule,
    SharedModule,
    VoiceWaveformComponent,
  ],
})
export class VoiceComponent implements OnDestroy {
  private readonly voiceService = inject(VoiceService);

  chat = input.required<Chat>();
  voiceChatEnabled = input.required<boolean>();

  toggleVoiceChat = output<boolean>();
  userTranscript = output<{ text: string; isFinal: boolean }>();
  botTranscript = output<{ text: string; spoken: boolean }>();

  @ViewChild('botAudio') botAudioElement!: ElementRef<HTMLAudioElement>;

  // Bridge signals from service for template
  isConnecting = this.voiceService.isConnecting;
  isConnected = this.voiceService.isConnected;
  isMuted = this.voiceService.isMuted;
  micStream = this.voiceService.micStream;

  constructor() {
    // Sync bot stream to audio element
    effect(() => {
      const stream = this.voiceService.botStream();
      if (this.botAudioElement?.nativeElement) {
        this.botAudioElement.nativeElement.srcObject = stream ?? null;
      }
    });

    // Bridge transcript events
    this.voiceService.userTranscript$.subscribe((t) =>
      this.userTranscript.emit({ text: t.text, isFinal: t.isFinal ?? false }),
    );
    this.voiceService.botTranscript$.subscribe((t) =>
      this.botTranscript.emit({ text: t.text, spoken: t.spoken ?? false }),
    );
  }

  ngOnDestroy(): void {
    this.voiceService.cleanup();
  }

  public async onClick() {
    if (!this.voiceChatEnabled()) {
      try {
        const chatId = this.chat().id;
        if (!chatId) return;

        await this.voiceService.start(chatId);
        this.toggleVoiceChat.emit(true);
      } catch (error) {
        this.toggleVoiceChat.emit(false);
      }
    } else {
      this.voiceService.cleanup();
      this.toggleVoiceChat.emit(false);
    }
  }

  public toggleMute(): void {
    this.voiceService.toggleMute();
  }
}

