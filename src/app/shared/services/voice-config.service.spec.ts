import { TestBed } from '@angular/core/testing'
import { AppConfigService, AppStateService } from '@onecx/angular-integration-interface'
import { of } from 'rxjs'

import { environment } from '../../../environments/environment'
import { parseVoiceEnabled, parseVoiceWsUrl, VoiceConfigService, voiceConfigInitializer } from './voice-config.service'

describe('VoiceConfigService', () => {
  const defaults = { voiceAiEnabled: environment.voiceAiEnabled, voiceWsUrl: environment.voiceWsUrl }
  let properties: Record<string, string>
  let appConfig: { init: jest.Mock; getProperty: jest.Mock }

  const createService = (options: { noAppConfig?: boolean } = {}): VoiceConfigService => {
    TestBed.configureTestingModule({
      providers: options.noAppConfig ? [] : [{ provide: AppConfigService, useValue: appConfig }]
    })
    return TestBed.inject(VoiceConfigService)
  }

  beforeEach(() => {
    properties = {}
    appConfig = {
      init: jest.fn().mockResolvedValue(undefined),
      getProperty: jest.fn((key: string) => properties[key])
    }
    environment.voiceAiEnabled = true
    environment.voiceWsUrl = 'wss://build.example.org/ws/voice'
  })

  afterEach(() => {
    environment.voiceAiEnabled = defaults.voiceAiEnabled
    environment.voiceWsUrl = defaults.voiceWsUrl
    jest.restoreAllMocks()
  })

  it('should not offer voice before an entry point has read the deployment configuration', () => {
    const service = createService()

    expect(service.voiceAiEnabled()).toBe(false)
    expect(appConfig.init).not.toHaveBeenCalled()
  })

  it('should read the configuration below the base URL of the entry point', async () => {
    properties['VOICE_AI_ENABLED'] = 'true'
    const service = createService()

    await service.init('https://host/mfe/chat/')

    expect(appConfig.init).toHaveBeenCalledWith('https://host/mfe/chat/')
    expect(service.voiceAiEnabled()).toBe(true)
  })

  it('should override the defaults with the values set through Helm', async () => {
    properties['VOICE_AI_ENABLED'] = 'false'
    properties['VOICE_WS_URL'] = 'wss://voice.example.org/ws/voice'
    const service = createService()

    await service.init('/')

    expect(service.voiceAiEnabled()).toBe(false)
    expect(service.voiceWsUrl()).toBe('wss://voice.example.org/ws/voice')
  })

  it('should keep the defaults for variables that were not set', async () => {
    properties['VOICE_AI_ENABLED'] = '${VOICE_AI_ENABLED}'
    properties['VOICE_WS_URL'] = '${VOICE_WS_URL}'
    const service = createService()

    await service.init('/')

    expect(service.voiceAiEnabled()).toBe(true)
    expect(service.voiceWsUrl()).toBe('wss://build.example.org/ws/voice')
  })

  it('should keep the defaults and not reject when the configuration cannot be read', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    appConfig.init.mockRejectedValue(new Error('offline'))
    const service = createService()

    await expect(service.init('/')).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalled()
    expect(service.voiceAiEnabled()).toBe(true)
    expect(service.voiceWsUrl()).toBe('wss://build.example.org/ws/voice')
  })

  it('should keep the defaults without an app configuration service', async () => {
    const service = createService({ noAppConfig: true })

    await service.init('/')

    expect(service.voiceAiEnabled()).toBe(true)
    expect(service.voiceWsUrl()).toBe('wss://build.example.org/ws/voice')
  })

  it('should keep voice disabled when the build default is disabled and nothing overrides it', async () => {
    environment.voiceAiEnabled = false
    const service = createService()

    await service.init('/')

    expect(service.voiceAiEnabled()).toBe(false)
  })
})

describe('voiceConfigInitializer', () => {
  it('should read the voice settings from the base URL of the current micro-frontend', async () => {
    const appState = {
      currentMfe$: { asObservable: () => of({ remoteBaseUrl: 'https://host/mfe/chat/' }) }
    } as unknown as AppStateService
    const voiceConfig = { init: jest.fn().mockResolvedValue(undefined) } as unknown as VoiceConfigService

    await voiceConfigInitializer(appState, voiceConfig)()

    expect(voiceConfig.init).toHaveBeenCalledWith('https://host/mfe/chat/')
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
