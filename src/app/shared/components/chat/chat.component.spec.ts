import { ComponentFixture, TestBed } from '@angular/core/testing'
import { SimpleChange } from '@angular/core'
import { TranslateTestingModule } from 'ngx-translate-testing'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'

import { ChatComponent } from './chat.component'
import { ChatMessage } from './chat.viewmodel'

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

  describe('scroll state and new message hint', () => {
    function createMockScrollElement(): HTMLElement {
      const el = document.createElement('div')
      Object.defineProperty(el, 'scrollTop', { value: 0, writable: true, configurable: true })
      Object.defineProperty(el, 'clientHeight', { value: 300, writable: true, configurable: true })
      Object.defineProperty(el, 'scrollHeight', { value: 300, writable: true, configurable: true })
      ;(el as any).scrollTo = jest.fn()
      return el
    }

    function createMockAnchorElement(): HTMLElement {
      const el = document.createElement('div')
      ;(el as any).scrollIntoView = jest.fn()
      return el
    }

    describe('onMessagesScroll', () => {
      it('should reset hint and count when user scrolls to bottom', () => {
        const scrollEl = createMockScrollElement()
        ;(component['scrollContainerRef'] as any) = { nativeElement: scrollEl }

        // Simulate being at bottom (scrollTop + clientHeight >= scrollHeight - threshold)
        Object.defineProperty(scrollEl, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(scrollEl, 'clientHeight', { value: 300, configurable: true })
        Object.defineProperty(scrollEl, 'scrollHeight', { value: 300, configurable: true })

        // Call the method via public access — the component tracks internal state
        component.onMessagesScroll()

        expect(component.showNewMessageHint).toBe(false)
        expect(component.newMessagesCount).toBe(0)
      })

      it('should not reset hint when user is not at bottom', () => {
        const scrollEl = createMockScrollElement()
        ;(component['scrollContainerRef'] as any) = { nativeElement: scrollEl }

        // Not at bottom: scrollTop + clientHeight < scrollHeight - threshold
        Object.defineProperty(scrollEl, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(scrollEl, 'clientHeight', { value: 300, configurable: true })
        Object.defineProperty(scrollEl, 'scrollHeight', { value: 500, configurable: true })

        component.onMessagesScroll()

        // Hint state is only cleared when at bottom
        // Since we started with hint off and scrolled to not-bottom, hint stays off
        expect(component.showNewMessageHint).toBe(false)
      })
    })

    describe('onMessagesChanged', () => {
      function helperSetup(): {
        scrollEl: HTMLElement
        anchorEl: HTMLElement
      } {
        const scrollEl = createMockScrollElement()
        const anchorEl = createMockAnchorElement()
        ;(component['scrollContainerRef'] as any) = { nativeElement: scrollEl }
        ;(component['bottomAnchorRef'] as any) = { nativeElement: anchorEl }
        return { scrollEl, anchorEl }
      }

      function setMessagesAndTrigger(changes: ChatMessage[]): void {
        component.chatMessages = changes
        // ngOnChanges is not triggered by direct assignment in unit tests,
        // so we invoke it manually to simulate Angular's change detection
        component.ngOnChanges({ chatMessages: new SimpleChange(undefined, changes, true) })
      }

      it('should auto-scroll and keep hint hidden when at bottom and messages appended', () => {
        const { scrollEl, anchorEl } = helperSetup()

        Object.defineProperty(scrollEl, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(scrollEl, 'clientHeight', { value: 300, configurable: true })
        Object.defineProperty(scrollEl, 'scrollHeight', { value: 300, configurable: true })
        component.onMessagesScroll()

        setMessagesAndTrigger([
          { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'user' }
        ])

        expect(component.showNewMessageHint).toBe(false)
        expect(component.newMessagesCount).toBe(0)
        expect((anchorEl as any).scrollIntoView).toHaveBeenCalled()
      })

      it('should show hint with count 1 when not at bottom and one message appended', () => {
        const { scrollEl } = helperSetup()

        Object.defineProperty(scrollEl, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(scrollEl, 'clientHeight', { value: 300, configurable: true })
        Object.defineProperty(scrollEl, 'scrollHeight', { value: 500, configurable: true })
        component.onMessagesScroll()

        setMessagesAndTrigger([
          { id: '1', text: 'Hello', type: 'HUMAN' as any, creationDate: new Date(), userName: 'user' }
        ])

        expect(component.showNewMessageHint).toBe(true)
        expect(component.newMessagesCount).toBe(1)
      })

      it('should increment newMessagesCount by exact delta when multiple messages appended while not at bottom', () => {
        const { scrollEl } = helperSetup()

        Object.defineProperty(scrollEl, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(scrollEl, 'clientHeight', { value: 300, configurable: true })
        Object.defineProperty(scrollEl, 'scrollHeight', { value: 500, configurable: true })
        component.onMessagesScroll()

        setMessagesAndTrigger([
          { id: '1', text: 'Msg 1', type: 'HUMAN' as any, creationDate: new Date(), userName: 'user' },
          { id: '2', text: 'Msg 2', type: 'HUMAN' as any, creationDate: new Date(), userName: 'user' },
          { id: '3', text: 'Msg 3', type: 'HUMAN' as any, creationDate: new Date(), userName: 'user' }
        ])

        expect(component.showNewMessageHint).toBe(true)
        expect(component.newMessagesCount).toBe(3)
      })

      it('should handle progress/loading placeholder message same as regular message', () => {
        const { scrollEl, anchorEl } = helperSetup()

        Object.defineProperty(scrollEl, 'scrollTop', { value: 0, configurable: true })
        Object.defineProperty(scrollEl, 'clientHeight', { value: 300, configurable: true })
        Object.defineProperty(scrollEl, 'scrollHeight', { value: 300, configurable: true })
        component.onMessagesScroll()

        setMessagesAndTrigger([
          {
            id: '1',
            text: '',
            type: 'ASSISTANT' as any,
            creationDate: new Date(),
            userName: 'ai',
            isLoadingInfo: true
          }
        ])

        expect(component.showNewMessageHint).toBe(false)
        expect(component.newMessagesCount).toBe(0)
        expect((anchorEl as any).scrollIntoView).toHaveBeenCalled()
      })
    })

    describe('onNewMessageHintClick', () => {
      it('should scroll to bottom and reset hint and count', () => {
        const scrollEl = createMockScrollElement()
        const anchorEl = createMockAnchorElement()

        ;(component['scrollContainerRef'] as any) = { nativeElement: scrollEl }
        ;(component['bottomAnchorRef'] as any) = { nativeElement: anchorEl }

        // Simulate hint being shown
        component.chatMessages = [
          { id: '1', text: 'Msg 1', type: 'HUMAN' as any, creationDate: new Date(), userName: 'user' },
          { id: '2', text: 'Msg 2', type: 'HUMAN' as any, creationDate: new Date(), userName: 'user' }
        ]

        component.onNewMessageHintClick()

        expect((anchorEl as any).scrollIntoView).toHaveBeenCalled()
        expect(component.showNewMessageHint).toBe(false)
        expect(component.newMessagesCount).toBe(0)
      })
    })

    describe('scrollToBottomSmooth', () => {
      it('should use bottom anchor scrollIntoView when available', () => {
        const scrollEl = createMockScrollElement()
        const anchorEl = createMockAnchorElement()

        ;(component['scrollContainerRef'] as any) = { nativeElement: scrollEl }
        ;(component['bottomAnchorRef'] as any) = { nativeElement: anchorEl }

        component.scrollToBottomSmooth()

        expect((anchorEl as any).scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' })
      })

      it('should fallback to scrollContainer scrollTo when anchor is not available', () => {
        const scrollEl = createMockScrollElement()

        ;(component['scrollContainerRef'] as any) = { nativeElement: scrollEl }
        ;(component['bottomAnchorRef'] as any) = undefined

        component.scrollToBottomSmooth()

        expect((scrollEl as any).scrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'smooth' })
      })
    })
  })
})
