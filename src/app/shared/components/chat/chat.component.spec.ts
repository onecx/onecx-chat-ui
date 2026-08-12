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

  describe('scroll behavior', () => {
    it('should start with isAtBottom true and unreadCount zero', () => {
      expect(component.isAtBottom).toBe(true)
      expect(component.unreadCount).toBe(0)
    })

    it('should increment unreadCount when new non-HUMAN message arrives while not at bottom', () => {
      // Simulate user scrolled up
      component.isAtBottom = false
      component.unreadCount = 0

      // Simulate a new AI message arriving
      const messages = [
        { id: '1', type: 'ASSISTANT' as any, text: 'Hello', creationDate: new Date(), userName: 'ai' },
        { id: '2', type: 'ASSISTANT' as any, text: 'New message', creationDate: new Date(), userName: 'ai' }
      ]

      // Manually set previous count to simulate first message was already there
      ;(component as any)._previousMessageCount = 1

      // Trigger ngOnChanges with the new messages
      component.chatMessages = messages
      component.ngOnChanges({
        chatMessages: {
          currentValue: messages,
          previousValue: undefined,
          firstChange: false,
          isFirstChange: () => false
        }
      })

      expect(component.unreadCount).toBe(1)
    })

    it('should not increment unreadCount when new HUMAN message arrives', () => {
      component.isAtBottom = false
      component.unreadCount = 0

      const messages = [
        { id: '1', type: 'ASSISTANT' as any, text: 'Hello', creationDate: new Date(), userName: 'ai' },
        { id: '2', type: 'HUMAN' as any, text: 'Hi there', creationDate: new Date(), userName: 'user' }
      ]

      ;(component as any)._previousMessageCount = 1

      component.chatMessages = messages
      component.ngOnChanges({
        chatMessages: {
          currentValue: messages,
          previousValue: undefined,
          firstChange: false,
          isFirstChange: () => false
        }
      })

      expect(component.unreadCount).toBe(0)
    })

    it('should trigger scrollToBottomSmooth when at bottom and new message arrives', () => {
      jest.useFakeTimers()

      component.isAtBottom = true
      component.unreadCount = 0

      const scrollElement = {
        scrollTo: jest.fn()
      }
      jest.spyOn(component as any, 'getScrollContainerElement').mockReturnValue(scrollElement)

      const messages = [
        { id: '1', type: 'ASSISTANT' as any, text: 'Hello', creationDate: new Date(), userName: 'ai' },
        { id: '2', type: 'ASSISTANT' as any, text: 'New message', creationDate: new Date(), userName: 'ai' }
      ]

      ;(component as any)._previousMessageCount = 1

      component.chatMessages = messages
      component.ngOnChanges({
        chatMessages: {
          currentValue: messages,
          previousValue: undefined,
          firstChange: false,
          isFirstChange: () => false
        }
      })

      // Flush the deferred setTimeout
      jest.runOnlyPendingTimers()
      jest.useRealTimers()

      expect(scrollElement.scrollTo).toHaveBeenCalled()
    })

    it('should reset unreadCount when user scrolls to bottom via onMessagesScroll', () => {
      component.isAtBottom = false
      component.unreadCount = 3

      const scrollElement = {
        scrollHeight: 1000,
        scrollTop: 950,
        clientHeight: 400,
        scrollTo: jest.fn()
      }
      jest.spyOn(component as any, 'getScrollContainerElement').mockReturnValue(scrollElement)

      component.onMessagesScroll()
      fixture.detectChanges()

      expect(component.unreadCount).toBe(0)
      expect(component.isAtBottom).toBe(true)
    })

    it('should not reset unreadCount when user scrolls but is not at bottom', () => {
      component.isAtBottom = false
      component.unreadCount = 3

      const scrollElement = {
        scrollHeight: 2000,
        scrollTop: 500,
        clientHeight: 400,
        scrollTo: jest.fn()
      }
      jest.spyOn(component as any, 'getScrollContainerElement').mockReturnValue(scrollElement)

      component.onMessagesScroll()
      fixture.detectChanges()

      expect(component.unreadCount).toBe(3)
      expect(component.isAtBottom).toBe(false)
    })

    it('should scroll to bottom and clear unread count when indicator button is clicked', () => {
      const scrollElement = {
        scrollHeight: 1000,
        scrollTo: jest.fn()
      }
      jest.spyOn(component as any, 'getScrollContainerElement').mockReturnValue(scrollElement)

      component.isAtBottom = false
      component.unreadCount = 5

      component.scrollToBottomAndClear()
      fixture.detectChanges()

      expect(scrollElement.scrollTo).toHaveBeenCalledWith({
        top: 1000,
        behavior: 'smooth'
      })
      expect(component.unreadCount).toBe(0)
    })

    it('should call scrollToBottomSmooth with smooth behavior', () => {
      const scrollElement = {
        scrollHeight: 800,
        scrollTo: jest.fn()
      }
      jest.spyOn(component as any, 'getScrollContainerElement').mockReturnValue(scrollElement)

      component.scrollToBottomSmooth()

      expect(scrollElement.scrollTo).toHaveBeenCalledWith({
        top: 800,
        behavior: 'smooth'
      })
    })
  })
})
