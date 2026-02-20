import { SimpleChanges } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { LetDirective } from '@ngrx/component';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { PortalCoreModule } from '@onecx/portal-integration-angular';
import { TranslateTestingModule } from 'ngx-translate-testing';
import { ChatType } from 'src/app/shared/generated';
import { ChatAssistantActions } from './chat-assistant.actions';
import { ChatAssistantComponent } from './chat-assistant.component';
import { initialState } from './chat-assistant.reducers';

describe('ChatAssistantComponent', () => {
  let component: ChatAssistantComponent;
  let fixture: ComponentFixture<ChatAssistantComponent>;
  let store: MockStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatAssistantComponent,
        PortalCoreModule,
        LetDirective,
        ReactiveFormsModule,
        TranslateTestingModule.withTranslations(
          'en',
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
          require('./../../../../assets/i18n/en.json')
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        ).withTranslations('de', require('./../../../../assets/i18n/de.json')),
      ],
      providers: [
        provideMockStore({
          initialState: { chat: { assistant: initialState } },
        }),
      ],
    }).compileComponents();

    const mutationObserverMock = jest.fn(function MutationObserver(callback) {
      this.observe = jest.fn()
      this.disconnect = jest.fn()
      this.trigger = (mockedMutationsList: any) => {
        callback(mockedMutationsList, this)
      }
      return this
    })
    global.MutationObserver = mutationObserverMock

    global.origin = "";

    fixture = TestBed.createComponent(ChatAssistantComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set selectedChatMode and emit sidebarVisibleChange on close', () => {
    jest.spyOn(store, 'dispatch');
    const spy = jest.spyOn(component.sidebarVisibleChange, 'emit');
    const dispatchSpy = jest.spyOn(store, 'dispatch');

    component.selectChatMode('close');

    expect(component._sidebarVisible).toBe(false);
    expect(dispatchSpy).toHaveBeenCalledWith(ChatAssistantActions.chatPanelClosed());
    expect(spy).toHaveBeenCalledWith(false);
    expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.chatPanelClosed());
  });

  it('should set selectedChatMode to ai mode and dispatch newChatClicked with ai', () => {
    jest.spyOn(store, 'dispatch');

    component.selectChatMode(ChatType.AiChat);

    expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.newChatClicked({ mode: ChatType.AiChat }));
  });

  it('should set selectedChatMode to direct mode and dispatch newChatClicked with human', () => {
    jest.spyOn(store, 'dispatch');
    component.selectChatMode(ChatType.HumanDirectChat);

    expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.newChatClicked({ mode: ChatType.HumanDirectChat }));
  });

  describe('closeSidebar', () => {
    it('should close sidebar, emit event, dispatch action and reset selectedChatMode', () => {
      jest.spyOn(store, 'dispatch');
      jest.spyOn(component.sidebarVisibleChange, 'emit');
      component._sidebarVisible = true;

      component.closeSidebar();

      expect(component._sidebarVisible).toBe(false);
      expect(component.sidebarVisibleChange.emit).toHaveBeenCalledWith(false);
      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.chatPanelClosed());
    });

    it('should work when selectedChatMode is already null', () => {
      jest.spyOn(store, 'dispatch');
      jest.spyOn(component.sidebarVisibleChange, 'emit');
      component._sidebarVisible = true;

      component.closeSidebar();

      expect(component._sidebarVisible).toBe(false);
      expect(component.sidebarVisibleChange.emit).toHaveBeenCalledWith(false);
      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.chatPanelClosed());
    });
  });

  describe('sidebarVisible setter', () => {
    beforeEach(() => {
      jest.spyOn(store, 'dispatch');
    });

    it('should dispatch chatPanelOpened action when sidebarVisible is set to true', () => {
      component.sidebarVisible = true;

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.chatPanelOpened());
      expect(component._sidebarVisible).toBe(true);
    });

    it('should not dispatch action when sidebarVisible is set to false', () => {
      component.sidebarVisible = false;

      expect(store.dispatch).not.toHaveBeenCalled();
      expect(component._sidebarVisible).toBe(false);
    });
  });

  describe('delete action', () => {
    it('should dispatch deleteChatClicked action when delete command is executed', () => {
      jest.spyOn(store, 'dispatch');

      const mockViewModel = {
        chats: [],
        currentChat: { id: 'chat1', topic: 'Test Chat', type: ChatType.AiChat },
        currentMessages: [],
        chatTitleKey: 'CHAT.TITLE.AI'
      };

      store.setState({
        chat: {
          assistant: {
            ...initialState,
            currentChat: mockViewModel.currentChat
          }
        }
      });

      component.deleteChat(mockViewModel.currentChat);

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.deleteChatClicked({
        chat: mockViewModel.currentChat
      }));
    });
  });

  describe('sendMessage', () => {
    it('should dispatch messageSent action with correct message', () => {
      jest.spyOn(store, 'dispatch');
      const testMessage = 'Hello, this is a test message';

      component.sendMessage(testMessage);

      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.messageSent({
          message: testMessage
        })
      );
    });

    it('should handle empty message', () => {
      jest.spyOn(store, 'dispatch');

      component.sendMessage('');

      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.messageSent({
          message: ''
        })
      );
    });
  });

  describe('chatSelected', () => {
    it('should dispatch chatSelected action with correct chat', () => {
      jest.spyOn(store, 'dispatch');
      const testChat = { id: 'chat1', topic: 'Test Chat', type: ChatType.AiChat };

      component.chatSelected(testChat);

      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.chatSelected({
          chat: testChat
        })
      );
    });

    it('should handle chat with different types', () => {
      jest.spyOn(store, 'dispatch');
      const humanChat = { id: 'chat2', topic: 'Human Chat', type: ChatType.HumanDirectChat };

      component.chatSelected(humanChat);

      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.chatSelected({
          chat: humanChat
        })
      );
    });
  });

  describe('ngOnChanges', () => {
    it('should emit sidebarVisibleChange when sidebarVisible changes', () => {
      jest.spyOn(component.sidebarVisibleChange, 'emit');

      const changes: SimpleChanges = {
        sidebarVisible: {
          currentValue: true,
          previousValue: false,
          firstChange: false,
          isFirstChange: () => false
        }
      };

      component.ngOnChanges(changes);

      expect(component.sidebarVisibleChange.emit).toHaveBeenCalledWith(true);
    });

    it('should not emit when sidebarVisible does not change', () => {
      jest.spyOn(component.sidebarVisibleChange, 'emit');

      const changes: SimpleChanges = {
        otherProperty: {
          currentValue: 'new',
          previousValue: 'old',
          firstChange: false,
          isFirstChange: () => false
        }
      };

      component.ngOnChanges(changes);

      expect(component.sidebarVisibleChange.emit).not.toHaveBeenCalled();
    });

    it('should emit with false when sidebar is closed', () => {
      jest.spyOn(component.sidebarVisibleChange, 'emit');

      const changes: SimpleChanges = {
        sidebarVisible: {
          currentValue: false,
          previousValue: true,
          firstChange: false,
          isFirstChange: () => false
        }
      };

      component.ngOnChanges(changes);

      expect(component.sidebarVisibleChange.emit).toHaveBeenCalledWith(false);
    });

    it('goBack should dispatch the correct action', () => {
      jest.spyOn(store, 'dispatch');

      component.goBack();

      expect(store.dispatch).toHaveBeenCalledWith(ChatAssistantActions.backButtonClicked());
    });
  });
});