import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { provideMockActions } from '@ngrx/effects/testing';
import { routerNavigatedAction, RouterNavigatedPayload } from '@ngrx/router-store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import { UserService } from '@onecx/angular-integration-interface';
import { ChatInternalService } from 'src/app/shared/services/chat-internal.service';
import {
  Chat,
  ChatsService,
  ChatType,
  MessageType,
} from 'src/app/shared/generated';
import { ChatAssistantActions } from './chat-assistant.actions';
import { ChatAssistantEffects } from './chat-assistant.effects';
import { chatAssistantSelectors, selectChatTopic } from './chat-assistant.selectors';
import { CHAT_AGENTS, DEFAULT_AGENT_ID } from './chat-assistant.state';
import { createNotification } from 'src/app/shared/utils/notification.test.utils';

// Mock only the filterForNavigatedTo function from @onecx/ngrx-accelerator
jest.mock('@onecx/ngrx-accelerator', () => ({
  ...jest.requireActual('@onecx/ngrx-accelerator'),
  filterForNavigatedTo: jest.fn().mockReturnValue((source: Observable<any>) => source)
}));

describe('ChatAssistantEffects', () => {
  let effects: ChatAssistantEffects;
  let actions$: Observable<any>;
  let store: MockStore;
  let chatInternalService: any;
  let remoteChatInternalService: any;
  let profileSubject: Subject<any>;

  const mockUser = 'test@example.com';

  const mockChat = {
    id: 'chat1',
    topic: 'Test Chat',
    type: ChatType.AiChat,
    participants: []
  };

  const mockChats = [
    { id: 'chat1', topic: 'Test Chat 1', type: ChatType.AiChat },
    { id: 'chat2', topic: 'Test Chat 2', type: ChatType.HumanDirectChat }
  ];

  const mockMessages = [
    {
      id: 'msg1',
      text: 'Hello',
      type: MessageType.Human,
      creationDate: '2023-01-01T10:00:00Z'
    },
    {
      id: 'msg2',
      text: 'Hi there',
      type: MessageType.Assistant,
      creationDate: '2023-01-01T10:01:00Z'
    }
  ];

  const mockMessage = {
    id: 'msg3',
    text: 'New message',
    type: MessageType.Human,
    creationDate: '2023-01-01T10:02:00Z'
  };

  const initialState = {
    chatAssistant: {
      user: mockUser,
      chats: [],
      currentChat: undefined,
      currentMessages: undefined,
      topic: 'chat-assistant',
      selectedChatMode: null
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    profileSubject = new Subject<any>();
    const chatInternalServiceSpy = {
      searchChats: jest.fn(),
      getChatMessages: jest.fn(),
      createChat: jest.fn(),
      createChatMessage: jest.fn(),
      deleteChat: jest.fn(),
      updateChat: jest.fn()
    };

    const remoteChatInternalServiceSpy = {
      getService: jest.fn()
    };

    const routerSpy = {
      navigate: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        ChatAssistantEffects,
        provideMockActions(() => actions$),
        provideMockStore({ initialState }),
        { provide: ChatsService, useValue: chatInternalServiceSpy },
        { provide: ChatInternalService, useValue: remoteChatInternalServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: UserService, useValue: { profile$: profileSubject.asObservable() } },
      ]
    });

    effects = TestBed.inject(ChatAssistantEffects);
    actions$ = TestBed.inject(Actions);
    store = TestBed.inject(MockStore);
    chatInternalService = TestBed.inject(ChatsService);
    remoteChatInternalService = TestBed.inject(ChatInternalService);

    // Setup default behavior for remote service
    remoteChatInternalService.getService.mockReturnValue(null);
  });

  describe('chatInternalService getter', () => {
    it('should return remote service when available', () => {
      const mockRemoteService = { getChats: jest.fn() };
      remoteChatInternalService.getService.mockReturnValue(mockRemoteService);

      expect(effects.chatInternalService).toBe(mockRemoteService);
    });

    it('should return local service when remote service is not available', () => {
      remoteChatInternalService.getService.mockReturnValue(null);

      expect(effects.chatInternalService).toBe(chatInternalService);
    });
  });

  describe('initChatOnNavigation$', () => {
    it('should be defined', () => {
      expect(effects.initChatOnNavigation$).toBeDefined();
    });

    it('should dispatch chatInitialized action when router navigated action occurs', (done) => {
      // Test the actual effect execution with switchMap
      const routerAction = routerNavigatedAction({
        payload: {
          routerState: { url: '/chat-assistant', root: {} as any },
          event: {} as RouterNavigatedPayload['event']
        }
      });

      actions$ = of(routerAction);

      effects.initChatOnNavigation$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatInitialized());
        done();
      });
    });

    it('should execute switchMap and return correct action from of()', (done) => {
      // Test the switchMap logic specifically - this covers the switchMap(() => { return of(...) }) part
      const routerAction = routerNavigatedAction({
        payload: {
          routerState: { url: '/chat-assistant', root: {} as any },
          event: {} as RouterNavigatedPayload['event']
        }
      });

      actions$ = of(routerAction);

      effects.initChatOnNavigation$.subscribe(action => {
        expect(action).toEqual(ChatAssistantActions.chatInitialized());
        done();
      });
    });

    it('should not dispatch chatInitialized action if already initialized', (done) => {
      let emitted = false;

      store.overrideSelector(chatAssistantSelectors.selectChatInitialized, true);
      const routerAction = routerNavigatedAction({
        payload: {
          routerState: { url: '/chat-assistant', root: {} as any },
          event: {} as RouterNavigatedPayload['event']
        }
      });
      actions$ = of(routerAction);

      effects.initChatOnNavigation$.pipe(take(1)).subscribe({
        next: () => {
          emitted = true;
          fail('Should not emit');
        },
        complete: () => {
          expect(emitted).toBeFalsy();
          done();
        }
      });
    });
  });

  describe('loadUserProfile$', () => {
    it('should set user to the email string from person.email', (done) => {
      effects.loadUserProfile$.pipe(take(1)).subscribe((result: any) => {
        expect(result.user).toBe('specific@domain.com');
        expect(typeof result.user).toBe('string');
        done();
      });
      profileSubject.next({ person: { email: 'specific@domain.com' } });
    });
    
    it('should NOT dispatch when profile is null', (done) => {
      let emitted = false;
      effects.loadUserProfile$.subscribe({
        next: () => { emitted = true; },
        complete: () => {
          expect(emitted).toBe(false);
          done();
        }
      });

      profileSubject.next(null);
      profileSubject.complete();
    });
  });

  describe('triggerLoadChats$', () => {
    it('should dispatch loadChats with reset true when chatInitialized is dispatched', (done) => {
      actions$ = of(ChatAssistantActions.chatInitialized());
      effects.triggerLoadChats$.subscribe(action => {
        expect(action).toEqual(ChatAssistantActions.loadChats({ reset: true }));
        done();
      });
    });
  });

  describe('triggerLoadNextPage$', () => {
    it('should dispatch loadChats with reset false when fetchNextChatsPage is dispatched', (done) => {
      actions$ = of(ChatAssistantActions.fetchNextChatsPage());
      effects.triggerLoadNextPage$.subscribe(action => {
        expect(action).toEqual(ChatAssistantActions.loadChats({ reset: false }));
        done();
      });
    });
  });

  describe('loadChats$', () => {
    beforeEach(() => {
      chatInternalService.searchChats.mockReturnValue(of({ stream: mockChats, totalElements: mockChats.length }));
      store.overrideSelector(chatAssistantSelectors.selectChats, []);
      store.overrideSelector(chatAssistantSelectors.selectTotalAvailableChats, 2);
      store.overrideSelector(chatAssistantSelectors.selectSearchQuery, '');
    });

    it('should format searchQuery with % wildcards when searchQuery has value', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectSearchQuery, 'AI Chat');

      const action = ChatAssistantActions.loadChats({ reset: true });
      actions$ = of(action);

      effects.loadChats$.pipe(take(1)).subscribe(() => {
        expect(chatInternalService.searchChats).toHaveBeenCalledWith({
          topic: '%AI Chat%',
          pageNumber: 0,
          pageSize: 20
        });
        done();
      });
    });

    it('should load data when loadChats is dispatched with reset true', (done) => {
      const action = ChatAssistantActions.loadChats({ reset: true });
      actions$ = of(action);

      effects.loadChats$.pipe(take(1)).subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: mockChats,
          totalElements: 2,
          append: false
        }));
        expect(chatInternalService.searchChats).toHaveBeenCalledWith({ topic: undefined, pageNumber: 0, pageSize: 20 });
        done();
      });
    });

    it('should append data and increment offset when loadChats is dispatched with reset false', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectChats, Array(20).fill(mockChat));
      store.overrideSelector(chatAssistantSelectors.selectTotalAvailableChats, 100);

      const action = ChatAssistantActions.loadChats({ reset: false });
      actions$ = of(action);

      effects.loadChats$.pipe(take(1)).subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: mockChats,
          totalElements: 2,
          append: true
        }));
        expect(chatInternalService.searchChats).toHaveBeenCalledWith({ topic: undefined, pageNumber: 1, pageSize: 20 });
        done();
      });
    });

    it('should handle error when loading chats fails', (done) => {
      const error = 'Failed to load chats';
      chatInternalService.searchChats.mockReturnValue(throwError(() => error));

      const action = ChatAssistantActions.loadChats({ reset: true });
      actions$ = of(action);

      effects.loadChats$.pipe(take(1)).subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoadingFailed({ error }));
        done();
      });
    });

    it('should handle empty chats response', (done) => {
      chatInternalService.searchChats.mockReturnValue(of({ stream: undefined, totalElements: 0 }));

      const action = ChatAssistantActions.loadChats({ reset: true });
      actions$ = of(action);

      effects.loadChats$.pipe(take(1)).subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: [],
          totalElements: 0,
          append: false
        }));
        done();
      });
    });

    it('should handle null stream in response', (done) => {
      chatInternalService.searchChats.mockReturnValue(of({ stream: null, totalElements: 0 }));

      const action = ChatAssistantActions.loadChats({ reset: true });
      actions$ = of(action);

      effects.loadChats$.pipe(take(1)).subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: [],
          totalElements: 0,
          append: false
        }));
        done();
      });
    });

    it('should handle response without stream property', (done) => {
      chatInternalService.searchChats.mockReturnValue(of({ totalElements: 0 }));

      const action = ChatAssistantActions.loadChats({ reset: true });
      actions$ = of(action);

      effects.loadChats$.pipe(take(1)).subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: [],
          totalElements: 0,
          append: false
        }));
        done();
      });
    });

    it('should handle response with undefined totalElements by defaulting to 0', (done) => {
      chatInternalService.searchChats.mockReturnValue(of({ stream: mockChats }));

      const action = ChatAssistantActions.loadChats({ reset: true });
      actions$ = of(action);

      effects.loadChats$.pipe(take(1)).subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: mockChats,
          totalElements: 0,
          append: false
        }));
        done();
      });
    });

    it('should not throw error when searchQuery is undefined and using optional chaining searchQuery?.trim()', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectChats, []);
      store.overrideSelector(chatAssistantSelectors.selectTotalAvailableChats, 5);
      store.overrideSelector(chatAssistantSelectors.selectSearchQuery, undefined as any);

      chatInternalService.searchChats.mockReturnValue(of({ stream: [], totalElements: 5 }));

      const action = ChatAssistantActions.loadChats({ reset: true });
      actions$ = of(action);

      effects.loadChats$.pipe(take(1)).subscribe(
        (result: any) => {
          expect(result).toBeTruthy();
          done();
        },
        (error) => {
          fail(`Should not throw error, but got: ${error}`);
        }
      );
    });
  });

  describe('handleChatNotifications$', () => {
    it('should dispatch refreshCurrentChat for update_chat targeting the current chat', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, mockChat as any);
      store.refreshState();

      const notification = createNotification('onecx-chat', [
        { key: 'type', value: 'update_chat' },
        { key: 'chatId', value: 'chat1' },
      ]);

      actions$ = of(ChatAssistantActions.notificationReceived({ notification }));

      effects.handleChatNotifications$.pipe(take(1)).subscribe((result) => {
        expect(result).toEqual(ChatAssistantActions.refreshCurrentChat());
        done();
      });
    });

    it('should dispatch refreshChatList for update_chat targeting a different chat', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, mockChat as any);
      store.refreshState();

      const notification = createNotification('onecx-chat', [
        { key: 'type', value: 'update_chat' },
        { key: 'chatId', value: 'chat2' },
      ]);

      actions$ = of(ChatAssistantActions.notificationReceived({ notification }));

      effects.handleChatNotifications$.pipe(take(1)).subscribe((result) => {
        expect(result).toEqual(ChatAssistantActions.refreshChatList({ reset: true }));
        done();
      });
    });

    it('should dispatch refreshChatList when currentChat is undefined and update_chat is received', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, undefined);
      store.refreshState();

      const notification = createNotification('onecx-chat', [
        { key: 'type', value: 'update_chat' },
        { key: 'chatId', value: 'chat1' },
      ]);

      actions$ = of(ChatAssistantActions.notificationReceived({ notification }));

      effects.handleChatNotifications$.pipe(take(1)).subscribe((result) => {
        expect(result).toEqual(ChatAssistantActions.refreshChatList({ reset: true }));
        done();
      });
    });

    it('should dispatch chatNotificationIgnored for unknown chat notifications', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, mockChat as any);
      store.refreshState();

      const notification = createNotification('onecx-chat', [
        { key: 'type', value: 'unknown_type' },
        { key: 'chatId', value: 'chat1' },
      ]);

      actions$ = of(ChatAssistantActions.notificationReceived({ notification }));

      effects.handleChatNotifications$.pipe(take(1)).subscribe((result) => {
        expect(result).toEqual(ChatAssistantActions.chatNotificationIgnored());
        done();
      });
    });
  });

  describe('loadAvailableMessages$', () => {
    beforeEach(() => {
      chatInternalService.getChatMessages.mockReturnValue(of(mockMessages));
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, mockChat);
    });

    it('should load messages when chatSelected action is dispatched', (done) => {
      const action = ChatAssistantActions.chatSelected({ chat: mockChat });
      actions$ = of(action);

      effects.loadAvailableMessages$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.messagesLoaded({ messages: mockMessages }));
        expect(chatInternalService.getChatMessages).toHaveBeenCalledWith('chat1');
        done();
      });
    });

    it('should load messages when messageSendingSuccessful action is dispatched', (done) => {
      const action = ChatAssistantActions.messageSendingSuccessful({ message: mockMessage });
      actions$ = of(action);

      effects.loadAvailableMessages$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.messagesLoaded({ messages: mockMessages }));
        done();
      });
    });

    it('should not load messages when chat is undefined (covers chat?.id optional chaining)', (done) => {
      let emitted = false;

      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, undefined);

      const action = ChatAssistantActions.chatSelected({ chat: undefined as any });
      actions$ = of(action);

      effects.loadAvailableMessages$.pipe(take(1)).subscribe({
        next: () => {
          emitted = true;
          fail('Should not emit');
        },
        complete: () => {
          expect(emitted).toBeFalsy();
          done();
        }
      });
    });

    it('should pass empty string to getChatMessages when chat.id is null (covers chat?.id ?? "" with null value)', (done) => {

      const chatWithNullId = { ...mockChat, id: null as any };
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, chatWithNullId);

      const action = ChatAssistantActions.chatSelected({ chat: chatWithNullId });
      actions$ = of(action);

      effects.loadAvailableMessages$.subscribe(result => {
        expect(chatInternalService.getChatMessages).toHaveBeenCalledWith('');
        expect(result).toEqual(ChatAssistantActions.messagesLoaded({ messages: mockMessages }));
        done();
      });
    });

    it('should not load messages when chat id is "new"', (done) => {
      let emitted = false;

      const newChat = { ...mockChat, id: 'new' };
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, newChat);

      const action = ChatAssistantActions.chatSelected({ chat: newChat });
      actions$ = of(action);

      effects.loadAvailableMessages$.pipe(take(1)).subscribe({
        next: () => {
          emitted = true;
          fail('Should not emit');
        },
        complete: () => {
          expect(emitted).toBeFalsy();
          done();
        }
      });
    });

    it('should handle error when loading messages fails', (done) => {
      const error = 'Failed to load messages';
      chatInternalService.getChatMessages.mockReturnValue(throwError(() => error));

      const action = ChatAssistantActions.chatSelected({ chat: mockChat });
      actions$ = of(action);

      effects.loadAvailableMessages$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.messagesLoadingFailed({ error }));
        done();
      });
    });
  });

  describe('deleteChat$', () => {
    beforeEach(() => {
      chatInternalService.deleteChat.mockReturnValue(of({}));
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, mockChat);
    });

    it('should delete chat when deleteChatClicked action is dispatched', (done) => {
      const action = ChatAssistantActions.deleteChatClicked({ chat: mockChat });
      actions$ = of(action);

      effects.deleteChat$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatDeletionSuccessful({ chatId: mockChat.id }));
        expect(chatInternalService.deleteChat).toHaveBeenCalledWith(mockChat.id);
        done();
      });
    });

    it('should not delete chat when chat is undefined (covers chat?.id optional chaining in filter)', (done) => {
      let emitted = false;

      const action = ChatAssistantActions.deleteChatClicked({ chat: undefined as any });
      actions$ = of(action);

      effects.deleteChat$.pipe(take(1)).subscribe({
        next: () => {
          emitted = true;
          fail('Should not emit');
        },
        complete: () => {
          expect(emitted).toBeFalsy();
          done();
        }
      });
    });

    it('should call deleteChat with empty string and return chatId "" when chat.id is null (covers ?? "" fallback)', (done) => {
      const chatWithNullId = { ...mockChat, id: null as any };
      const action = ChatAssistantActions.deleteChatClicked({ chat: chatWithNullId });
      actions$ = of(action);

      effects.deleteChat$.subscribe(result => {
        expect(chatInternalService.deleteChat).toHaveBeenCalledWith('');
        expect(result).toEqual(ChatAssistantActions.chatDeletionSuccessful({ chatId: '' }));
        done();
      });
    });

    it('should handle error when chat deletion fails', (done) => {
      const error = 'Failed to delete chat';
      chatInternalService.deleteChat.mockReturnValue(throwError(() => error));

      const action = ChatAssistantActions.deleteChatClicked({ chat: mockChat });
      actions$ = of(action);

      effects.deleteChat$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatDeletionFailed({ error }));
        done();
      });
    });
  });

  describe('saveSettings$', () => {
    it('should dispatch updateCurrentChat with merged chat when currentChat exists', (done) => {
      const currentChat: Chat = { id: 'chat1', topic: 'old topic', type: ChatType.AiChat, participants: [] };
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, currentChat);
      store.refreshState();

      actions$ = of(ChatAssistantActions.saveSettingsClicked({ chatName: 'New Topic' }));

      effects.saveSettings$.pipe(take(1)).subscribe((result) => {
        expect(result).toEqual(
          ChatAssistantActions.updateCurrentChat({ chat: { ...currentChat, topic: 'New Topic' } })
        );
        done();
      });
    });

    it('should use empty string as topic when chatName and currentChat.topic are both undefined', (done) => {
      const currentChat = { id: 'chat1', type: ChatType.AiChat, participants: [] } as Chat;
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, currentChat);
      store.refreshState();

      actions$ = of(ChatAssistantActions.saveSettingsClicked({ chatName: undefined }));

      effects.saveSettings$.pipe(take(1)).subscribe((result) => {
        expect(result).toEqual(
          ChatAssistantActions.updateCurrentChat({ chat: { ...currentChat, topic: '' } })
        );
        done();
      });
    });

    it('should not emit when currentChat is undefined', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, undefined);
      store.refreshState();

      actions$ = of(ChatAssistantActions.saveSettingsClicked({ chatName: 'Ignored' }));

      let emitted = false;
      effects.saveSettings$.pipe(take(1)).subscribe({
        next: () => { emitted = true; },
        complete: () => {
          expect(emitted).toBe(false);
          done();
        }
      });
    });
  });

  describe('updateCurrentChat$', () => {
    beforeEach(() => {
      chatInternalService.updateChat.mockReset();
    });

    it('calls updateChat with empty id when currentChat.id is null', (done) => {
      const current = ({ id: null, topic: 'Null Id', participants: [], type: ChatType.AiChat } as unknown) as Chat;
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, current);

      const actionPayload: Partial<Chat> = { topic: 'Updated Topic' };

      chatInternalService.updateChat.mockReturnValue(of({}));

      actions$ = of(ChatAssistantActions.updateCurrentChat({ chat: actionPayload }));

      effects.updateCurrentChat$.pipe(take(1)).subscribe((result) => {
        expect(chatInternalService.updateChat).toHaveBeenCalledWith('', { topic: 'Updated Topic' });
        expect(result).toEqual(ChatAssistantActions.chatUpdateSuccessful({ chat: { ...current, topic: 'Updated Topic' } }));
        done();
      });
    });

     it('does not emit when currentChat is undefined (filter blocks chat?.id path)', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, undefined);

      const actionPayload: Partial<Chat> = { topic: 'New Topic' };

      actions$ = of(ChatAssistantActions.updateCurrentChat({ chat: actionPayload }));

      let emitted = false;
      effects.updateCurrentChat$.pipe(take(1)).subscribe({
        next: () => { emitted = true; },
        complete: () => {
          expect(emitted).toBe(false);
          done();
        }
      });
    });

    it('should handle error when updating chat fails', (done) => {
      const error = 'Failed to update chat';
      chatInternalService.updateChat.mockReturnValue(throwError(() => error));

      const current: Chat = { id: 'chat1', topic: 'Old Topic', type: ChatType.AiChat };
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, current);

      const action = ChatAssistantActions.updateCurrentChat({ chat: { topic: 'New Topic' } });
      actions$ = of(action);

      effects.updateCurrentChat$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatUpdateFailed({ error }));
        done();
      });
    });
  });

  describe('createChatAndSendMessage$', () => {
    beforeEach(() => {
      chatInternalService.createChat.mockReturnValue(of(mockChat));
      store.overrideSelector(chatAssistantSelectors.selectUser, mockUser);
      store.overrideSelector(chatAssistantSelectors.selectSelectedChatMode, ChatType.AiChat as any);
      store.overrideSelector(selectChatTopic, 'chat-assistant');
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, {
        id: 'chat1',
        topic: 'chat-assistant',
        type: ChatType.AiChat
      });
    });

    it('should create chat and send message when createNewChatForMessage action is dispatched', (done) => {
      const message = 'This is a test message';
      const action = ChatAssistantActions.createNewChatForMessage({ message });
      actions$ = of(action);

      effects.createChatAndSendMessage$.pipe(toArray()).subscribe(result => {
        expect(result).toEqual([
          ChatAssistantActions.chatCreationSuccessful({ chat: mockChat }),
          ChatAssistantActions.messageSent({ message })
        ]);
        expect(chatInternalService.createChat).toHaveBeenCalledWith({
          type: ChatType.AiChat,
          topic: 'chat-assistant',
          summary: message,
          participants: ['test@example.com']
        });
        done();
      });
    });

    it('should truncate long messages for chat topic', (done) => {
      const longMessage = 'This is a very long message that exceeds the chat topic length limit and should be truncated';
      const action = ChatAssistantActions.createNewChatForMessage({ message: longMessage });
      actions$ = of(action);

      effects.createChatAndSendMessage$.pipe(take(1)).subscribe(result => {
        expect(chatInternalService.createChat).toHaveBeenCalledWith(
          expect.objectContaining({
            topic: 'chat-assistant',
            summary: 'This is a very long message th...'
          })
        );
        done();
      });
    });

    it('should handle error when chat creation for message fails', (done) => {
      const error = 'Failed to create chat for message';
      chatInternalService.createChat.mockReturnValue(throwError(() => error));

      const action = ChatAssistantActions.createNewChatForMessage({ message: 'test' });
      actions$ = of(action);

      effects.createChatAndSendMessage$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatCreationFailed({ error }));
        done();
      });
    });

    it('should default to AiChat when currentChat is undefined', (done) => {
      const message = 'Message when currentChat is undefined';
      const action = ChatAssistantActions.createNewChatForMessage({ message });
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, undefined);
      actions$ = of(action);

      effects.createChatAndSendMessage$.pipe(take(1)).subscribe(() => {
        expect(chatInternalService.createChat).toHaveBeenCalledWith(
          expect.objectContaining({ type: ChatType.AiChat })
        );
        done();
      });
    });

    it('should use chat type as topic when currentChat topic is empty', (done) => {
      const message = 'This is a very long message that should be truncated to fit the chat topic length limit';
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, { 
        id: 'new', 
        topic: '',
        type: ChatType.HumanDirectChat 
      });
      store.overrideSelector(selectChatTopic, 'CHAT.TITLE.DIRECT');

      const action = ChatAssistantActions.createNewChatForMessage({ message });
      actions$ = of(action);

      effects.createChatAndSendMessage$.pipe(toArray()).subscribe(result => {
        expect(chatInternalService.createChat).toHaveBeenCalledWith(
          expect.objectContaining({ topic: 'CHAT.TITLE.DIRECT' })
        );
        expect(result).toEqual([
          ChatAssistantActions.chatCreationSuccessful({ chat: mockChat }),
          ChatAssistantActions.messageSent({ message })
        ]);
        done();
      });
    });
  });

  describe('sendMessage$', () => {
    beforeEach(() => {
      chatInternalService.createChatMessage.mockReturnValue(of(mockMessage));
      store.overrideSelector(chatAssistantSelectors.selectAgents, CHAT_AGENTS);
      store.overrideSelector(chatAssistantSelectors.selectSelectedAgentId, DEFAULT_AGENT_ID);
    });

    it('should send message when messageSent action is dispatched with existing chat', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, mockChat);

      const action = ChatAssistantActions.messageSent({ message: 'Hello' });
      actions$ = of(action);

      effects.sendMessage$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.messageSendingSuccessful({ message: mockMessage }));
        expect(chatInternalService.createChatMessage).toHaveBeenCalledWith('chat1', {
          type: MessageType.Human,
          text: 'Hello',
          awaitResponse: false,
          requestContext: {
            aiContext: [],
          },
        });
        done();
      });
    });

    it('should create new chat when messageSent action is dispatched without existing chat', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, undefined);

      const action = ChatAssistantActions.messageSent({ message: 'Hello' });
      actions$ = of(action);

      effects.sendMessage$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.createNewChatForMessage({ message: 'Hello' }));
        done();
      });
    });

    it('should create new chat when chat id is "new"', (done) => {
      const newChat = { ...mockChat, id: 'new' };
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, newChat);

      const action = ChatAssistantActions.messageSent({ message: 'Hello' });
      actions$ = of(action);

      effects.sendMessage$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.createNewChatForMessage({ message: 'Hello' }));
        done();
      });
    });

    it('should handle error when sending message fails', (done) => {
      const error = 'Failed to send message';
      chatInternalService.createChatMessage.mockReturnValue(throwError(() => error));
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, mockChat);

      const action = ChatAssistantActions.messageSent({ message: 'Hello' });
      actions$ = of(action);

      effects.sendMessage$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.messageSendingFailed({
          message: 'Hello',
          error
        }));
        done();
      });
    });
  });

  describe('createChat method', () => {
    beforeEach(() => {
      chatInternalService.createChat.mockReturnValue(of(mockChat));
    });

    it('should create chat with correct parameters', (done) => {
      effects.createChat(mockUser, 'test topic').pipe(take(1)).subscribe(result => {
        expect(result).toEqual(mockChat);
        expect(chatInternalService.createChat).toHaveBeenCalledWith({
          type: ChatType.AiChat,
          topic: 'test topic',
          participants: ['test@example.com']
        });
        done();
      });
    });
  });

  
});