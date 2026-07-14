import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { ChatComponent } from './chat.component';
import { TranslateTestingModule } from 'ngx-translate-testing';
import { AngularAcceleratorModule } from '@onecx/angular-accelerator';

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

  const createChatMessage = (id: string, text: string) => ({
    creationDate: new Date(),
    id,
    type: 'HUMAN' as any,
    text,
    userName: 'test-user',
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
    it('should show unread indicator if user is not near bottom when new messages arrive', fakeAsync(() => {
      jest.spyOn(component as any, 'isNearBottom').mockReturnValue(false);
      (component as any).wasNearBottom = false;
      (component as any).previousMessageCount = 1;
      component.chatMessages = [
        createChatMessage('1', 'first'),
        createChatMessage('2', 'second'),
      ] as any;

      component.ngOnChanges({
        chatMessages: new SimpleChange([createChatMessage('1', 'first')], component.chatMessages, false),
      });
      flushMicrotasks();

      expect(component.showNewMessageIndicator).toBe(true);
      expect(component.unreadMessagesCount).toBe(1);
    }));

    it('should scroll to bottom when user is near bottom and new messages arrive', fakeAsync(() => {
      const scrollSpy = jest.spyOn(component as any, 'scrollToBottom');
      (component as any).wasNearBottom = true;
      (component as any).previousMessageCount = 0;
      component.chatMessages = [createChatMessage('1', 'first')] as any;

      component.ngOnChanges({
        chatMessages: new SimpleChange([], component.chatMessages, true),
      });
      flushMicrotasks();

      expect(scrollSpy).toHaveBeenCalledWith('smooth');
      expect(component.showNewMessageIndicator).toBe(false);
      expect(component.unreadMessagesCount).toBe(0);
    }));

    it('should reset unread indicator after scrollToLatestMessages', () => {
      const scrollSpy = jest.spyOn(component as any, 'scrollToBottom');
      component.showNewMessageIndicator = true;
      component.unreadMessagesCount = 3;

      component.scrollToLatestMessages();

      expect(scrollSpy).toHaveBeenCalledWith('smooth');
      expect(component.showNewMessageIndicator).toBe(false);
      expect(component.unreadMessagesCount).toBe(0);
    });
  });
});
