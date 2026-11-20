import { computed, inject, Injectable, InjectionToken, Provider, signal } from '@angular/core'

import { environment } from '../../../environments/environment'

/** URL of this app's `assets/env.json`; without it the build-time defaults of `environment` apply. */
export const VOICE_CONFIG_URL = new InjectionToken<string>('VOICE_CONFIG_URL')

/**
 * Provides {@link VOICE_CONFIG_URL} next to the bundle the given `import.meta.url` belongs to, like
 * `provideTranslationPathFromMeta` does for the translations. Outside a served bundle (tests,
 * `file://`) nothing is provided and the build-time defaults apply.
 */
export function provideVoiceConfigFromMeta(url: string | undefined): Provider[] {
  if (!url || url.startsWith('file://')) return []
  return [{ provide: VOICE_CONFIG_URL, useValue: url.replace(/\/[^/]*$/, '') + '/assets/env.json' }]
}

/** The container sets these through Helm values; unset variables stay as `${NAME}` placeholders. */
interface VoiceEnvJson {
  VOICE_AI_ENABLED?: unknown
  VOICE_WS_URL?: unknown
}

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
 * `VOICE_AI_ENABLED` and `VOICE_WS_URL` in `assets/env.json`, which the docker-spa-base entrypoint
 * fills from the container environment (Helm `app.env`).
 */
@Injectable({ providedIn: 'root' })
export class VoiceConfigService {
  private readonly configUrl = inject(VOICE_CONFIG_URL, { optional: true })
  private readonly loaded = signal(false)
  private readonly enabled = signal(environment.voiceAiEnabled)

  readonly voiceAiEnabled = computed(() => this.loaded() && this.enabled())
  readonly voiceWsUrl = signal(environment.voiceWsUrl)

  constructor() {
    if (this.configUrl) {
      void this.load(this.configUrl)
    } else {
      this.loaded.set(true)
    }
  }

  private async load(url: string): Promise<void> {
    try {
      const response = await fetch(url, { cache: 'no-cache' })
      if (response.ok) {
        const config = (await response.json()) as VoiceEnvJson | null
        const enabled = parseVoiceEnabled(config?.VOICE_AI_ENABLED)
        if (enabled !== undefined) this.enabled.set(enabled)
        const wsUrl = parseVoiceWsUrl(config?.VOICE_WS_URL)
        if (wsUrl !== undefined) this.voiceWsUrl.set(wsUrl)
      }
    } catch (error) {
      console.warn('Voice: could not read the deployment configuration, using the defaults:', error)
    } finally {
      this.loaded.set(true)
    }
  }
}
