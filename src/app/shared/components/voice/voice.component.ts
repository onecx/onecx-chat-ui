import { CommonModule, Location } from '@angular/common';
import { Component, inject, input, OnDestroy } from '@angular/core';
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

@Component({
  selector: 'app-voice',
  templateUrl: './voice.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TranslateModule,
    DropdownModule,
    MenuModule,
    SharedModule,
  ],
})
export class VoiceComponent implements OnDestroy {
  private readonly authProxyService = inject(AuthProxyService);
  private readonly baseUrl: ReplaySubject<string> = inject(BASE_URL) as any as ReplaySubject<string>;

  chat = input.required<Chat>();
  isConnected = false;
  isRecording = false;
  pipecatClient: PipecatClient;
  botAudio: HTMLAudioElement;

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
          console.log('Connected');
        },
        onDisconnected: () => {
          console.log('Disconnected');
        },
        onBotReady: (data) => {
          console.log('Bot is ready:', data);
          this.setupMediaTracks();
        },
        onUserTranscript: (data) => {
          console.log(`User Transcript: ${data.text}`);
        },
        onBotTranscript: (data) => console.log(`Bot: ${data.text}`),
        onMessageError: (error) => console.error('Message error:', error),
        onError: (error) => console.error('Error:', error),
      },
    };
    this.pipecatClient = new PipecatClient(PipecatConfig);
    this.setupTrackListeners();
  }

  ngOnDestroy(): void {
    if (this.isConnected) {
      this.pipecatClient.disconnect();
    }
  }

  public async onClick() {
    if (!this.isRecording) {
      try {
        if (!this.isConnected) {
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
          await this.pipecatClient.startBotAndConnect({
            endpoint: Location.joinWithSlash(baseUrl, 'voice-bff/connect'),
            requestData: {
              body: {
                headers: this.authProxyService.getHeaderValues(),
                chatId,
              },
            },
          });
          this.isConnected = true;
          this.isRecording = true;
        }
      } catch (error) {
        this.isConnected = false;
        this.isRecording = false;
        console.error('Error initializing voice connection:', error);
      }
    } else {
      this.pipecatClient.enableMic(false);
      this.isRecording = false;
    }
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
}
