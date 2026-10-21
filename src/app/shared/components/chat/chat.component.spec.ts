import { SimpleChange } from '@angular/core'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'

import { ChatScrollService } from '../../services/chat-scroll.service'
import { ChatComponent } from './chat.component'
import { ChatMessage } from './chat.viewmodel'

function createMessage(id: string): ChatMessage {
  return {
    creationDate: new Date('2026-08-27T12:00:00Z'),
    id,
    type: 'HUMAN' as any,
    text: `Message ${id}`,
    userName: 'test-user'
  }
}

function setScrollDimensions(
  element: HTMLElement,
  dimensions: { scrollHeight: number; scrollTop: number; clientHeight: number }
): void {
  Object.defineProperty(element, 'scrollHeight', {
    value: dimensions.scrollHeight,
    configurable: true,
    writable: true
  })
  Object.defineProperty(element, 'scrollTop', {
    value: dimensions.scrollTop,
    configurable: true,
    writable: true
  })
  Object.defineProperty(element, 'clientHeight', {
    value: dimensions.clientHeight,
    configurable: true,
    writable: true
  })
  delete (element as any).scrollTo
}

describe('ChatComponent', () => {
  let component: ChatComponent
  let fixture: ComponentFixture<ChatComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatComponent,
        AngularAcceleratorModule,
        TranslateTestingModule.withTranslations({
          en: require('./src/assets/i18n/en.json'),
          de: require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ]
    }).compileComponents()

    fixture = TestBed.createComponent(ChatComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  describe('agentsForDropdown', () => {
    it('should map agents to dropdown format', () => {
      component.agents = [
        {
          id: 'agent-1',
          labelKey: 'CHAT.AGENT.ONE'
        } as any,
        {
          id: 'agent-2',
          labelKey: 'CHAT.AGENT.TWO'
        } as any
      ]

      expect(component.agentsForDropdown).toEqual([
        {
          id: 'agent-1',
          labelKey: 'CHAT.AGENT.ONE'
        },
        {
          id: 'agent-2',
          labelKey: 'CHAT.AGENT.TWO'
        }
      ])
    })
  })

  describe('sendButtonClicked', () => {
    it('should emit sendMessage when form has valid message', () => {
      const testMessage = 'Test message'
      jest.spyOn(component.sendMessage, 'emit')

      component.formGroup.patchValue({ message: testMessage })
      component.sendButtonClicked()

      expect(component.sendMessage.emit).toHaveBeenCalledWith(testMessage)
      expect(component.formGroup.value.message).toBeNull()
    })

    it('should not emit sendMessage when message is null', () => {
      jest.spyOn(component.sendMessage, 'emit')

      component.formGroup.patchValue({ message: null })
      component.sendButtonClicked()

      expect(component.sendMessage.emit).not.toHaveBeenCalled()
    })

    it('should not emit sendMessage when message is empty string', () => {
      jest.spyOn(component.sendMessage, 'emit')

      component.formGroup.patchValue({ message: '' })
      component.sendButtonClicked()

      expect(component.sendMessage.emit).not.toHaveBeenCalled()
    })

    it('should not emit sendMessage when message is only whitespace', () => {
      jest.spyOn(component.sendMessage, 'emit')

      component.formGroup.patchValue({ message: '   ' })
      component.sendButtonClicked()

      expect(component.sendMessage.emit).toHaveBeenCalledWith('   ')
      expect(component.formGroup.value.message).toBeNull()
    })

    it('should reset form after sending message', () => {
      const testMessage = 'Test message'
      jest.spyOn(component.sendMessage, 'emit')
      jest.spyOn(component.formGroup, 'reset')

      component.formGroup.patchValue({ message: testMessage })
      component.sendButtonClicked()

      expect(component.formGroup.reset).toHaveBeenCalled()
    })

    it('should not emit sendMessage when sendMessageDisabled is true', () => {
      component.sendMessageDisabled = true
      jest.spyOn(component.sendMessage, 'emit')

      component.formGroup.patchValue({ message: 'Test message' })
      component.sendButtonClicked()

      expect(component.sendMessage.emit).not.toHaveBeenCalled()
    })
  })

  describe('template bindings', () => {
    it('should disable the textarea when sendMessageDisabled input is true', () => {
      fixture.componentRef.setInput('sendMessageDisabled', true)
      fixture.detectChanges()

      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('.message-input')

      expect(textarea.disabled).toBe(true)
    })

    it('should keep scrolling inside the message history', () => {
      const chatContainer: HTMLElement = fixture.nativeElement.querySelector('.chat-container')
      const historyContainer: HTMLElement = fixture.nativeElement.querySelector('.chat-history-container')

      expect(chatContainer.classList).toContain('overflow-hidden')
      expect(historyContainer.classList).toContain('overflow-y-auto')
    })
  })

  describe('retrySending', () => {
    it('should emit retrySendMessage with message text', () => {
      const testMessage = {
        text: 'Retry this message',
        creationDate: new Date(),
        id: '1',
        type: 'USER' as any,
        userName: 'testUser'
      }
      jest.spyOn(component.retrySendMessage, 'emit')

      component.retrySending(testMessage)

      expect(component.retrySendMessage.emit).toHaveBeenCalledWith('Retry this message')
    })

    it('should handle empty message text', () => {
      const testMessage = {
        text: '',
        creationDate: new Date(),
        id: '2',
        type: 'USER' as any,
        userName: 'testUser'
      }
      jest.spyOn(component.retrySendMessage, 'emit')

      component.retrySending(testMessage)

      expect(component.retrySendMessage.emit).toHaveBeenCalledWith('')
    })

    it('should show a status line below a failed message and retry from its button', () => {
      fixture.componentRef.setInput('chatMessages', [{ ...createMessage('failed'), isFailed: true }])
      fixture.detectChanges()
      jest.spyOn(component.retrySendMessage, 'emit')

      const errorLine: HTMLElement = fixture.nativeElement.querySelector('.chat-message-error')
      const bubble: HTMLElement = fixture.nativeElement.querySelector('.chat-message-bubble')

      expect(errorLine).not.toBeNull()
      expect(bubble.contains(errorLine)).toBe(false)

      errorLine.querySelector('button')?.click()

      expect(component.retrySendMessage.emit).toHaveBeenCalledWith('Message failed')
    })

    it('should not show a status line for delivered messages', () => {
      fixture.componentRef.setInput('chatMessages', [createMessage('ok')])
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('.chat-message-error')).toBeNull()
    })
  })

  describe('voice chat events', () => {
    it('should emit voiceChatStarted when the voice component reports a start', () => {
      jest.spyOn(component.voiceChatStarted, 'emit')

      component.onVoiceChatStarted()

      expect(component.voiceChatStarted.emit).toHaveBeenCalled()
    })

    it('should emit voiceChatStopped when the voice component reports a stop', () => {
      jest.spyOn(component.voiceChatStopped, 'emit')

      component.onVoiceChatStopped()

      expect(component.voiceChatStopped.emit).toHaveBeenCalled()
    })

    it('should render the voice component inside the message box', () => {
      fixture.componentRef.setInput('voiceAiEnabled', true)
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('.message-box app-voice')).not.toBeNull()
      expect(fixture.nativeElement.querySelector('.message-input')).not.toBeNull()
    })

    it('should keep the same voice component instance and hide the textarea while voice chat is active', () => {
      fixture.componentRef.setInput('voiceAiEnabled', true)
      fixture.detectChanges()
      const voiceElement = fixture.nativeElement.querySelector('app-voice')

      fixture.componentRef.setInput('voiceChatEnabled', true)
      fixture.detectChanges()

      expect(fixture.nativeElement.querySelector('app-voice')).toBe(voiceElement)
      expect(fixture.nativeElement.querySelector('.message-input')).toBeNull()
    })
  })

  describe('auto-scroll', () => {
    let scrollContainer: HTMLElement
    let scrollService: ChatScrollService

    beforeEach(() => {
      scrollContainer = fixture.nativeElement.querySelector('.chat-history-container')
      scrollService = fixture.debugElement.injector.get(ChatScrollService)
      fixture.componentRef.setInput('chatId', 'chat-1')
      fixture.componentRef.setInput('chatMessages', [createMessage('1')])
      fixture.detectChanges()
    })

    it('should ignore changes unrelated to the chat and its messages', () => {
      component.unreadCount = 2

      component.ngOnChanges({ sendMessageDisabled: new SimpleChange(false, true, false) })

      expect(component.unreadCount).toBe(2)
    })

    it('should scroll after the initial messages render without a chat id change', () => {
      const scrollToBottomSpy = jest.spyOn(scrollService, 'scrollToBottom')
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })

      component.ngOnChanges({ chatMessages: new SimpleChange(undefined, [createMessage('2')], true) })
      component.ngAfterViewChecked()

      expect(scrollContainer.scrollTop).toBe(800)
      expect(scrollToBottomSpy).toHaveBeenCalledWith('auto')
    })

    it('should ignore a message replacement that does not increase the message count', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })
      scrollService.checkPosition()

      fixture.componentRef.setInput('chatMessages', [createMessage('replacement')])
      fixture.detectChanges()

      expect(scrollContainer.scrollTop).toBe(100)
      expect(component.unreadCount).toBe(0)
    })

    it('should scroll after a message is appended while at the bottom', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 500, clientHeight: 300 })
      scrollService.checkPosition()

      fixture.componentRef.setInput('chatMessages', [createMessage('1'), createMessage('2')])
      fixture.detectChanges()

      expect(scrollContainer.scrollTop).toBe(800)
    })

    it('should preserve position and show the unread indicator when a message arrives while scrolled up', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })
      scrollService.checkPosition()

      fixture.componentRef.setInput('chatMessages', [createMessage('1'), createMessage('2')])
      fixture.detectChanges()

      expect(scrollContainer.scrollTop).toBe(100)
      expect((component as any).unreadCount).toBe(1)
      expect(fixture.nativeElement.querySelector('app-new-message-indicator')).not.toBeNull()
    })

    it('should scroll and clear unread messages when the indicator is clicked', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })
      scrollService.checkPosition()
      fixture.componentRef.setInput('chatMessages', [createMessage('1'), createMessage('2')])
      fixture.detectChanges()

      const indicator: HTMLButtonElement = fixture.nativeElement.querySelector('app-new-message-indicator button')
      indicator.click()
      fixture.detectChanges()

      expect(scrollContainer.scrollTop).toBe(800)
      expect((component as any).unreadCount).toBe(0)
      expect(fixture.nativeElement.querySelector('app-new-message-indicator')).toBeNull()
    })

    it('should reset unread messages and scroll when the chat changes', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })
      scrollService.checkPosition()
      fixture.componentRef.setInput('chatMessages', [createMessage('1'), createMessage('2')])
      fixture.detectChanges()

      fixture.componentRef.setInput('chatId', 'chat-2')
      fixture.componentRef.setInput('chatMessages', [createMessage('3')])
      fixture.detectChanges()

      expect(scrollContainer.scrollTop).toBe(800)
      expect((component as any).unreadCount).toBe(0)
    })

    it('should clear unread messages when the user manually returns to the bottom', () => {
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })
      scrollService.checkPosition()
      fixture.componentRef.setInput('chatMessages', [createMessage('1'), createMessage('2')])
      fixture.detectChanges()

      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 500, clientHeight: 300 })
      scrollContainer.dispatchEvent(new Event('scroll'))
      fixture.detectChanges()

      expect((component as any).unreadCount).toBe(0)
      expect(fixture.nativeElement.querySelector('app-new-message-indicator')).toBeNull()
    })

    it('should scroll instantly to the latest message when messages are loaded into an empty chat', () => {
      fixture.componentRef.setInput('chatMessages', [])
      fixture.detectChanges()
      const scrollToBottomSpy = jest.spyOn(scrollService, 'scrollToBottom')
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 0, clientHeight: 300 })
      scrollService.checkPosition()

      fixture.componentRef.setInput('chatMessages', [createMessage('1'), createMessage('2')])
      fixture.detectChanges()

      expect(scrollToBottomSpy).toHaveBeenCalledWith('auto')
      expect(scrollContainer.scrollTop).toBe(800)
      expect(component.unreadCount).toBe(0)
    })
  })

  describe('resize handling', () => {
    let resizeCallback: ResizeObserverCallback | undefined
    let observedElements: Element[]
    const disconnect = jest.fn()
    const originalResizeObserver = (globalThis as any).ResizeObserver

    beforeEach(() => {
      fixture.destroy()
      observedElements = []
      ;(globalThis as any).ResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
        resizeCallback = callback
        return { observe: (element: Element) => observedElements.push(element), disconnect }
      })

      fixture = TestBed.createComponent(ChatComponent)
      component = fixture.componentInstance
      fixture.detectChanges()
    })

    afterEach(() => {
      ;(globalThis as any).ResizeObserver = originalResizeObserver
    })

    it('should observe the message history and its content', () => {
      const scrollContainer: HTMLElement = fixture.nativeElement.querySelector('.chat-history-container')

      expect(observedElements).toEqual([scrollContainer, scrollContainer.firstElementChild])
    })

    it('should keep the latest message visible when the history resizes while at the bottom', () => {
      const scrollContainer: HTMLElement = fixture.nativeElement.querySelector('.chat-history-container')
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 500, clientHeight: 300 })

      setScrollDimensions(scrollContainer, { scrollHeight: 1000, scrollTop: 500, clientHeight: 300 })
      resizeCallback?.([], {} as ResizeObserver)

      expect(scrollContainer.scrollTop).toBe(1000)
    })

    it('should not move the history when the user scrolled up', () => {
      const scrollContainer: HTMLElement = fixture.nativeElement.querySelector('.chat-history-container')
      setScrollDimensions(scrollContainer, { scrollHeight: 800, scrollTop: 100, clientHeight: 300 })
      scrollContainer.dispatchEvent(new Event('scroll'))

      resizeCallback?.([], {} as ResizeObserver)

      expect(scrollContainer.scrollTop).toBe(100)
    })

    it('should disconnect the observer on destroy', () => {
      fixture.destroy()

      expect(disconnect).toHaveBeenCalled()
    })
  })
})
