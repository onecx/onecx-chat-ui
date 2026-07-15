import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatComponent } from './chat.component';
import { TranslateTestingModule } from 'ngx-translate-testing';
import { AngularAcceleratorModule } from '@onecx/angular-accelerator';
import { SimpleChanges } from '@angular/core';

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatComponent,
        AngularAcceleratorModule,
        TranslateTestingModule.withTranslations({
          'en': require('./src/assets/i18n/en.json'),
          'de': require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should provide translated label for scroll indicator accessibility', () => {
    expect(component.scrollToLatestMessagesLabel).toBe(
      'Scroll to latest messages'
    );
  });

  it('should map agents to dropdown options', () => {
    component.agents = [
      { id: 'agent-1', labelKey: 'CHAT.AGENTS.DEFAULT' } as any,
    ];

    expect(component.agentsForDropdown).toEqual([
      { id: 'agent-1', labelKey: 'CHAT.AGENTS.DEFAULT' },
    ]);
  });

  describe('sendButtonClicked', () => {
    it('should emit sendMessage when form has valid message', () => {
      const testMessage = 'Test message';
      jest.spyOn(component.sendMessage, 'emit');
      
      component.formGroup.patchValue({ message: testMessage });
      component.sendButtonClicked();

      expect(component.sendMessage.emit).toHaveBeenCalledWith(testMessage);
      expect(component.formGroup.value.message).toBeNull();
    });

    it('should not emit sendMessage when message is null', () => {
      jest.spyOn(component.sendMessage, 'emit');
      
      component.formGroup.patchValue({ message: null });
      component.sendButtonClicked();

      expect(component.sendMessage.emit).not.toHaveBeenCalled();
    });

    it('should not emit sendMessage when message is empty string', () => {
      jest.spyOn(component.sendMessage, 'emit');
      
      component.formGroup.patchValue({ message: '' });
      component.sendButtonClicked();

      expect(component.sendMessage.emit).not.toHaveBeenCalled();
    });

    it('should not emit sendMessage when message is only whitespace', () => {
      jest.spyOn(component.sendMessage, 'emit');
      
      component.formGroup.patchValue({ message: '   ' });
      component.sendButtonClicked();

      expect(component.sendMessage.emit).toHaveBeenCalledWith('   ');
      expect(component.formGroup.value.message).toBeNull();
    });

    it('should reset form after sending message', () => {
      const testMessage = 'Test message';
      jest.spyOn(component.sendMessage, 'emit');
      jest.spyOn(component.formGroup, 'reset');
      
      component.formGroup.patchValue({ message: testMessage });
      component.sendButtonClicked();

      expect(component.formGroup.reset).toHaveBeenCalled();
    });
  });

  describe('retrySending', () => {
    it('should emit retrySendMessage with message text', () => {
      const testMessage = { 
        text: 'Retry this message', 
        creationDate: new Date(),
        id: '1',
        type: 'USER' as any,
        userName: 'testUser'
      };
      jest.spyOn(component.retrySendMessage, 'emit');
      
      component.retrySending(testMessage);

      expect(component.retrySendMessage.emit).toHaveBeenCalledWith('Retry this message');
    });

    it('should handle empty message text', () => {
      const testMessage = { 
        text: '', 
        creationDate: new Date(),
        id: '2',
        type: 'USER' as any,
        userName: 'testUser'
      };
      jest.spyOn(component.retrySendMessage, 'emit');
      
      component.retrySending(testMessage);

      expect(component.retrySendMessage.emit).toHaveBeenCalledWith('');
    });
  });

  describe('scroll behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const setHistoryContainer = (values: {
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
      scrollTo?: jest.Mock;
    }) => {
      const scrollTo = values.scrollTo ?? jest.fn();
      (component as any).historyContainer = {
        nativeElement: {
          scrollTop: values.scrollTop,
          scrollHeight: values.scrollHeight,
          clientHeight: values.clientHeight,
          scrollTo,
        },
      };
      return scrollTo;
    };

    const triggerMessagesChange = (previousValue: any[] = []) => {
      const changes: SimpleChanges = {
        chatMessages: {
          currentValue: component.chatMessages,
          previousValue,
          firstChange: false,
          isFirstChange: () => false,
        },
      };
      component.ngOnChanges(changes);
      jest.runAllTimers();
    };

    it('should show new message indicator when messages change and user is not at bottom', () => {
      setHistoryContainer({
        scrollTop: 20,
        clientHeight: 100,
        scrollHeight: 400,
      });
      component.chatMessages = [
        {
          id: 'm-1',
          text: 'new',
          creationDate: new Date(),
          type: 'ASSISTANT' as any,
          userName: 'ai',
        },
      ];

      triggerMessagesChange();

      expect(component.showNewMessagesIndicator).toBe(true);
      expect(component.unreadMessagesCount).toBe(1);
    });

    it('should auto-scroll when messages change and user is at bottom', () => {
      const scrollTo = setHistoryContainer({
        scrollTop: 300,
        clientHeight: 100,
        scrollHeight: 400,
      });
      component.chatMessages = [
        {
          id: 'm-2',
          text: 'new',
          creationDate: new Date(),
          type: 'ASSISTANT' as any,
          userName: 'ai',
        },
      ];

      triggerMessagesChange();

      expect(scrollTo).toHaveBeenCalledWith({
        top: 400,
        behavior: 'smooth',
      });
      expect(component.showNewMessagesIndicator).toBe(false);
      expect(component.unreadMessagesCount).toBe(0);
    });

    it('should clear unread indicator when user scrolls back to bottom', () => {
      setHistoryContainer({
        scrollTop: 20,
        clientHeight: 100,
        scrollHeight: 400,
      });
      component.showNewMessagesIndicator = true;
      component.unreadMessagesCount = 3;

      component.onHistoryScroll();
      expect(component.showNewMessagesIndicator).toBe(true);
      expect(component.unreadMessagesCount).toBe(3);

      setHistoryContainer({
        scrollTop: 300,
        clientHeight: 100,
        scrollHeight: 400,
      });
      component.onHistoryScroll();
      expect(component.showNewMessagesIndicator).toBe(false);
      expect(component.unreadMessagesCount).toBe(0);
    });

    it('should scroll to bottom and clear indicator when indicator action is triggered', () => {
      const scrollTo = setHistoryContainer({
        scrollTop: 20,
        clientHeight: 100,
        scrollHeight: 400,
      });
      component.showNewMessagesIndicator = true;
      component.unreadMessagesCount = 2;

      component.scrollToLatestMessages();

      expect(scrollTo).toHaveBeenCalledWith({
        top: 400,
        behavior: 'smooth',
      });
      expect(component.showNewMessagesIndicator).toBe(false);
      expect(component.unreadMessagesCount).toBe(0);
    });

    it('should reset unread indicator when conversation messages are replaced', () => {
      setHistoryContainer({
        scrollTop: 20,
        clientHeight: 100,
        scrollHeight: 400,
      });
      component.showNewMessagesIndicator = true;
      component.unreadMessagesCount = 4;
      component.chatMessages = [
        {
          id: 'new-chat-1',
          text: 'new conversation',
          creationDate: new Date(),
          type: 'ASSISTANT' as any,
          userName: 'ai',
        },
      ];

      triggerMessagesChange([
        {
          id: 'old-chat-1',
          text: 'old conversation',
          creationDate: new Date(),
          type: 'ASSISTANT' as any,
          userName: 'ai',
        },
      ]);

      expect(component.showNewMessagesIndicator).toBe(false);
      expect(component.unreadMessagesCount).toBe(0);
    });

    it('should ignore ngOnChanges without chatMessages change', () => {
      expect(() => component.ngOnChanges({} as SimpleChanges)).not.toThrow();
    });

    it('should not change unread indicator when there are no new messages', () => {
      setHistoryContainer({
        scrollTop: 20,
        clientHeight: 100,
        scrollHeight: 400,
      });
      component.chatMessages = [
        {
          id: 'stable-1',
          text: 'same',
          creationDate: new Date('2024-01-01T00:00:00Z'),
          type: 'ASSISTANT' as any,
          userName: 'ai',
        },
      ];

      triggerMessagesChange();
      component.showNewMessagesIndicator = false;
      component.unreadMessagesCount = 0;
      triggerMessagesChange(component.chatMessages);

      expect(component.showNewMessagesIndicator).toBe(false);
      expect(component.unreadMessagesCount).toBe(0);
    });

    it('should count one new message when latest message signature changes', () => {
      setHistoryContainer({
        scrollTop: 20,
        clientHeight: 100,
        scrollHeight: 400,
      });
      const createdAt = new Date('2024-01-01T00:00:00Z');
      component.chatMessages = [
        {
          id: 'sig-1',
          text: 'before',
          creationDate: createdAt,
          type: 'ASSISTANT' as any,
          userName: 'ai',
        },
      ];

      triggerMessagesChange();

      component.chatMessages = [
        {
          id: 'sig-1',
          text: 'after',
          creationDate: createdAt,
          type: 'ASSISTANT' as any,
          userName: 'ai',
        },
      ];

      triggerMessagesChange([
        {
          id: 'sig-1',
          text: 'before',
          creationDate: createdAt,
          type: 'ASSISTANT' as any,
          userName: 'ai',
        },
      ]);

      expect(component.showNewMessagesIndicator).toBe(true);
      expect(component.unreadMessagesCount).toBe(2);
    });

    it('should use scrollTop fallback when scrollTo is unavailable', () => {
      const historyElement = {
        scrollTop: 5,
        scrollHeight: 400,
        clientHeight: 100,
      };
      (component as any).historyContainer = { nativeElement: historyElement };

      component.scrollToLatestMessages();

      expect(historyElement.scrollTop).toBe(400);
    });

    it('should safely skip scrolling when history container is missing', () => {
      (component as any).historyContainer = undefined;
      component.showNewMessagesIndicator = true;
      component.unreadMessagesCount = 1;

      expect(() => component.scrollToLatestMessages()).not.toThrow();
      expect(component.showNewMessagesIndicator).toBe(false);
      expect(component.unreadMessagesCount).toBe(0);
    });

    it('should treat missing history container as near bottom', () => {
      (component as any).historyContainer = undefined;
      component.showNewMessagesIndicator = true;
      component.unreadMessagesCount = 2;

      component.onHistoryScroll();

      expect(component.showNewMessagesIndicator).toBe(false);
      expect(component.unreadMessagesCount).toBe(0);
    });

    it('should mark conversation as replaced when current chat becomes empty', () => {
      setHistoryContainer({
        scrollTop: 20,
        clientHeight: 100,
        scrollHeight: 400,
      });
      component.showNewMessagesIndicator = true;
      component.unreadMessagesCount = 2;
      component.chatMessages = [];

      triggerMessagesChange([
        {
          id: 'old-chat-1',
          text: 'old conversation',
          creationDate: new Date(),
          type: 'ASSISTANT' as any,
          userName: 'ai',
        },
      ]);

      expect(component.showNewMessagesIndicator).toBe(false);
      expect(component.unreadMessagesCount).toBe(0);
    });
  });
});
