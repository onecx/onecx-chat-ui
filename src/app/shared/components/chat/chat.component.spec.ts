import { ComponentFixture, TestBed } from '@angular/core/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { SimpleChanges } from '@angular/core'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'

import { ChatComponent } from './chat.component'
import { ChatScrollService } from '../../services/chat-scroll.service'
import { MessageType } from '../../generated'
import { ChatMessage } from './chat.viewmodel'

/** Shared factory: creates a minimal ChatMessage with sensible defaults. */
function createChatMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'msg-1',
    type: MessageType.Assistant,
    text: 'Hello',
    userName: 'ai',
    creationDate: new Date(),
    ...overrides
  }
}

/** Shared factory: creates a minimal user (HUMAN) message. */
function createUserMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return createChatMessage({ type: MessageType.Human, userName: 'user', ...overrides })
}

/** Shared factory: creates a loading/progress message. */
function createLoadingMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return createChatMessage({ isLoadingInfo: true, text: '', ...overrides })
}

describe('ChatComponent', () => {
  let component: ChatComponent
  let fixture: ComponentFixture<ChatComponent>
  let scrollService: ChatScrollService

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
    scrollService = TestBed.inject(ChatScrollService)
    fixture.detectChanges()
  })

  afterEach(() => {
    scrollService.dispose()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  describe('agentsForDropdown', () => {
    it('should map agents to dropdown format', () => {
      component.agents = [
        { id: 'agent-1', labelKey: 'CHAT.AGENT.ONE' } as any,
        { id: 'agent-2', labelKey: 'CHAT.AGENT.TWO' } as any
      ]

      expect(component.agentsForDropdown).toEqual([
        { id: 'agent-1', labelKey: 'CHAT.AGENT.ONE' },
        { id: 'agent-2', labelKey: 'CHAT.AGENT.TWO' }
      ])
    })
  })

  describe('sendButtonClicked', () => {
    it('should emit sendMessage when form has valid message', () => {
      jest.spyOn(component.sendMessage, 'emit')
      component.formGroup.patchValue({ message: 'Test message' })
      component.sendButtonClicked()

      expect(component.sendMessage.emit).toHaveBeenCalledWith('Test message')
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

    it('should reset form after sending message', () => {
      jest.spyOn(component.sendMessage, 'emit')
      jest.spyOn(component.formGroup, 'reset')

      component.formGroup.patchValue({ message: 'Test message' })
      component.sendButtonClicked()

      expect(component.formGroup.reset).toHaveBeenCalled()
    })
  })

  describe('retrySending', () => {
    it('should emit retrySendMessage with message text', () => {
      jest.spyOn(component.retrySendMessage, 'emit')
      component.retrySending(createChatMessage({ id: '1', text: 'Retry this' }))

      expect(component.retrySendMessage.emit).toHaveBeenCalledWith('Retry this')
    })

    it('should handle empty message text', () => {
      jest.spyOn(component.retrySendMessage, 'emit')
      component.retrySending(createChatMessage({ id: '2', text: '' }))

      expect(component.retrySendMessage.emit).toHaveBeenCalledWith('')
    })
  })

  describe('scroll and unread indicator behavior', () => {
    /**
     * Helper that calls ngOnChanges directly with proper SimpleChanges,
     * then flushes the queueMicrotask callbacks.
     * This avoids the complexity of fixture.detectChanges() not properly
     * tracking @Input changes when set directly.
     */
    async function triggerMessageChange(newMessages: ChatMessage[]): Promise<void> {
      const prevMessages = component.chatMessages
      component.chatMessages = newMessages

      // Create SimpleChanges manually since we're setting the input directly
      const changes: SimpleChanges = {
        chatMessages: {
          currentValue: newMessages,
          previousValue: prevMessages,
          firstChange: false,
          isFirstChange: () => false
        }
      }
      component.ngOnChanges(changes)

      // Flush queueMicrotask callbacks
      await new Promise(resolve => {
        // Use setTimeout with 0 to ensure microtasks run first
        setTimeout(resolve, 0)
      })
      // One more microtask flush to be safe
      await Promise.resolve()
      fixture.detectChanges()
    }

    /**
     * Helper: mark messages as "known" by triggering an initial change.
     * This simulates the component having seen these messages before.
     */
    async function markMessagesKnown(messages: ChatMessage[]): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changes: SimpleChanges = {
        chatMessages: {
          currentValue: messages,
          previousValue: [],
          firstChange: true,
          isFirstChange: () => true
        }
      }
      component.ngOnChanges(changes)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(component as any).knownMessageIds = new Set(messages.map(m => m.id))
    }

    describe('auto-scroll when at bottom', () => {
      it('should auto-scroll when new messages arrive and user is at bottom', async () => {
        const scrollToSpy = jest.spyOn(scrollService, 'scrollToBottom').mockImplementation(() => {})

        const baseMessages = [createChatMessage({ id: 'm-1' })]
        component.chatMessages = baseMessages
        fixture.detectChanges()

        // Mark base messages as known
        await markMessagesKnown(baseMessages)

        scrollToSpy.mockClear()

        // Add a new message
        await triggerMessageChange([...baseMessages, createUserMessage({ id: 'm-2' })])

        expect(scrollToSpy).toHaveBeenCalled()
        expect(component.showNewMessagesIndicator).toBe(false)
        expect(component.unreadMessagesCount).toBe(0)
      })
    })

    describe('progress message handling', () => {
      it('should auto-scroll when loading/progress message is appended', async () => {
        const scrollToSpy = jest.spyOn(scrollService, 'scrollToBottom').mockImplementation(() => {})

        const baseMessages = [createChatMessage({ id: 'm-1' })]
        component.chatMessages = baseMessages
        fixture.detectChanges()
        await markMessagesKnown(baseMessages)

        scrollToSpy.mockClear()

        // Add a loading/progress message
        await triggerMessageChange([...baseMessages, createLoadingMessage({ id: 'loading-1' })])

        expect(scrollToSpy).toHaveBeenCalled()
        expect(component.showNewMessagesIndicator).toBe(false)
      })

      it('should NOT increment unread count when loading message is updated in place', async () => {
        const scrollToSpy = jest.spyOn(scrollService, 'scrollToBottom').mockImplementation(() => {})

        const baseMessages = [
          createUserMessage({ id: 'm-1' }),
          createLoadingMessage({ id: 'loading-1' })
        ]
        component.chatMessages = baseMessages
        fixture.detectChanges()
        await markMessagesKnown(baseMessages)

        scrollToSpy.mockClear()

        // Update loading message in place (same IDs, different text)
        const updatedMessages = [
          createUserMessage({ id: 'm-1' }),
          createLoadingMessage({ id: 'loading-1', text: 'partial response...' })
        ]
        await triggerMessageChange(updatedMessages)

        // No new messages (same IDs), so no scroll and no unread count change
        expect(scrollToSpy).not.toHaveBeenCalled()
        expect(component.unreadMessagesCount).toBe(0)
        expect(component.showNewMessagesIndicator).toBe(false)
      })
    })

    describe('unread indicator when scrolled up', () => {
      /**
       * Mock isUserNearBottom to return false so the component
       * thinks the user has scrolled up.
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function mockScrolledUp(): jest.SpyInstance<any, any[], jest.Mock> {
        return jest.spyOn(component as any, 'isUserNearBottom').mockReturnValue(false)
      }

      it('should show indicator when new messages arrive while scrolled up', async () => {
        const scrollToSpy = jest.spyOn(scrollService, 'scrollToBottom').mockImplementation(() => {})
        const nearBottomSpy = mockScrolledUp()

        const baseMessages = [createChatMessage({ id: 'm-1' })]
        component.chatMessages = baseMessages
        fixture.detectChanges()
        await markMessagesKnown(baseMessages)

        // Add a new message while scrolled up
        await triggerMessageChange([...baseMessages, createUserMessage({ id: 'm-2' })])

        expect(scrollToSpy).not.toHaveBeenCalled()
        expect(component.showNewMessagesIndicator).toBe(true)
        expect(component.unreadMessagesCount).toBe(1)

        nearBottomSpy.mockRestore()
      })

      it('should accumulate unread count for multiple new messages', async () => {
        const scrollToSpy = jest.spyOn(scrollService, 'scrollToBottom').mockImplementation(() => {})
        const nearBottomSpy = mockScrolledUp()

        const baseMessages = [createChatMessage({ id: 'm-1' })]
        component.chatMessages = baseMessages
        fixture.detectChanges()
        await markMessagesKnown(baseMessages)

        await triggerMessageChange([
          ...baseMessages,
          createUserMessage({ id: 'm-2' }),
          createUserMessage({ id: 'm-3' })
        ])

        expect(component.showNewMessagesIndicator).toBe(true)
        expect(component.unreadMessagesCount).toBe(2)

        nearBottomSpy.mockRestore()
      })

      it('should accumulate across multiple change cycles', async () => {
        const scrollToSpy = jest.spyOn(scrollService, 'scrollToBottom').mockImplementation(() => {})
        const nearBottomSpy = mockScrolledUp()

        const baseMessages = [createChatMessage({ id: 'm-1' })]
        component.chatMessages = baseMessages
        fixture.detectChanges()
        await markMessagesKnown(baseMessages)

        // First batch
        await triggerMessageChange([...baseMessages, createUserMessage({ id: 'm-2' })])
        expect(component.unreadMessagesCount).toBe(1)

        // Second batch
        const newMessages = [...component.chatMessages, createUserMessage({ id: 'm-3' })]
        await triggerMessageChange(newMessages)
        expect(component.unreadMessagesCount).toBe(2)

        nearBottomSpy.mockRestore()
      })
    })

    describe('scrollToLatestMessages', () => {
      it('should scroll to bottom and clear unread indicator', () => {
        const scrollToSpy = jest.spyOn(scrollService, 'scrollToBottom').mockImplementation(() => {})

        component.unreadMessagesCount = 5
        component.showNewMessagesIndicator = true

        component.scrollToLatestMessages()

        expect(scrollToSpy).toHaveBeenCalled()
        expect(component.showNewMessagesIndicator).toBe(false)
        expect(component.unreadMessagesCount).toBe(0)
      })
    })

    describe('onHistoryScroll', () => {
      it('should clear unread indicator when user scrolls to bottom', () => {
        const resetSpy = jest.spyOn(scrollService, 'resetToBottom')

        component.unreadMessagesCount = 3
        component.showNewMessagesIndicator = true

        component.onHistoryScroll()

        expect(resetSpy).toHaveBeenCalled()
        expect(component.showNewMessagesIndicator).toBe(false)
        expect(component.unreadMessagesCount).toBe(0)
      })
    })

    describe('no duplicate counting', () => {
      it('should not double-count messages that were already known', async () => {
        const scrollToSpy = jest.spyOn(scrollService, 'scrollToBottom').mockImplementation(() => {})

        const messages = [
          createUserMessage({ id: 'm-1' }),
          createChatMessage({ id: 'm-2' })
        ]
        component.chatMessages = messages
        fixture.detectChanges()
        await markMessagesKnown(messages)

        scrollToSpy.mockClear()

        // Re-emit same messages (OnPush re-render)
        await triggerMessageChange(messages)

        expect(scrollToSpy).not.toHaveBeenCalled()
        expect(component.unreadMessagesCount).toBe(0)
        expect(component.showNewMessagesIndicator).toBe(false)
      })
    })
  })
})
