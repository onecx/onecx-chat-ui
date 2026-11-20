import { TestBed } from '@angular/core/testing'

import { environment } from '../../../environments/environment'
import {
  parseVoiceEnabled,
  parseVoiceWsUrl,
  provideVoiceConfigFromMeta,
  VOICE_CONFIG_URL,
  VoiceConfigService
} from './voice-config.service'

describe('VoiceConfigService', () => {
  const originalFetch = globalThis.fetch
  const defaults = { voiceAiEnabled: environment.voiceAiEnabled, voiceWsUrl: environment.voiceWsUrl }
  let fetchMock: jest.Mock

  const respond = (body: unknown, ok = true) => fetchMock.mockResolvedValue({ ok, json: async () => body })
  const createService = (configUrl?: string): VoiceConfigService => {
    TestBed.configureTestingModule({
      providers: configUrl ? [{ provide: VOICE_CONFIG_URL, useValue: configUrl }] : []
    })
    return TestBed.inject(VoiceConfigService)
  }
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve))

  beforeEach(() => {
    fetchMock = jest.fn()
    globalThis.fetch = fetchMock
    environment.voiceAiEnabled = true
    environment.voiceWsUrl = 'wss://build.example.org/ws/voice'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    environment.voiceAiEnabled = defaults.voiceAiEnabled
    environment.voiceWsUrl = defaults.voiceWsUrl
    jest.restoreAllMocks()
  })

  it('should use the build-time defaults without a deployment configuration', () => {
    const service = createService()

    expect(service.voiceAiEnabled()).toBe(true)
    expect(service.voiceWsUrl()).toBe('wss://build.example.org/ws/voice')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should not offer voice before the deployment configuration was read', async () => {
    respond({ VOICE_AI_ENABLED: 'true' })
    const service = createService('https://host/mfe/chat/assets/env.json')

    expect(service.voiceAiEnabled()).toBe(false)
    await settle()

    expect(service.voiceAiEnabled()).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('https://host/mfe/chat/assets/env.json', { cache: 'no-cache' })
  })

  it('should override the defaults with the values set through Helm', async () => {
    respond({ VOICE_AI_ENABLED: 'false', VOICE_WS_URL: 'wss://voice.example.org/ws/voice' })
    const service = createService('/assets/env.json')
    await settle()

    expect(service.voiceAiEnabled()).toBe(false)
    expect(service.voiceWsUrl()).toBe('wss://voice.example.org/ws/voice')
  })

  it('should keep the defaults for variables that were not set', async () => {
    respond({ VOICE_AI_ENABLED: '${VOICE_AI_ENABLED}', VOICE_WS_URL: '${VOICE_WS_URL}' })
    const service = createService('/assets/env.json')
    await settle()

    expect(service.voiceAiEnabled()).toBe(true)
    expect(service.voiceWsUrl()).toBe('wss://build.example.org/ws/voice')
  })

  it.each([
    ['a missing file', () => respond(null, false)],
    ['an empty file', () => respond(null)],
    ['a failed request', () => fetchMock.mockRejectedValue(new Error('offline'))]
  ])('should keep the defaults after %s', async (_, arrange) => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    arrange()
    const service = createService('/assets/env.json')
    await settle()

    expect(service.voiceAiEnabled()).toBe(true)
    expect(service.voiceWsUrl()).toBe('wss://build.example.org/ws/voice')
  })
})

describe('parseVoiceEnabled', () => {
  it.each([
    ['true', true],
    [' TRUE ', true],
    ['false', false],
    [true, true],
    [false, false],
    ['yes', undefined],
    ['', undefined],
    ['${VOICE_AI_ENABLED}', undefined],
    [undefined, undefined],
    [1, undefined]
  ])('should read %p as %p', (value, expected) => {
    expect(parseVoiceEnabled(value)).toBe(expected)
  })
})

describe('parseVoiceWsUrl', () => {
  it.each([
    [' wss://voice.example.org/ws/voice ', 'wss://voice.example.org/ws/voice'],
    ['', undefined],
    ['${VOICE_WS_URL}', undefined],
    [true, undefined],
    [undefined, undefined]
  ])('should read %p as %p', (value, expected) => {
    expect(parseVoiceWsUrl(value)).toBe(expected)
  })
})

describe('provideVoiceConfigFromMeta', () => {
  it('should point next to the bundle', () => {
    expect(provideVoiceConfigFromMeta('https://host/mfe/chat/main.js')).toEqual([
      { provide: VOICE_CONFIG_URL, useValue: 'https://host/mfe/chat/assets/env.json' }
    ])
  })

  it.each([undefined, '', 'file:///work/src/main.ts'])('should provide nothing for %p', (url) => {
    expect(provideVoiceConfigFromMeta(url)).toEqual([])
  })
})
