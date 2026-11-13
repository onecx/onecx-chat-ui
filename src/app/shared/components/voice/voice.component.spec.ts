import { ComponentFixture, TestBed } from '@angular/core/testing'
import { AuthProxyService } from '@onecx/angular-auth'
import { TranslateTestingModule } from 'ngx-translate-testing'

import { VoiceComponent } from './voice.component'
import { VoiceService } from '../../services/voice.service'
import { UserService } from '@onecx/angular-integration-interface'
import { BehaviorSubject, ReplaySubject } from 'rxjs'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'

describe('VoiceComponent', () => {
  let component: VoiceComponent
  let fixture: ComponentFixture<VoiceComponent>
  let voiceService: VoiceService
  let permissions: BehaviorSubject<string[]>

  beforeEach(async () => {
    permissions = new BehaviorSubject(['VOICE#USE'])
    await TestBed.configureTestingModule({
      imports: [
        VoiceComponent,
        TranslateTestingModule.withTranslations({
          en: require('./src/assets/i18n/en.json'),
          de: require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        VoiceService,
        { provide: AuthProxyService, useValue: {} },
        { provide: UserService, useValue: { getPermissions: () => permissions } }
      ]
    }).compileComponents()

    fixture = TestBed.createComponent(VoiceComponent)
    component = fixture.componentInstance
    voiceService = TestBed.inject(VoiceService)
    fixture.componentRef.setInput('agentId', 'agent-1')
    fixture.componentRef.setInput('agentVoiceEnabled', true)
    fixture.detectChanges()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should bridge the voice service signals to the template', () => {
    voiceService.isConnecting.set(true)
    voiceService.isConnected.set(true)
    voiceService.isMuted.set(true)

    expect(component.isConnecting()).toBe(true)
    expect(component.isConnected()).toBe(true)
    expect(component.isMuted()).toBe(true)
  })

  describe('onClick', () => {
    it.each(['chat-1', 'new'])('should block voice-disabled agents in chat "%s"', async (chatId) => {
      fixture.componentRef.setInput('chatId', chatId)
      fixture.componentRef.setInput('isAiChat', true)
      fixture.componentRef.setInput('agentVoiceEnabled', false)
      fixture.detectChanges()
      const start = jest.spyOn(voiceService, 'startPrepared')
      const prepare = jest.spyOn(voiceService, 'prepareStart')

      await component.onClick()

      expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(true)
      expect(component.recordButtonTooltipKey).toBe('VOICE.START_AGENT_DISABLED')
      expect(start).not.toHaveBeenCalled()
      expect(prepare).not.toHaveBeenCalled()
    })

    it.each(['', 'default'])('should never start voice with agent "%s"', async (agentId) => {
      fixture.componentRef.setInput('chatId', 'new')
      fixture.componentRef.setInput('isAiChat', true)
      fixture.componentRef.setInput('agentId', agentId)
      fixture.detectChanges()
      const start = jest.spyOn(voiceService, 'startPrepared')
      const prepare = jest.spyOn(voiceService, 'prepareStart')

      await component.onClick()

      expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(true)
      expect(component.recordButtonTooltipKey).toBe('VOICE.START_REQUIRES_REAL_AGENT')
      expect(start).not.toHaveBeenCalled()
      expect(prepare).not.toHaveBeenCalled()
    })

    it('should block voice without permission and react to permission changes', async () => {
      fixture.componentRef.setInput('chatId', 'chat-1')
      permissions.next(['CHAT#VIEW'])
      fixture.detectChanges()
      jest.spyOn(voiceService, 'prepareStart').mockResolvedValue()
      const start = jest.spyOn(voiceService, 'startPrepared').mockResolvedValue()

      await component.onClick()

      expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(true)
      expect(component.recordButtonTooltipKey).toBe('VOICE.START_REQUIRES_PERMISSION')
      expect(start).not.toHaveBeenCalled()

      permissions.next(['VOICE#USE'])
      fixture.detectChanges()
      await component.onClick()

      expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(false)
      expect(start).toHaveBeenCalledWith('chat-1', 'agent-1')
    })

    it('should cancel saved-chat startup when permission is revoked while waiting for the microphone', async () => {
      component.chatId = 'chat-1'
      let finishPreparation!: () => void
      jest.spyOn(voiceService, 'prepareStart').mockReturnValue(
        new Promise<void>((resolve) => {
          finishPreparation = resolve
        })
      )
      const start = jest.spyOn(voiceService, 'startPrepared').mockResolvedValue()
      const cleanup = jest.spyOn(voiceService, 'cleanup')
      const started = jest.spyOn(component.voiceChatStarted, 'emit')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

      const pendingStart = component.onClick()
      expect(start).not.toHaveBeenCalled()
      permissions.next([])
      finishPreparation()
      await pendingStart

      expect(cleanup).toHaveBeenCalledTimes(1)
      expect(stopped).toHaveBeenCalledTimes(1)
      expect(start).not.toHaveBeenCalled()
      expect(started).not.toHaveBeenCalled()
    })

    it('should cancel preparation when permission is revoked while waiting for the microphone', async () => {
      component.chatId = 'new'
      component.isAiChat = true
      jest.spyOn(voiceService, 'prepareStart').mockImplementation(async () => {
        permissions.next([])
      })
      const cleanup = jest.spyOn(voiceService, 'cleanup')
      const requested = jest.spyOn(component.voiceChatStartRequested, 'emit')
      const failed = jest.spyOn(component.voiceChatStartFailed, 'emit')

      await component.onClick()

      expect(cleanup).toHaveBeenCalled()
      expect(requested).not.toHaveBeenCalled()
      expect(failed).toHaveBeenCalled()
    })

    it.each([true, false])('should allow manual stop with voice permission granted: %s', async (hasPermission) => {
      permissions.next(hasPermission ? ['VOICE#USE'] : [])
      const cleanup = jest.spyOn(voiceService, 'cleanup')
      const started = jest.spyOn(component.voiceChatStarted, 'emit')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')
      fixture.componentRef.setInput('voiceChatEnabled', true)
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(false)
      await component.onClick()

      expect(cleanup).toHaveBeenCalledTimes(1)
      expect(stopped).toHaveBeenCalledTimes(1)
      expect(started).not.toHaveBeenCalled()
    })

    it.each(['', 'new'])('should not start a voice session for the unsaved chat id "%s"', async (chatId) => {
      const start = jest.spyOn(voiceService, 'startPrepared')
      component.chatId = chatId

      await component.onClick()

      expect(start).not.toHaveBeenCalled()
    })

    it('should not start another voice session while one is connecting', async () => {
      const start = jest.spyOn(voiceService, 'startPrepared')
      component.chatId = 'chat-1'
      voiceService.isConnecting.set(true)

      await component.onClick()

      expect(start).not.toHaveBeenCalled()
    })

    it('should start the voice session for the chat and agent and emit voiceChatStarted', async () => {
      const prepare = jest.spyOn(voiceService, 'prepareStart').mockResolvedValue()
      const start = jest.spyOn(voiceService, 'startPrepared').mockResolvedValue()
      const started = jest.spyOn(component.voiceChatStarted, 'emit')
      component.chatId = 'chat-1'
      component.agentId = 'agent-1'

      await component.onClick()

      expect(prepare).toHaveBeenCalledWith(undefined)
      expect(start).toHaveBeenCalledWith('chat-1', 'agent-1')
      expect(prepare.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[0])
      expect(started).toHaveBeenCalled()
    })

    it('should pass the context agent to start the voice session when page context is gathered', async () => {
      const prepare = jest.spyOn(voiceService, 'prepareStart').mockResolvedValue()
      const start = jest.spyOn(voiceService, 'startPrepared').mockResolvedValue()
      component.chatId = 'chat-1'
      component.agentId = 'agent-1'
      component.gatherContext = true
      component.contextAgentName = 'assistant'

      await component.onClick()

      expect(prepare).toHaveBeenCalledWith('assistant')
      expect(start).toHaveBeenCalledWith('chat-1', 'agent-1')
    })

    it('should pass the context agent to prepare audio when page context is gathered for a new chat', async () => {
      const prepare = jest.spyOn(voiceService, 'prepareStart').mockResolvedValue()
      component.chatId = 'new'
      component.isAiChat = true
      component.agentId = 'agent-1'
      component.gatherContext = true
      component.contextAgentName = 'assistant'

      await component.onClick()

      expect(prepare).toHaveBeenCalledWith('assistant')
    })

    it('should not pass the context agent to prepare audio for a new chat without page context', async () => {
      const prepare = jest.spyOn(voiceService, 'prepareStart').mockResolvedValue()
      component.chatId = 'new'
      component.isAiChat = true
      component.agentId = 'agent-1'
      component.contextAgentName = 'assistant'

      await component.onClick()

      expect(prepare).toHaveBeenCalledWith(undefined)
    })

    it('should prepare audio before requesting creation of a new AI chat', async () => {
      const order: string[] = []
      jest.spyOn(component.voiceChatPreparationStarted, 'emit').mockImplementation(() => {
        order.push('preparation-started')
      })
      jest.spyOn(voiceService, 'prepareStart').mockImplementation(async () => {
        order.push('prepare-audio')
      })
      const requested = jest.spyOn(component.voiceChatStartRequested, 'emit').mockImplementation(() => {
        order.push('create-chat')
      })
      component.chatId = 'new'
      component.isAiChat = true
      component.agentId = 'agent-1'

      await component.onClick()

      expect(order).toEqual(['preparation-started', 'prepare-audio', 'create-chat'])
      expect(voiceService.prepareStart).toHaveBeenCalledTimes(1)
      expect(requested).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'agent-1' }))
    })

    it('should report a preparation failure without requesting chat creation', async () => {
      const failed = jest.spyOn(component.voiceChatStartFailed, 'emit')
      const requested = jest.spyOn(component.voiceChatStartRequested, 'emit')
      jest.spyOn(voiceService, 'prepareStart').mockRejectedValue(new Error('microphone unavailable'))
      component.chatId = 'new'
      component.isAiChat = true
      component.agentId = 'agent-1'

      await component.onClick()

      expect(failed).toHaveBeenCalled()
      expect(requested).not.toHaveBeenCalled()
    })

    it.each(['prepareStart', 'startPrepared'] as const)(
      'should emit voiceChatStopped and rethrow when %s fails',
      async (method) => {
        const failure = new Error('voice start failed')
        jest.spyOn(voiceService, 'prepareStart').mockResolvedValue()
        jest.spyOn(voiceService, 'startPrepared').mockResolvedValue()
        const failingMethod = jest.spyOn(voiceService, method).mockRejectedValue(failure)
        const started = jest.spyOn(component.voiceChatStarted, 'emit')
        const stopped = jest.spyOn(component.voiceChatStopped, 'emit')
        component.chatId = 'chat-1'

        await expect(component.onClick()).rejects.toThrow('voice start failed')

        expect(failingMethod).toHaveBeenCalled()
        expect(stopped).toHaveBeenCalled()
        expect(started).not.toHaveBeenCalled()
      }
    )
  })

  describe('toggleMute', () => {
    it('should delegate to the voice service', () => {
      const toggleMute = jest.spyOn(voiceService, 'toggleMute')

      component.toggleMute()

      expect(toggleMute).toHaveBeenCalled()
    })
  })

  describe('transcript bridging', () => {
    it('should re-emit user transcripts from the service', () => {
      const emit = jest.spyOn(component.userTranscript, 'emit')

      voiceService.userTranscript$.next({ text: 'hello', isFinal: false })

      expect(emit).toHaveBeenCalledWith({ text: 'hello', isFinal: false })
    })

    it('should re-emit bot transcripts from the service', () => {
      const emit = jest.spyOn(component.botTranscript, 'emit')

      voiceService.botTranscript$.next({ text: 'hi there', spoken: true })

      expect(emit).toHaveBeenCalledWith({ text: 'hi there', spoken: true })
    })

    it('should default to non-final / un-spoken when the field is missing', () => {
      const userEmit = jest.spyOn(component.userTranscript, 'emit')
      const botEmit = jest.spyOn(component.botTranscript, 'emit')

      voiceService.userTranscript$.next({ text: 'partial' } as never)
      voiceService.botTranscript$.next({ text: 'partial' } as never)

      expect(userEmit).toHaveBeenCalledWith({ text: 'partial', isFinal: false })
      expect(botEmit).toHaveBeenCalledWith({ text: 'partial', spoken: false })
    })
  })

  it('should emit voiceChatStopped when the voice service ends the session', () => {
    const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

    voiceService.ended$.next('connection_closed')

    expect(stopped).toHaveBeenCalled()
  })

  it('should clean up the voice service on destroy', () => {
    const cleanup = jest.spyOn(voiceService, 'cleanup')

    component.ngOnDestroy()

    expect(cleanup).toHaveBeenCalled()
  })

  describe('permission changes', () => {
    it.each(['isConnected', 'isConnecting'] as const)(
      'should stop the voice session when voice permission is revoked (%s)',
      (state) => {
        voiceService[state].set(true)
        fixture.detectChanges()
        const cleanup = jest.spyOn(voiceService, 'cleanup')
        const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

        permissions.next(['CHAT#VIEW'])
        fixture.detectChanges()
        fixture.detectChanges()

        expect(cleanup).toHaveBeenCalledTimes(1)
        expect(stopped).toHaveBeenCalledTimes(1)
        expect(voiceService.isConnected()).toBe(false)
        expect(voiceService.isConnecting()).toBe(false)
      }
    )

    it('should leave the session running when voice permission is retained', () => {
      voiceService.isConnected.set(true)
      const cleanup = jest.spyOn(voiceService, 'cleanup')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

      permissions.next(['VOICE#USE', 'CHAT#VIEW'])
      fixture.detectChanges()

      expect(cleanup).not.toHaveBeenCalled()
      expect(stopped).not.toHaveBeenCalled()
      expect(voiceService.isConnected()).toBe(true)
    })

    it('should not emit a stop when permission is revoked without an active session', () => {
      const cleanup = jest.spyOn(voiceService, 'cleanup')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

      permissions.next([])
      fixture.detectChanges()

      expect(cleanup).not.toHaveBeenCalled()
      expect(stopped).not.toHaveBeenCalled()
    })
  })

  describe('chat change', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('chatId', 'chat-1')
      fixture.detectChanges()
    })

    it.each(['isConnected', 'isConnecting'] as const)(
      'should stop the voice session of the previous chat once the change is checked (%s)',
      async (state) => {
        voiceService[state].set(true)
        const cleanup = jest.spyOn(voiceService, 'cleanup')
        const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

        fixture.componentRef.setInput('chatId', 'chat-2')
        fixture.detectChanges()
        expect(stopped).not.toHaveBeenCalled()
        await Promise.resolve()

        expect(cleanup).toHaveBeenCalled()
        expect(stopped).toHaveBeenCalled()
      }
    )

    it('should not stop anything when no voice session is active', async () => {
      const cleanup = jest.spyOn(voiceService, 'cleanup')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

      fixture.componentRef.setInput('chatId', 'chat-2')
      fixture.detectChanges()
      await Promise.resolve()

      expect(cleanup).not.toHaveBeenCalled()
      expect(stopped).not.toHaveBeenCalled()
    })

    it('should retain a pending voice start when the new chat receives its persisted id', async () => {
      fixture.componentRef.setInput('chatId', 'new')
      fixture.componentRef.setInput('voiceChatStartPending', true)
      fixture.detectChanges()
      voiceService.isConnecting.set(true)
      const cleanup = jest.spyOn(voiceService, 'cleanup')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

      fixture.componentRef.setInput('chatId', 'created-chat')
      fixture.detectChanges()
      await Promise.resolve()

      expect(cleanup).not.toHaveBeenCalled()
      expect(stopped).not.toHaveBeenCalled()
    })
  })

  describe('template bindings', () => {
    it('should disable the record button with a hint until the chat is saved', () => {
      fixture.componentRef.setInput('chatId', 'new')
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(true)
      expect(component.recordButtonTooltipKey).toBe('VOICE.START_REQUIRES_SAVED_CHAT')
    })

    it('should enable the record button for a new AI chat only', () => {
      fixture.componentRef.setInput('chatId', 'new')
      fixture.componentRef.setInput('isAiChat', true)
      fixture.componentRef.setInput('agentId', 'agent-1')
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(false)
    })

    it('should enable the record button for a saved chat', () => {
      fixture.componentRef.setInput('chatId', 'chat-1')
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(false)
      expect(component.recordButtonTooltipKey).toBe('VOICE.START_RECORDING_TOOLTIP')
    })

    it('should show the stop recording state when voice chat is enabled', () => {
      fixture.componentRef.setInput('voiceChatEnabled', true)
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('app-voice-waveform')).not.toBeNull()
      expect(fixture.nativeElement.querySelector('.voice-record-button')).not.toBeNull()
    })

    it('should hide the waveform when voice chat is disabled', () => {
      fixture.componentRef.setInput('voiceChatEnabled', false)
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('app-voice-waveform')).toBeNull()
      expect(fixture.nativeElement.querySelector('.voice-mute-button')).toBeNull()
    })

    it('should label the stop button and show the live indicator when voice chat is enabled', () => {
      fixture.componentRef.setInput('voiceChatEnabled', true)
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('.voice-live')).not.toBeNull()
      expect(fixture.nativeElement.querySelector('.voice-record-button').textContent).toContain('Stop')
    })

    it('should announce the listening and muted state to assistive technology', () => {
      fixture.componentRef.setInput('voiceChatEnabled', true)
      voiceService.isMuted.set(false)
      fixture.detectChanges()
      const status = fixture.nativeElement.querySelector('output.voice-live-status')
      expect(status.textContent).toContain('Listening')

      voiceService.isMuted.set(true)
      fixture.detectChanges()

      expect(status.textContent).toContain('Muted')
    })

    it('should mark the mute button and live indicator as muted', () => {
      fixture.componentRef.setInput('voiceChatEnabled', true)
      voiceService.isMuted.set(false)
      fixture.detectChanges()
      expect(fixture.nativeElement.querySelector('.voice-mute-button-muted')).toBeNull()

      voiceService.isMuted.set(true)
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('.voice-mute-button-muted')).not.toBeNull()
      expect(fixture.nativeElement.querySelector('.voice-live-muted')).not.toBeNull()
    })
  })

  describe('microphone selection', () => {
    const input = (deviceId: string, label: string): MediaDeviceInfo =>
      ({ deviceId, label, kind: 'audioinput', groupId: '' }) as MediaDeviceInfo

    beforeEach(() => {
      fixture.componentRef.setInput('voiceChatEnabled', true)
    })

    it('should show the selector right away but disabled until the microphone list is known', () => {
      voiceService.audioInputs.set([])
      fixture.detectChanges()

      const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.voice-mic-button')
      expect(button).not.toBeNull()
      expect(button.disabled).toBe(true)
    })

    it('should enable the selector once microphones are available', () => {
      voiceService.audioInputs.set([input('a', 'Built-in'), input('b', 'Headset')])
      fixture.detectChanges()

      const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.voice-mic-button')
      expect(button.disabled).toBe(false)
    })

    it('should not offer a selector while voice chat is inactive', () => {
      fixture.componentRef.setInput('voiceChatEnabled', false)
      voiceService.audioInputs.set([input('a', 'Built-in'), input('b', 'Headset')])
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('.voice-mic-button')).toBeNull()
    })

    it('should build menu items with the active microphone checked and a fallback label', () => {
      voiceService.audioInputs.set([input('a', 'Built-in'), input('b', '')])
      voiceService.activeDeviceId.set('a')

      const items = component.microphoneMenuItems()

      expect(items.map((item) => item.label)).toEqual(['Built-in (selected)', 'Microphone 2'])
      expect(items.map((item) => item.title)).toEqual(['Built-in', 'Microphone 2'])
      expect(items.map((item) => item.icon)).toEqual(['pi pi-check', 'pi pi-fw'])
    })

    it('should select the microphone when its menu item is chosen', () => {
      jest.spyOn(voiceService, 'selectDevice').mockImplementation(() => undefined)
      voiceService.audioInputs.set([input('a', 'Built-in'), input('b', 'Headset')])

      component.microphoneMenuItems()[1].command?.({} as any)

      expect(voiceService.selectDevice).toHaveBeenCalledWith('b')
    })
  })
})

describe('VoiceComponent remote permissions', () => {
  let fixture: ComponentFixture<VoiceComponent>
  let config: ReplaySubject<RemoteComponentConfig>
  let globalPermissions: BehaviorSubject<string[]>

  beforeEach(async () => {
    config = new ReplaySubject<RemoteComponentConfig>(1)
    globalPermissions = new BehaviorSubject<string[]>([])
    await TestBed.configureTestingModule({
      imports: [VoiceComponent, TranslateTestingModule.withTranslations('en', {})],
      providers: [
        VoiceService,
        { provide: AuthProxyService, useValue: {} },
        { provide: UserService, useValue: { getPermissions: () => globalPermissions } },
        { provide: REMOTE_COMPONENT_CONFIG, useValue: config }
      ]
    }).compileComponents()
    fixture = TestBed.createComponent(VoiceComponent)
    fixture.componentRef.setInput('chatId', 'chat-1')
    fixture.componentRef.setInput('agentId', 'agent-1')
    fixture.componentRef.setInput('agentVoiceEnabled', true)
    fixture.detectChanges()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  function setRemotePermissions(permissions: string[]): void {
    config.next({ appId: 'chat', productName: 'chat', baseUrl: '/chat', permissions })
    fixture.detectChanges()
  }

  it('should allow voice with chat permissions even when the active app does not grant voice', async () => {
    setRemotePermissions(['VOICE#USE'])
    jest.spyOn(TestBed.inject(VoiceService), 'prepareStart').mockResolvedValue()
    const start = jest.spyOn(TestBed.inject(VoiceService), 'startPrepared').mockResolvedValue()

    await fixture.componentInstance.onClick()

    expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(false)
    expect(start).toHaveBeenCalledWith('chat-1', 'agent-1')
  })

  it('should not inherit voice permission from the active app', async () => {
    globalPermissions.next(['VOICE#USE'])
    setRemotePermissions(['CHAT#VIEW'])
    const start = jest.spyOn(TestBed.inject(VoiceService), 'startPrepared')

    await fixture.componentInstance.onClick()

    expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(true)
    expect(fixture.componentInstance.recordButtonTooltipKey).toBe('VOICE.START_REQUIRES_PERMISSION')
    expect(start).not.toHaveBeenCalled()
  })

  it('should block voice until remote permissions arrive and react to their revocation', () => {
    globalPermissions.next(['VOICE#USE'])
    fixture.detectChanges()
    expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(true)

    setRemotePermissions(['VOICE#USE'])
    expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(false)

    setRemotePermissions([])
    expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(true)
  })

  it('should stop an active session when remote voice permission is revoked despite global permission', () => {
    globalPermissions.next(['VOICE#USE'])
    setRemotePermissions(['VOICE#USE'])
    const voiceService = TestBed.inject(VoiceService)
    voiceService.isConnected.set(true)
    fixture.detectChanges()
    const cleanup = jest.spyOn(voiceService, 'cleanup')
    const stopped = jest.spyOn(fixture.componentInstance.voiceChatStopped, 'emit')

    setRemotePermissions([])

    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(stopped).toHaveBeenCalledTimes(1)
    expect(voiceService.isConnected()).toBe(false)
  })
})
