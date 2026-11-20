import { ComponentFixture, TestBed } from '@angular/core/testing'
import { AuthProxyService } from '@onecx/angular-auth'
import { TranslateService } from '@ngx-translate/core'
import { TranslateTestingModule } from 'ngx-translate-testing'

import { VoiceComponent } from './voice.component'
import { VoiceService, VoiceStartError } from '../../services/voice.service'
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

    it('should hide voice without permission and react to permission changes', async () => {
      fixture.componentRef.setInput('chatId', 'chat-1')
      permissions.next(['CHAT#VIEW'])
      fixture.detectChanges()
      jest.spyOn(voiceService, 'prepareStart').mockResolvedValue()
      const start = jest.spyOn(voiceService, 'startPrepared').mockResolvedValue()

      await component.onClick()

      expect(fixture.nativeElement.querySelector('button.voice-record-button')).toBeNull()
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
      const stop = jest.spyOn(voiceService, 'stop')
      const started = jest.spyOn(component.voiceChatStarted, 'emit')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

      const pendingStart = component.onClick()
      expect(start).not.toHaveBeenCalled()
      permissions.next([])
      finishPreparation()
      await pendingStart

      expect(stop).toHaveBeenCalledTimes(1)
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
      const stop = jest.spyOn(voiceService, 'stop')
      const started = jest.spyOn(component.voiceChatStarted, 'emit')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')
      fixture.componentRef.setInput('voiceChatEnabled', true)
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(false)
      await component.onClick()

      expect(stop).toHaveBeenCalledTimes(1)
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
      'should emit voiceChatStopped and show the failure when %s fails',
      async (method) => {
        jest.spyOn(console, 'warn').mockImplementation(() => undefined)
        const failure = new Error('voice start failed')
        jest.spyOn(voiceService, 'prepareStart').mockResolvedValue()
        jest.spyOn(voiceService, 'startPrepared').mockResolvedValue()
        const failingMethod = jest.spyOn(voiceService, method).mockRejectedValue(failure)
        const started = jest.spyOn(component.voiceChatStarted, 'emit')
        const stopped = jest.spyOn(component.voiceChatStopped, 'emit')
        component.chatId = 'chat-1'

        await expect(component.onClick()).resolves.toBeUndefined()

        expect(failingMethod).toHaveBeenCalled()
        expect(stopped).toHaveBeenCalled()
        expect(started).not.toHaveBeenCalled()
        expect(component.errorMessageKey()).toBe('VOICE.START_FAILED')
      }
    )

    it.each([
      ['voice_not_permitted', 'VOICE.START_ERRORS.NOT_PERMITTED'],
      ['unsupported_language', 'VOICE.START_ERRORS.UNSUPPORTED_LANGUAGE'],
      ['config_unavailable', 'VOICE.START_ERRORS.CONFIG_UNAVAILABLE'],
      ['microphone_unavailable', 'VOICE.START_ERRORS.MICROPHONE']
    ])('should show the typed start failure "%s" of a saved chat', async (code, key) => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      jest.spyOn(voiceService, 'prepareStart').mockResolvedValue()
      jest.spyOn(voiceService, 'startPrepared').mockRejectedValue(new VoiceStartError(code, `Voice: ${code}`))
      fixture.componentRef.setInput('chatId', 'chat-1')
      fixture.detectChanges()

      await component.onClick()
      fixture.detectChanges()

      const alert = fixture.nativeElement.querySelector('output.voice-error[role="alert"]')
      expect(alert.textContent.trim()).toBe(TestBed.inject(TranslateService).instant(key))
      expect(alert.textContent.trim()).not.toBe(key)
    })

    it('should not show a failure when the start was cancelled', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      jest.spyOn(voiceService, 'prepareStart').mockResolvedValue()
      jest
        .spyOn(voiceService, 'startPrepared')
        .mockRejectedValue(new VoiceStartError('cancelled', 'Voice: start cancelled'))
      component.chatId = 'chat-1'

      await component.onClick()

      expect(component.errorMessageKey()).toBeUndefined()
    })

    it('should not show the failure of a start that belongs to a chat the user has left', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      let failStart!: (error: Error) => void
      jest.spyOn(voiceService, 'prepareStart').mockResolvedValue()
      jest.spyOn(voiceService, 'startPrepared').mockReturnValue(new Promise<void>((_, reject) => (failStart = reject)))
      component.chatId = 'chat-1'

      const pendingStart = component.onClick()
      await Promise.resolve()
      component.chatId = 'chat-2'
      failStart(new VoiceStartError('voice_not_permitted', 'Voice: voice_not_permitted'))
      await pendingStart

      expect(component.errorMessageKey()).toBeUndefined()
    })

    it('should pass the typed failure of a new-chat preparation on', async () => {
      const failed = jest.spyOn(component.voiceChatStartFailed, 'emit')
      jest
        .spyOn(voiceService, 'prepareStart')
        .mockRejectedValue(new VoiceStartError('microphone_unavailable', 'Voice: microphone unavailable'))
      component.chatId = 'new'
      component.isAiChat = true

      await component.onClick()

      expect(failed).toHaveBeenCalledWith({
        attemptId: expect.any(String),
        messageKey: 'VOICE.START_ERRORS.MICROPHONE'
      })
    })
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

  it('should report an interruption of the shown assistant reply', () => {
    const interrupted = jest.spyOn(component.assistantInterrupted, 'emit')

    voiceService.interrupted$.next()

    expect(interrupted).toHaveBeenCalledTimes(1)
  })

  describe('stop', () => {
    it('should return to typed chat at once and report the session end once the voice service closed it', async () => {
      voiceService.isConnected.set(true)
      let closeSession!: () => void
      const stop = jest.spyOn(voiceService, 'stop').mockImplementation(() => {
        voiceService.isConnected.set(false)
        return new Promise<void>((resolve) => (closeSession = resolve))
      })
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')
      const ended = jest.spyOn(component.voiceSessionEnded, 'emit')
      component.voiceChatEnabled = true

      await component.onClick()

      expect(stop).toHaveBeenCalledTimes(1)
      expect(stopped).toHaveBeenCalledTimes(1)
      expect(ended).not.toHaveBeenCalled()

      closeSession()
      await Promise.resolve()
      await Promise.resolve()

      expect(ended).toHaveBeenCalledTimes(1)
    })

    it('should not report a session end when no session was running', async () => {
      jest.spyOn(voiceService, 'stop').mockResolvedValue()
      const ended = jest.spyOn(component.voiceSessionEnded, 'emit')
      component.voiceChatEnabled = true

      await component.onClick()
      await Promise.resolve()

      expect(ended).not.toHaveBeenCalled()
    })

    it('should not report the end of a stopped session while a new one is starting', async () => {
      voiceService.isConnected.set(true)
      let closeSession!: () => void
      jest.spyOn(voiceService, 'stop').mockImplementation(() => {
        voiceService.isConnected.set(false)
        return new Promise<void>((resolve) => (closeSession = resolve))
      })
      const ended = jest.spyOn(component.voiceSessionEnded, 'emit')
      component.voiceChatEnabled = true

      await component.onClick()
      voiceService.isConnecting.set(true)
      closeSession()
      await Promise.resolve()
      await Promise.resolve()

      expect(ended).not.toHaveBeenCalled()
    })
  })

  it('should emit voiceChatStopped when the voice service ends the session', () => {
    const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

    voiceService.ended$.next('connection_closed')

    expect(stopped).toHaveBeenCalled()
  })

  describe('session end outcomes', () => {
    const KEYS = [
      'VOICE.ENDED.MAX_DURATION',
      'VOICE.ENDED.IDLE_TIMEOUT',
      'VOICE.ENDED.AUDIO_TOO_LARGE',
      'VOICE.ENDED.TOKEN_EXPIRED',
      'VOICE.ENDED.CONNECTION_LOST',
      'VOICE.ENDED.FAILED'
    ]

    function text(key: string, language = 'en'): string {
      const translate = TestBed.inject(TranslateService)
      translate.use(language)
      return translate.instant(key)
    }

    function alerts(): string[] {
      return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('output[role="alert"]')).map((alert) =>
        (alert.textContent ?? '').trim()
      )
    }

    it.each([
      ['session_max_duration', 'VOICE.ENDED.MAX_DURATION'],
      ['session_idle_timeout', 'VOICE.ENDED.IDLE_TIMEOUT'],
      ['audio_message_too_large', 'VOICE.ENDED.AUDIO_TOO_LARGE'],
      ['token_expired', 'VOICE.ENDED.TOKEN_EXPIRED'],
      ['connection_closed', 'VOICE.ENDED.CONNECTION_LOST'],
      ['context_inconsistent', 'VOICE.ENDED.FAILED'],
      ['pipeline_ended', 'VOICE.ENDED.FAILED'],
      ['closed', 'VOICE.ENDED.FAILED']
    ])('should end the session and show a clear message when it ended with "%s"', (reason, key) => {
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')
      const ended = jest.spyOn(component.voiceSessionEnded, 'emit')

      voiceService.ended$.next(reason)
      fixture.detectChanges()

      expect(stopped).toHaveBeenCalled()
      expect(ended).toHaveBeenCalled()
      expect(alerts()).toEqual([text(key)])
      expect(text(key)).not.toBe(key)
    })

    it.each(['en', 'de'])('should have a distinct %s message per outcome', (language) => {
      const texts = KEYS.map((key) => text(key, language))
      expect(new Set(texts).size).toBe(KEYS.length)
      texts.forEach((message, index) => expect(message).not.toBe(KEYS[index]))
    })

    it('should not show a message when the session ended because the user stopped it', () => {
      voiceService.ended$.next('client_stopped')
      fixture.detectChanges()

      expect(alerts()).toEqual([])
    })

    it('should keep showing an end message without voice permission', () => {
      voiceService.ended$.next('token_expired')
      permissions.next([])
      fixture.detectChanges()

      expect(alerts()).toEqual([text('VOICE.ENDED.TOKEN_EXPIRED')])
      expect(fixture.nativeElement.querySelector('button.voice-record-button')).toBeNull()
    })

    it('should not show the message of the previous chat after the chat changes', () => {
      fixture.componentRef.setInput('chatId', 'chat-1')
      fixture.detectChanges()
      voiceService.ended$.next('session_max_duration')
      fixture.detectChanges()
      expect(alerts()).toEqual([text('VOICE.ENDED.MAX_DURATION')])

      fixture.componentRef.setInput('chatId', 'chat-2')
      fixture.detectChanges()

      expect(alerts()).toEqual([])
    })

    it('should clear the message when the user starts voice chat again', async () => {
      fixture.componentRef.setInput('chatId', 'chat-1')
      fixture.detectChanges()
      voiceService.ended$.next('session_idle_timeout')
      fixture.detectChanges()
      expect(alerts()).toEqual([text('VOICE.ENDED.IDLE_TIMEOUT')])
      jest.spyOn(voiceService, 'prepareStart').mockResolvedValue(undefined)
      jest.spyOn(voiceService, 'startPrepared').mockResolvedValue(undefined)

      await component.onClick()
      fixture.detectChanges()

      expect(alerts()).toEqual([])
    })
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
        const stop = jest.spyOn(voiceService, 'stop')
        const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

        permissions.next(['CHAT#VIEW'])
        fixture.detectChanges()
        fixture.detectChanges()

        expect(stop).toHaveBeenCalledTimes(1)
        expect(stopped).toHaveBeenCalledTimes(1)
        expect(voiceService.isConnected()).toBe(false)
        expect(voiceService.isConnecting()).toBe(false)
      }
    )

    it('should leave the session running when voice permission is retained', () => {
      voiceService.isConnected.set(true)
      const stop = jest.spyOn(voiceService, 'stop')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

      permissions.next(['VOICE#USE', 'CHAT#VIEW'])
      fixture.detectChanges()

      expect(stop).not.toHaveBeenCalled()
      expect(stopped).not.toHaveBeenCalled()
      expect(voiceService.isConnected()).toBe(true)
    })

    it('should not emit a stop when permission is revoked without an active session', () => {
      const stop = jest.spyOn(voiceService, 'stop')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

      permissions.next([])
      fixture.detectChanges()

      expect(stop).not.toHaveBeenCalled()
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
        const stop = jest.spyOn(voiceService, 'stop')
        const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

        fixture.componentRef.setInput('chatId', 'chat-2')
        fixture.detectChanges()
        expect(stopped).not.toHaveBeenCalled()
        await Promise.resolve()

        expect(stop).toHaveBeenCalled()
        expect(stopped).toHaveBeenCalled()
      }
    )

    it('should not stop anything when no voice session is active', async () => {
      const stop = jest.spyOn(voiceService, 'stop')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

      fixture.componentRef.setInput('chatId', 'chat-2')
      fixture.detectChanges()
      await Promise.resolve()

      expect(stop).not.toHaveBeenCalled()
      expect(stopped).not.toHaveBeenCalled()
    })

    it('should retain a pending voice start when the new chat receives its persisted id', async () => {
      fixture.componentRef.setInput('chatId', 'new')
      fixture.componentRef.setInput('voiceChatStartPending', true)
      fixture.detectChanges()
      voiceService.isConnecting.set(true)
      const stop = jest.spyOn(voiceService, 'stop')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')

      fixture.componentRef.setInput('chatId', 'created-chat')
      fixture.detectChanges()
      await Promise.resolve()

      expect(stop).not.toHaveBeenCalled()
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

    it.each([
      ['listening', 'Listening', null],
      ['processing', 'Thinking', '.voice-live-processing'],
      ['speaking', 'Speaking', '.voice-live-speaking']
    ] as const)('should show the %s state', (activity, label, stateClass) => {
      fixture.componentRef.setInput('voiceChatEnabled', true)
      voiceService.activity.set(activity)
      fixture.detectChanges()

      const status: HTMLElement = fixture.nativeElement.querySelector('output.voice-live-status')
      expect(status.textContent?.trim()).toBe(label)
      expect(status.getAttribute('aria-live')).toBe('polite')
      for (const other of ['.voice-live-processing', '.voice-live-speaking']) {
        expect(fixture.nativeElement.querySelector(other) !== null).toBe(other === stateClass)
      }
    })

    it('should show muted rather than the assistant state while the microphone is muted', () => {
      fixture.componentRef.setInput('voiceChatEnabled', true)
      voiceService.activity.set('speaking')
      voiceService.isMuted.set(true)
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('output.voice-live-status').textContent.trim()).toBe('Muted')
      expect(fixture.nativeElement.querySelector('.voice-live-speaking')).toBeNull()
    })

    it('should show a non-fatal service failure while the voice chat keeps running', () => {
      fixture.componentRef.setInput('voiceChatEnabled', true)
      voiceService.notice.set('VOICE.NOTICE.TTS_FAILED')
      fixture.detectChanges()

      const notice: HTMLElement = fixture.nativeElement.querySelector('output.voice-notice')
      expect(notice.textContent?.trim()).toBe('The answer could not be spoken and is shown as text.')
      expect(fixture.nativeElement.querySelector('output[role="alert"]')).toBeNull()

      voiceService.notice.set(undefined)
      fixture.detectChanges()
      expect(fixture.nativeElement.querySelector('output.voice-notice')).toBeNull()
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

    expect(fixture.nativeElement.querySelector('button.voice-record-button')).toBeNull()
    expect(start).not.toHaveBeenCalled()
  })

  it('should hide voice until remote permissions arrive and react to their revocation', () => {
    globalPermissions.next(['VOICE#USE'])
    fixture.detectChanges()
    expect(fixture.nativeElement.querySelector('button.voice-record-button')).toBeNull()

    setRemotePermissions(['VOICE#USE'])
    expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(false)

    setRemotePermissions([])
    expect(fixture.nativeElement.querySelector('button.voice-record-button')).toBeNull()
  })

  it('should stop an active session when remote voice permission is revoked despite global permission', () => {
    globalPermissions.next(['VOICE#USE'])
    setRemotePermissions(['VOICE#USE'])
    const voiceService = TestBed.inject(VoiceService)
    voiceService.isConnected.set(true)
    fixture.detectChanges()
    const stop = jest.spyOn(voiceService, 'stop')
    const stopped = jest.spyOn(fixture.componentInstance.voiceChatStopped, 'emit')

    setRemotePermissions([])

    expect(stop).toHaveBeenCalledTimes(1)
    expect(stopped).toHaveBeenCalledTimes(1)
    expect(voiceService.isConnected()).toBe(false)
  })
})
