import { inject, Injectable, signal } from '@angular/core';
import { AuthProxyService } from '@onecx/angular-auth';
import { UserService } from '@onecx/angular-integration-interface';
import { BASE_URL } from '@onecx/angular-remote-components';
import {
  Participant,
  PipecatClient,
  PipecatClientOptions,
} from '@pipecat-ai/client-js';
import { WebSocketTransport } from '@pipecat-ai/websocket-transport';
import { Location } from '@angular/common';
import { firstValueFrom, ReplaySubject, Subject } from 'rxjs';

export interface Transcript {
  text: string;
  isFinal?: boolean;
  spoken?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class VoiceService {
  private readonly authProxyService = inject(AuthProxyService);
  private readonly userService = inject(UserService);
  private readonly baseUrl$ = inject(BASE_URL) as any as ReplaySubject<string>;

  private pipecatClient?: PipecatClient;

  // State Signals
  readonly isConnecting = signal(false);
  readonly isConnected = signal(false);
  readonly isMuted = signal(false);
  readonly micStream = signal<MediaStream | undefined>(undefined);
  readonly botStream = signal<MediaStream | undefined>(undefined);

  // Transcript Subjects
  readonly userTranscript$ = new Subject<Transcript>();
  readonly botTranscript$ = new Subject<Transcript>();

  private micStreamIsOwned = false;

  private handleBotAudio = (
    track: MediaStreamTrack,
    participant?: Participant,
  ): void => {
    if (!participant || participant.local || track.kind !== 'audio') {
      return;
    }
    this.botStream.set(new MediaStream([track]));
  };

  private getPipecatConfig(chatId: string): PipecatClientOptions {
    return {
      transport: new WebSocketTransport(),
      enableMic: false,
      enableCam: false,
      callbacks: {
        onConnected: () => {
          console.log('Pipecat Connected');
        },
        onDisconnected: () => {
          console.log('Pipecat Disconnected');
          this.isConnecting.set(false);
        },
        onBotReady: () => {
          this.pipecatClient?.sendClientMessage('chat_meta', {
            chatId: chatId,
            access_token: (
              this.authProxyService.getHeaderValues()['Authorization'] ?? ''
            ).replace(/^Bearer /, ''),
          });
          this.isConnecting.set(false);
        },
        onTrackStarted: this.handleBotAudio,
        onUserTranscript: (data) => {
          this.userTranscript$.next({ text: data.text, isFinal: data.final });
        },
        onBotOutput: (data) => {
          this.botTranscript$.next({ text: data.text, spoken: data.spoken });
        },
        onMessageError: (error) => console.error('Message error:', error),
        onError: (error) => console.error('Pipecat Error:', error),
      },
    };
  }

  async start(chatId: string) {
    if (this.isConnected()) return;

    try {
      this.isConnecting.set(true);
      
      if (!this.pipecatClient) {
        this.pipecatClient = new PipecatClient(this.getPipecatConfig(chatId));
      }

      await this.pipecatClient.initDevices();
      this.pipecatClient.enableMic(true);

      const baseUrl = await firstValueFrom(this.baseUrl$);
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

      this.isConnected.set(true);
      this.isMuted.set(false);
      await this.getMicStream();
    } catch (error) {
      this.cleanup();
      console.error('Error initializing voice connection:', error);
      throw error;
    }
  }

  toggleMute(): void {
    const newMutedState = !this.isMuted();
    this.isMuted.set(newMutedState);
    this.pipecatClient?.enableMic(!newMutedState);
  }

  cleanup() {
    this.pipecatClient?.enableMic(false);
    if (this.isConnected()) {
      this.pipecatClient?.disconnect();
    }
    this.pipecatClient = undefined;

    this.stopMicStream();
    this.botStream.set(undefined);

    this.isConnected.set(false);
    this.isConnecting.set(false);
    this.isMuted.set(false);

    this.userTranscript$.next({ text: '', isFinal: false });
  }

  private stopMicStream(): void {
    if (this.micStream() && this.micStreamIsOwned) {
      for (const track of this.micStream()?.getTracks() ?? []) {
        track.stop();
      }
    }
    this.micStream.set(undefined);
    this.micStreamIsOwned = false;
  }

  private async getMicStream(): Promise<MediaStream> {
    const tracks = (this.pipecatClient as any)?.tracks?.();
    const userTrack: MediaStreamTrack | undefined =
      tracks?.user?.audio ?? tracks?.local?.audio;
    
    if (userTrack) {
      this.micStreamIsOwned = false;
      const stream = new MediaStream([userTrack]);
      this.micStream.set(stream);
      return stream;
    }
    
    this.micStreamIsOwned = true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micStream.set(stream);
    return stream;
  }
}
