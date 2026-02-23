import { CommonModule, Location } from '@angular/common';
import { Component, inject, input, OnDestroy, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  PipecatClient,
  PipecatClientOptions,
  RTVIEvent,
} from '@pipecat-ai/client-js';
import { WebSocketTransport } from '@pipecat-ai/websocket-transport';
import { SharedModule } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { MenuModule } from 'primeng/menu';
import { Chat } from '../../generated';
import { firstValueFrom, ReplaySubject } from 'rxjs';
import { AuthProxyService } from '@onecx/angular-auth';
import { BASE_URL } from '@onecx/angular-remote-components';
import { VoiceWaveformComponent } from './voice-waveform.component';
import { UserService } from '@onecx/angular-integration-interface';

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
  private readonly authProxyService = inject(AuthProxyService);
  private readonly userService = inject(UserService);
  private readonly baseUrl: ReplaySubject<string> = inject(
    BASE_URL,
  ) as any as ReplaySubject<string>;

  chat = input.required<Chat>();
  isConnecting = false;
  isConnected = false;
  isMuted = false;
  voiceChatEnabled = input.required<boolean>();

  toggleVoiceChat = output<boolean>();
  userTranscript = output<{ text: string; isFinal: boolean }>();
  botTranscript = output<{ text: string; spoken: boolean }>();

  pipecatClient: PipecatClient;
  botAudio: HTMLAudioElement;
  micStream?: MediaStream;
  private micStreamIsOwned = false;

  constructor() {
    this.botAudio = document.createElement('audio');
    this.botAudio.autoplay = true;
    document.body.appendChild(this.botAudio);
    const PipecatConfig: PipecatClientOptions = {
      transport: new WebSocketTransport(),
      enableMic: false,
      enableCam: false,
      callbacks: {
        onConnected: () => {
          console.log('Pipecat Connected');
        },
        onDisconnected: () => {
          console.log('Pipecat Disconnected');
          this.isConnecting = false;
        },
        onBotReady: (data) => {
          this.pipecatClient.sendClientMessage('chat_meta', {
            chatId: this.chat().id,
            access_token: (
              this.authProxyService.getHeaderValues()['Authorization'] ?? ''
            ).replace(/^Bearer /, ''),
          });
          this.setupMediaTracks();
          this.isConnecting = false;
        },
        onUserTranscript: (data) => {
          this.userTranscript.emit({ text: data.text, isFinal: data.final });
        },
        onBotOutput: (data) => {
          this.botTranscript.emit({ text: data.text, spoken: data.spoken });
        },
        onMessageError: (error) => console.error('Message error:', error),
        onError: (error) => console.error('Pipecat Error:', error),
      },
    };
    this.pipecatClient = new PipecatClient(PipecatConfig);
    this.setupTrackListeners();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  public async onClick() {
    if (!this.voiceChatEnabled()) {
      try {
        if (!this.isConnected) {
          this.isConnecting = true;
          await this.pipecatClient.initDevices();
        }
        this.pipecatClient.enableMic(true);
        if (!this.isConnected) {
          const chatId = this.chat().id;
          if (!chatId) {
            return;
          }
          const baseUrl = await firstValueFrom(this.baseUrl);
          await this.authProxyService.updateTokenIfNeeded();
          const language = await firstValueFrom(this.userService.lang$);
          await this.pipecatClient.startBotAndConnect({
            endpoint: Location.joinWithSlash(baseUrl, 'voice-bff/connect'),
            requestData: {
              access_token: (
                this.authProxyService.getHeaderValues()['Authorization'] ?? ''
              ).replace(/^Bearer /, ''),
              language,
            },
          });
          this.isConnected = true;
          this.toggleVoiceChat.emit(true);
          await this.getMicStream();
        }
      } catch (error) {
        this.stopMicStream();
        this.isConnected = false;
        this.toggleVoiceChat.emit(false);
        this.isConnecting = false;
        console.error('Error initializing voice connection:', error);
      }
    } else {
      this.cleanup();
    }
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.pipecatClient.enableMic(!this.isMuted);
  }

  /**
   * Cleans up media tracks, disconnects the client, and resets the component state
   */
  private cleanup() {
    // Disable pipecat mic and disconnect from the session
    this.pipecatClient.enableMic(false);
    if (this.isConnected) {
      this.pipecatClient.disconnect();
    }

    // Cleanup audio element and kill mic stream
    this.botAudio.srcObject = null;
    if (document.body.contains(this.botAudio)) {
      document.body.removeChild(this.botAudio);
    }
    this.stopMicStream();

    // Reset component state to initial values and notify parent components
    this.isConnected = false;
    this.isConnecting = false;
    this.isMuted = false;
    this.toggleVoiceChat.emit(false);

    // Publish an empty user message to ensure that any loading animations are cleared and current bot messages are marked as finalized
    // isFinal is intentionally set to false to avoid creating a new persistent user message in the chat historyI
    this.userTranscript.emit({ text: '', isFinal: false });
  }

  /**
   * Check for available media tracks and set them up if present
   * This is called when the bot is ready or when the transport state changes to ready
   */
  setupMediaTracks() {
    if (!this.pipecatClient) return;
    const tracks = this.pipecatClient.tracks();
    if (tracks.bot?.audio) {
      this.setupAudioTrack(tracks.bot.audio);
    }
  }

  /**
   * Set up listeners for track events (start/stop)
   * This handles new tracks being added during the session
   */
  setupTrackListeners() {
    if (!this.pipecatClient) return;

    // Listen for new tracks starting
    this.pipecatClient.on(RTVIEvent.TrackStarted, (track, participant) => {
      // Only handle non-local (bot) tracks
      if (!participant?.local && track.kind === 'audio') {
        this.setupAudioTrack(track);
      }
    });

    // Listen for tracks stopping
    this.pipecatClient.on(RTVIEvent.TrackStopped, (track, participant) => {
      console.log(
        `Track stopped: ${track.kind} from ${participant?.name || 'unknown'}`,
      );
    });
  }

  /**
   * Set up an audio track for playback
   * Handles both initial setup and track updates
   */
  private setupAudioTrack(track: MediaStreamTrack): void {
    console.log('Setting up audio track');
    if (
      this.botAudio.srcObject &&
      'getAudioTracks' in this.botAudio.srcObject
    ) {
      const oldTrack = this.botAudio.srcObject.getAudioTracks()[0];
      if (oldTrack?.id === track.id) return;
    }
    this.botAudio.srcObject = new MediaStream([track]);
  }

  private stopMicStream(): void {
    if (this.micStream && this.micStreamIsOwned) {
      for (const track of this.micStream.getTracks()) {
        track.stop();
      }
    }
    this.micStream = undefined;
    this.micStreamIsOwned = false;
  }

  private async getMicStream(): Promise<MediaStream> {
    const tracks = (this.pipecatClient as any)?.tracks?.();
    const userTrack: MediaStreamTrack | undefined =
      tracks?.user?.audio ?? tracks?.local?.audio;
    if (userTrack) {
      this.micStreamIsOwned = false;
      this.micStream = new MediaStream([userTrack]);
      return this.micStream;
    }
    this.micStreamIsOwned = true;
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return this.micStream;
  }
}
