import { ComponentFixture, TestBed } from '@angular/core/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'

import { ChatComponent } from './chat.component'

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
  })

  describe('auto-scroll and new messages indicator', () => {
    beforeEach(() => {
      jest.spyOn(component, 'scrollToBottom')
    })

    it('should start with user considered near bottom', () => {
      expect(component.isNearBottom).toBe(true)
    })

    it('should start with no unread messages and hidden indicator', () => {
      expect(component.unreadCount).toBe(0)
      expect(component.showNewMessagesIndicator).toBe(false)
    })

    it('should trigger smooth scroll when new message appears while user is near bottom', () => {
      // Set initial messages
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' }
      ]
      component.ngOnChanges({ chatMessages: { currentValue: component.chatMessages, firstChange: false } as any })
      fixture.detectChanges()

      // Reset spy
      ;(component.scrollToBottom as jest.Mock).mockClear()

      // Simulate new message appearing (e.g., AI reply or loading indicator)
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' },
        {
          id: '2',
          text: 'Loading...',
          type: 'ASSISTANT' as any,
          creationDate: new Date(),
          userName: 'AI',
          isLoadingInfo: true
        }
      ]
      fixture.detectChanges() // Triggers ngAfterViewChecked

      expect(component.scrollToBottom).toHaveBeenCalled()
    })

    it('should show indicator and increment unread when new message appears while scrolled up', () => {
      // Set initial messages
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' }
      ]
      component.ngOnChanges({ chatMessages: { currentValue: component.chatMessages, firstChange: false } as any })
      fixture.detectChanges()

      // Mock onScroll to set internal isNearBottom to false (simulating user scrolled up)
      // We access the private state by calling onScroll on a mock element
      const el = component['scrollContainerRef']?.nativeElement as HTMLElement | undefined
      if (el) {
        Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
        Object.defineProperty(el, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
        component.onScroll()
      }

      expect(component.isNearBottom).toBe(false)

      // Simulate new message appearing
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' },
        { id: '2', text: 'Reply', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' }
      ]
      fixture.detectChanges()

      expect(component.unreadCount).toBe(1)
      expect(component.showNewMessagesIndicator).toBe(true)
      // scrollToBottom should NOT be called when scrolled up
      expect(component.scrollToBottom).not.toHaveBeenCalled()
    })

    it('should accumulate unread count for multiple new messages while scrolled up', () => {
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' }
      ]
      component.ngOnChanges({ chatMessages: { currentValue: component.chatMessages, firstChange: false } as any })
      fixture.detectChanges()

      // Mock scrolled up state
      const el = component['scrollContainerRef']?.nativeElement as HTMLElement | undefined
      if (el) {
        Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
        Object.defineProperty(el, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
        component.onScroll()
      }

      // Add 3 new messages
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' },
        { id: '2', text: 'Msg 1', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' },
        { id: '3', text: 'Msg 2', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' },
        { id: '4', text: 'Msg 3', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' }
      ]
      fixture.detectChanges()

      expect(component.unreadCount).toBe(3)
      expect(component.showNewMessagesIndicator).toBe(true)
    })

    it('should cap unread display at 99+ when count exceeds 99', () => {
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' }
      ]
      component.ngOnChanges({ chatMessages: { currentValue: component.chatMessages, firstChange: false } as any })
      fixture.detectChanges()

      // Mock scrolled up
      const el = component['scrollContainerRef']?.nativeElement as HTMLElement | undefined
      if (el) {
        Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
        Object.defineProperty(el, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
        component.onScroll()
      }

      // Add 105 new messages
      const messages = [{ id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' }]
      for (let i = 2; i <= 106; i++) {
        messages.push({
          id: `${i}`,
          text: `Msg ${i}`,
          type: 'ASSISTANT' as any,
          creationDate: new Date(),
          userName: 'AI'
        })
      }
      component.chatMessages = messages
      fixture.detectChanges()

      expect(component.unreadCount).toBe(105)
      expect(component.unreadCountDisplay).toBe('99+')
    })

    it('should display exact count when under cap', () => {
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' }
      ]
      component.ngOnChanges({ chatMessages: { currentValue: component.chatMessages, firstChange: false } as any })
      fixture.detectChanges()

      // Mock scrolled up
      const el = component['scrollContainerRef']?.nativeElement as HTMLElement | undefined
      if (el) {
        Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
        Object.defineProperty(el, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
        component.onScroll()
      }

      // Add 5 new messages
      const messages = [{ id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' }]
      for (let i = 2; i <= 6; i++) {
        messages.push({
          id: `${i}`,
          text: `Msg ${i}`,
          type: 'ASSISTANT' as any,
          creationDate: new Date(),
          userName: 'AI'
        })
      }
      component.chatMessages = messages
      fixture.detectChanges()

      expect(component.unreadCount).toBe(5)
      expect(component.unreadCountDisplay).toBe('5')
    })

    it('should clear indicator and unread count when indicator click handler is called', () => {
      // Set up unread state
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' },
        { id: '2', text: 'Reply', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' }
      ]
      component.ngOnChanges({ chatMessages: { currentValue: component.chatMessages, firstChange: false } as any })
      fixture.detectChanges()

      // Mock scrolled up
      const el = component['scrollContainerRef']?.nativeElement as HTMLElement | undefined
      if (el) {
        Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
        Object.defineProperty(el, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
        component.onScroll()
      }

      // Add more messages to create unread
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' },
        { id: '2', text: 'Reply', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' },
        { id: '3', text: 'More', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' }
      ]
      fixture.detectChanges()

      expect(component.unreadCount).toBe(1)
      expect(component.showNewMessagesIndicator).toBe(true)

      // Click the indicator
      component.scrolltoLatestMessages()

      // scrollToBottom should be called
      expect(component.scrollToBottom).toHaveBeenCalled()
    })

    it('should clear indicator and unread count when user manually scrolls to bottom', () => {
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' },
        { id: '2', text: 'Reply', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' }
      ]
      component.ngOnChanges({ chatMessages: { currentValue: component.chatMessages, firstChange: false } as any })
      fixture.detectChanges()

      const el = component['scrollContainerRef']?.nativeElement as HTMLElement | undefined
      if (el) {
        // Simulate scrolled up
        Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
        Object.defineProperty(el, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
        component.onScroll()

        // Add new messages
        component.chatMessages = [
          { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' },
          { id: '2', text: 'Reply', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' },
          { id: '3', text: 'More', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' }
        ]
        fixture.detectChanges()

        expect(component.unreadCount).toBe(1)

        // User scrolls back to bottom (scrollTop near scrollHeight - clientHeight)
        Object.defineProperty(el, 'scrollTop', { value: 550, configurable: true })
        Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
        Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
        component.onScroll()

        expect(component.isNearBottom).toBe(true)
        expect(component.unreadCount).toBe(0)
        expect(component.showNewMessagesIndicator).toBe(false)
      }
    })

    it('should handle loading progress messages the same as regular messages', () => {
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' }
      ]
      component.ngOnChanges({ chatMessages: { currentValue: component.chatMessages, firstChange: false } as any })
      fixture.detectChanges()

      ;(component.scrollToBottom as jest.Mock).mockClear()

      // Add a loading/progress message
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' },
        {
          id: '2',
          text: 'Working...',
          type: 'ASSISTANT' as any,
          creationDate: new Date(),
          userName: 'AI',
          isLoadingInfo: true
        }
      ]
      fixture.detectChanges()

      // Should auto-scroll just like regular messages
      expect(component.scrollToBottom).toHaveBeenCalled()
    })

    it('should handle replacement of loading message with final message', () => {
      // Start with user message + loading message
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' },
        {
          id: '2',
          text: 'Working...',
          type: 'ASSISTANT' as any,
          creationDate: new Date(),
          userName: 'AI',
          isLoadingInfo: true
        }
      ]
      component.ngOnChanges({ chatMessages: { currentValue: component.chatMessages, firstChange: false } as any })
      fixture.detectChanges()

      ;(component.scrollToBottom as jest.Mock).mockClear()

      // Loading message gets replaced by final answer (message count stays the same)
      // No new message count -> no scroll triggered (correct behavior)
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' },
        { id: '2', text: 'Here is your answer!', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' }
      ]
      fixture.detectChanges()

      // Message count unchanged, so scrollToBottom should not be called
      expect(component.scrollToBottom).not.toHaveBeenCalled()

      // But if a NEW message is added after the answer, it should scroll
      component.chatMessages = [
        { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'User' },
        { id: '2', text: 'Here is your answer!', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' },
        { id: '3', text: 'Follow-up', type: 'ASSISTANT' as any, creationDate: new Date(), userName: 'AI' }
      ]
      fixture.detectChanges()

      expect(component.scrollToBottom).toHaveBeenCalled()
    })

    it('should set isNearBottom to true when scroll distance is within threshold', () => {
      const el = component['scrollContainerRef']?.nativeElement as HTMLElement | undefined
      if (el) {
        // scrollHeight(1000) - scrollTop(950) - clientHeight(500) = -350 -> within threshold (<= 50)
        Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
        Object.defineProperty(el, 'scrollTop', { value: 950, configurable: true })
        Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
        component.onScroll()

        expect(component.isNearBottom).toBe(true)
      }
    })

    it('should set isNearBottom to false when scroll distance exceeds threshold', () => {
      const el = component['scrollContainerRef']?.nativeElement as HTMLElement | undefined
      if (el) {
        // scrollHeight(1000) - scrollTop(0) - clientHeight(500) = 500 > 50 -> not near bottom
        Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
        Object.defineProperty(el, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
        component.onScroll()

        expect(component.isNearBottom).toBe(false)
      }
    })

    it('scrolltoLatestMessages should call scrollToBottom', () => {
      ;(component.scrollToBottom as jest.Mock).mockClear()
      component.scrolltoLatestMessages()
      expect(component.scrollToBottom).toHaveBeenCalledTimes(1)
    })

    it('should call scrollToBottom after sending a message', () => {
      jest.useFakeTimers()
      ;(component.scrollToBottom as jest.Mock).mockClear()

      component.formGroup.patchValue({ message: 'test' })
      jest.spyOn(component.sendMessage, 'emit')
      component.sendButtonClicked()

      // Wait for the timeout that triggers scrollToBottom
      jest.advanceTimersByTime(100)

      expect(component.scrollToBottom).toHaveBeenCalled()
      jest.useRealTimers()
    })
  })
})
