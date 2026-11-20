import { computed, inject, Injectable, signal } from '@angular/core'
import { AppConfigService, AppStateService } from '@onecx/angular-integration-interface'
import { firstValueFrom } from 'rxjs'

import { environment } from '../../../environments/environment'

function isSet(value: unknown): value is string | boolean {
  if (typeof value === 'boolean') return true
  return typeof value === 'string' && value.trim() !== '' && !value.trim().startsWith('${')
}

export function parseVoiceEnabled(value: unknown): boolean | undefined {
  if (!isSet(value)) return undefined
  if (typeof value === 'boolean') return value
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return undefined
}

export function parseVoiceWsUrl(value: unknown): string | undefined {
  return isSet(value) && typeof value === 'string' ? value.trim() : undefined
}

/**
 * Voice settings of this deployment: the build-time defaults from `environment`, overridden by
 * `VOICE_AI_ENABLED` and `VOICE_WS_URL` in `assets/env.json`. The docker-spa-base entrypoint fills
 * that file from the container environment (Helm `app.env`).
 *
 * Each entry point calls {@link init} with this app's base URL.
 */
@Injectable({ providedIn: 'root' })
export class VoiceConfigService {
  // The root instance, provided by AngularAcceleratorModule.
  private readonly appConfig = inject(AppConfigService, { optional: true })
  private readonly loaded = signal(false)
  private readonly enabled = signal(environment.voiceAiEnabled)

  readonly voiceAiEnabled = computed(() => this.loaded() && this.enabled())
  readonly voiceWsUrl = signal(environment.voiceWsUrl)

  async init(baseUrl: string): Promise<void> {
    try {
      if (this.appConfig) {
        await this.appConfig.init(baseUrl)
        const enabled = parseVoiceEnabled(this.appConfig.getProperty('VOICE_AI_ENABLED'))
        if (enabled !== undefined) this.enabled.set(enabled)
        const wsUrl = parseVoiceWsUrl(this.appConfig.getProperty('VOICE_WS_URL'))
        if (wsUrl !== undefined) this.voiceWsUrl.set(wsUrl)
      }
    } catch (error) {
      console.warn('Voice: could not read the deployment configuration, using the defaults:', error)
    } finally {
      this.loaded.set(true)
    }
  }
}

/** App initializer of the chat micro-frontend: reads the voice settings from its own base URL. */
export function voiceConfigInitializer(appStateService: AppStateService, voiceConfig: VoiceConfigService) {
  return async (): Promise<void> => {
    const mfe = await firstValueFrom(appStateService.currentMfe$.asObservable())
    await voiceConfig.init(mfe.remoteBaseUrl)
  }
}
