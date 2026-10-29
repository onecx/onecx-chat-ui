import { ComponentFixture, TestBed } from '@angular/core/testing'
import { AuthProxyService } from '@onecx/angular-auth'
import { TranslateTestingModule } from 'ngx-translate-testing'

import { VoiceComponent } from './voice.component'
import { VoiceService } from '../../services/voice.service'

describe('VoiceComponent', () => {
  let component: VoiceComponent
  let fixture: ComponentFixture<VoiceComponent>
  let voiceService: VoiceService

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        VoiceComponent,
        TranslateTestingModule.withTranslations({
          en: require('./src/assets/i18n/en.json'),
          de: require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ],
      providers: [VoiceService, { provide: AuthProxyService, useValue: {} }]
    }).compileComponents()

    fixture = TestBed.createComponent(VoiceComponent)
    component = fixture.componentInstance
    voiceService = TestBed.inject(VoiceService)
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
    it('should clean up and emit voiceChatStopped when voice chat is already enabled', async () => {
      const cleanup = jest.spyOn(voiceService, 'cleanup')
      const started = jest.spyOn(component.voiceChatStarted, 'emit')
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')
      component.voiceChatEnabled = true

      await component.onClick()

      expect(cleanup).toHaveBeenCalled()
      expect(stopped).toHaveBeenCalled()
      expect(started).not.toHaveBeenCalled()
    })

    it.each(['', 'new'])('should not start a voice session for the unsaved chat id "%s"', async (chatId) => {
      const start = jest.spyOn(voiceService, 'start')
      component.chatId = chatId

      await component.onClick()

      expect(start).not.toHaveBeenCalled()
    })

    it('should not start another voice session while one is connecting', async () => {
      const start = jest.spyOn(voiceService, 'start')
      component.chatId = 'chat-1'
      voiceService.isConnecting.set(true)

      await component.onClick()

      expect(start).not.toHaveBeenCalled()
    })

    it('should start the voice session for the chat and agent and emit voiceChatStarted', async () => {
      const start = jest.spyOn(voiceService, 'start').mockResolvedValue()
      const started = jest.spyOn(component.voiceChatStarted, 'emit')
      component.chatId = 'chat-1'
      component.agentId = 'agent-1'

      await component.onClick()

      expect(start).toHaveBeenCalledWith('chat-1', 'agent-1')
      expect(started).toHaveBeenCalled()
    })

    it('should emit voiceChatStopped and rethrow when starting the voice session fails', async () => {
      const failure = new Error('voice start failed')
      const start = jest.spyOn(voiceService, 'start').mockRejectedValue(failure)
      const stopped = jest.spyOn(component.voiceChatStopped, 'emit')
      component.chatId = 'chat-1'

      await expect(component.onClick()).rejects.toThrow('voice start failed')

      expect(start).toHaveBeenCalled()
      expect(stopped).toHaveBeenCalled()
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
  })

  describe('template bindings', () => {
    it('should disable the record button with a hint until the chat is saved', () => {
      fixture.componentRef.setInput('chatId', 'new')
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('button.voice-record-button').disabled).toBe(true)
      expect(component.recordButtonTooltipKey).toBe('VOICE.START_REQUIRES_SAVED_CHAT')
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
