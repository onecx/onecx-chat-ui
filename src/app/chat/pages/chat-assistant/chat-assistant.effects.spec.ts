import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { provideMockActions } from '@ngrx/effects/testing';
import { routerNavigatedAction, RouterNavigatedPayload } from '@ngrx/router-store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable, of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { ChatInternalService } from 'src/app/shared/services/chat-internal.service';
import {
  ChatsService,
  ChatType,
  MessageType,
  ParticipantType,
} from '../../../shared/generated';
import { ChatAssistantActions } from './chat-assistant.actions';
import { ChatAssistantEffects } from './chat-assistant.effects';
import { chatAssistantSelectors } from './chat-assistant.selectors';
import { ChatUser } from './chat-assistant.state';

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

  const mockUser: ChatUser = {
    userId: '123',
    userName: 'testUser',
    email: 'test@example.com'
  };

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
    const chatInternalServiceSpy = {
      getChats: jest.fn(),
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
        { provide: Router, useValue: routerSpy }
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

  describe('chatInitialized$', () => {
    it('should be defined', () => {
      expect(effects.chatInitialized).toBeDefined();
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

      effects.chatInitialized.subscribe(result => {
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

      effects.chatInitialized.subscribe(action => {
        expect(action).toEqual(ChatAssistantActions.chatInitialized());
        done();
      });
    });

    it('should not dispatch chatInitialized action if already initialized', (done) => {      
      store.overrideSelector(chatAssistantSelectors.selectChatInitialized, true);
      const routerAction = routerNavigatedAction({
        payload: {
          routerState: { url: '/chat-assistant', root: {} as any },
          event: {} as RouterNavigatedPayload['event']
        }
      });
      actions$ = of(routerAction);

      effects.chatInitialized.pipe(take(1)).subscribe({
        next: () => fail('Should not emit'),
        complete: () => done()
      });
    });
  });

  describe('fetchChats$', () => {
    beforeEach(() => {
      chatInternalService.getChats.mockReturnValue(of({ stream: mockChats, totalElements: mockChats.length }));
      store.overrideSelector(chatAssistantSelectors.selectChats, []);
      store.overrideSelector(chatAssistantSelectors.selectTotalAvailableChats, 2);
      store.overrideSelector(chatAssistantSelectors.selectSearchQuery, '');
    });

    it('should load chats when chatInitialized action is dispatched', (done) => {
      const action = ChatAssistantActions.chatInitialized();
      actions$ = of(action);

      effects.fetchChats$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: mockChats,
          totalElements: 2,
          append: false
        }));
        expect(chatInternalService.getChats).toHaveBeenCalledWith(0, 20);
        done();
      });
    });

    it('should load chats when chatCreationSuccessful action is dispatched', (done) => {
      const action = ChatAssistantActions.chatCreationSuccessful({ chat: mockChat });
      actions$ = of(action);

      effects.fetchChats$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: mockChats,
          totalElements: 2,
          append: false
        }));
        expect(chatInternalService.getChats).toHaveBeenCalled();
        done();
      });
    });

    it('should handle error when loading chats fails', (done) => {
      const error = 'Failed to load chats';
      chatInternalService.getChats.mockReturnValue(throwError(() => error));

      const action = ChatAssistantActions.chatInitialized();
      actions$ = of(action);

      effects.fetchChats$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoadingFailed({ error }));
        done();
      });
    });

    it('should handle empty chats response', (done) => {
      chatInternalService.getChats.mockReturnValue(of({ stream: undefined, totalElements: 0 }));

      const action = ChatAssistantActions.chatInitialized();
      actions$ = of(action);

      effects.fetchChats$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: [],
          totalElements: 0,
          append: false
        }));
        done();
      });
    });

    it('should handle null stream in response', (done) => {
      chatInternalService.getChats.mockReturnValue(of({ stream: null, totalElements: 0 }));

      const action = ChatAssistantActions.chatInitialized();
      actions$ = of(action);

      effects.fetchChats$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: [],
          totalElements: 0,
          append: false
        }));
        done();
      });
    });

    it('should handle response without stream property', (done) => {
      chatInternalService.getChats.mockReturnValue(of({ totalElements: 0 }));

      const action = ChatAssistantActions.chatInitialized();
      actions$ = of(action);

      effects.fetchChats$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: [],
          totalElements: 0,
          append: false
        }));
        done();
      });
    });

    it('should handle response with undefined totalElements by defaulting to 0', (done) => {
      chatInternalService.getChats.mockReturnValue(of({ stream: mockChats }));

      const action = ChatAssistantActions.chatInitialized();
      actions$ = of(action);

      effects.fetchChats$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatsLoaded({
          chats: mockChats,
          totalElements: 0,
          append: false
        }));
        done();
      });
    });

    it('should calculate correct page number using Math.floor(chats.length / PAGE_SIZE) for next page', (done) => {
      const existingChats = Array.from({ length: 35 }, (_, i) => ({ id: `c${i}` } as any));
      store.overrideSelector(chatAssistantSelectors.selectChats, existingChats);
      store.overrideSelector(chatAssistantSelectors.selectTotalAvailableChats, 100);

      const nextPageChats = Array.from({ length: 20 }, (_, i) => ({ id: `c${35 + i}` } as any));
      chatInternalService.getChats.mockReturnValue(of({ stream: nextPageChats, totalElements: 100 }));

      const action = ChatAssistantActions.fetchNextChatsPage();
      actions$ = of(action);

      effects.fetchChats$.subscribe(() => {
        // Math.floor(35 / 20) = 1
        expect(chatInternalService.getChats).toHaveBeenCalledWith(1, 20);
        done();
      });
    });

    it('should load all chats with searchQuery when !isNextPage and search is active', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectChats, []);
      store.overrideSelector(chatAssistantSelectors.selectTotalAvailableChats, 100);
      store.overrideSelector(chatAssistantSelectors.selectSearchQuery, '  test query  ');

      const allChats = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}` } as any));
      chatInternalService.getChats.mockReturnValue(of({ stream: allChats, totalElements: 100 }));

      const action = ChatAssistantActions.chatInitialized();
      actions$ = of(action);

      effects.fetchChats$.subscribe(() => {
        // Math.max(20, 100) = 100, pageSize should be 100 for search
        expect(chatInternalService.getChats).toHaveBeenCalledWith(0, 100);
        done();
      });
    });

    it('should not throw error when searchQuery is undefined and using optional chaining searchQuery?.trim()', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectChats, []);
      store.overrideSelector(chatAssistantSelectors.selectTotalAvailableChats, 5);
      store.overrideSelector(chatAssistantSelectors.selectSearchQuery, undefined as any);

      chatInternalService.getChats.mockReturnValue(of({ stream: [], totalElements: 5 }));

      const action = ChatAssistantActions.chatInitialized();
      actions$ = of(action);

      effects.fetchChats$.subscribe(
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

    it('should not load messages when chat id is "new"', (done) => {
      const newChat = { ...mockChat, id: 'new' };
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, newChat);

      const action = ChatAssistantActions.chatSelected({ chat: newChat });
      actions$ = of(action);

      effects.loadAvailableMessages$.pipe(take(1)).subscribe({
        next: () => fail('Should not emit'),
        complete: () => done()
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

  describe('updateChatTopic$', () => {
    beforeEach(() => {
      chatInternalService.updateChat.mockReturnValue(of(mockChat));
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, mockChat);
    });

    it('should update chat topic when updateCurrentChatTopic action is dispatched', (done) => {
      const newTopic = 'Updated Topic';
      const updatedChat = { ...mockChat, topic: newTopic };
      chatInternalService.updateChat.mockReturnValue(of(updatedChat));

      const action = ChatAssistantActions.updateCurrentChatTopic({ topic: newTopic });
      actions$ = of(action);

      effects.updateChatTopic$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatCreationSuccessful({ chat: updatedChat }));
        expect(chatInternalService.updateChat).toHaveBeenCalledWith('chat1', { topic: newTopic });
        done();
      });
    });

    it('should handle error when updating chat topic fails', (done) => {
      const error = 'Failed to update chat topic';
      chatInternalService.updateChat.mockReturnValue(throwError(() => error));

      const action = ChatAssistantActions.updateCurrentChatTopic({ topic: 'New Topic' });
      actions$ = of(action);

      effects.updateChatTopic$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatCreationFailed({ error }));
        done();
      });
    });
  });

  describe('createChat$', () => {
    beforeEach(() => {
      chatInternalService.createChat.mockReturnValue(of(mockChat));
      store.overrideSelector(chatAssistantSelectors.selectUser, mockUser);
      store.overrideSelector(chatAssistantSelectors.selectTopic, 'test-topic');
    });

    it('should create chat when chatCreated action is dispatched', (done) => {
      const action = ChatAssistantActions.chatCreated();
      actions$ = of(action);

      effects.createChat$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatCreationSuccessful({ chat: mockChat }));
        expect(chatInternalService.createChat).toHaveBeenCalledWith({
          type: ChatType.AiChat,
          topic: 'test-topic',
          participants: [
            {
              type: ParticipantType.Human,
              userId: '123',
              userName: 'testUser',
              email: 'test@example.com'
            }
          ]
        });
        done();
      });
    });

    it('should handle error when chat creation fails', (done) => {
      const error = 'Failed to create chat';
      chatInternalService.createChat.mockReturnValue(throwError(() => error));

      const action = ChatAssistantActions.chatCreated();
      actions$ = of(action);

      effects.createChat$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.chatCreationFailed({ error }));
        done();
      });
    });

    it('should not create chat when user is undefined', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectUser, undefined);

      const action = ChatAssistantActions.chatCreated();
      actions$ = of(action);

      effects.createChat$.pipe(take(1)).subscribe({
        next: () => fail('Should not emit'),
        complete: () => done()
      });
    });
  });

  describe('createChatAndSendMessage$', () => {
    beforeEach(() => {
      chatInternalService.createChat.mockReturnValue(of(mockChat));
      store.overrideSelector(chatAssistantSelectors.selectUser, mockUser);
      store.overrideSelector(chatAssistantSelectors.selectTopic, 'chat-assistant');
    });

    it('should create chat and send message when createNewChatForMessage action is dispatched', (done) => {
      const message = 'This is a test message';
      const action = ChatAssistantActions.createNewChatForMessage({ message });
      actions$ = of(action);

      effects.createChatAndSendMessage$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.messageSentForNewChat({
          chat: mockChat,
          message
        }));
        expect(chatInternalService.createChat).toHaveBeenCalledWith({
          type: ChatType.AiChat,
          topic: 'chat-assistant: This is a test message',
          participants: [
            {
              type: ParticipantType.Human,
              userId: '123',
              userName: 'testUser',
              email: 'test@example.com'
            }
          ]
        });
        done();
      });
    });

    it('should truncate long messages for chat topic', (done) => {
      const longMessage = 'This is a very long message that exceeds the chat topic length limit and should be truncated';
      const action = ChatAssistantActions.createNewChatForMessage({ message: longMessage });
      actions$ = of(action);

      effects.createChatAndSendMessage$.subscribe(result => {
        expect(chatInternalService.createChat).toHaveBeenCalledWith(
          expect.objectContaining({
            topic: 'chat-assistant: This is a very long message th...'
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

      effects.createChatAndSendMessage$.subscribe(() => {
        expect(chatInternalService.createChat).toHaveBeenCalledWith(
          expect.objectContaining({ type: ChatType.AiChat })
        );
        done();
      });
    });
  });

  describe('sendMessage$', () => {
    beforeEach(() => {
      chatInternalService.createChatMessage.mockReturnValue(of(mockMessage));
    });

    it('should send message when messageSent action is dispatched with existing chat', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, mockChat);

      const action = ChatAssistantActions.messageSent({ message: 'Hello' });
      actions$ = of(action);

      effects.sendMessage$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.messageSendingSuccessful({ message: mockMessage }));
        expect(chatInternalService.createChatMessage).toHaveBeenCalledWith('chat1', {
          type: MessageType.Human,
          text: 'Hello'
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

    it('should send message when messageSentForNewChat action is dispatched', (done) => {
      store.overrideSelector(chatAssistantSelectors.selectCurrentChat, mockChat);

      const action = ChatAssistantActions.messageSentForNewChat({
        chat: mockChat,
        message: 'Hello'
      });
      actions$ = of(action);

      effects.sendMessage$.subscribe(result => {
        expect(result).toEqual(ChatAssistantActions.messageSendingSuccessful({ message: mockMessage }));
        expect(chatInternalService.createChatMessage).toHaveBeenCalledWith('chat1', {
          type: MessageType.Human,
          text: 'Hello'
        });
        done();
      });
    });
  });

  describe('createChat method', () => {
    beforeEach(() => {
      chatInternalService.createChat.mockReturnValue(of(mockChat));
    });

    it('should create chat with correct parameters', (done) => {
      effects.createChat(mockUser, 'test topic').subscribe(result => {
        expect(result).toEqual(mockChat);
        expect(chatInternalService.createChat).toHaveBeenCalledWith({
          type: ChatType.AiChat,
          topic: 'test topic',
          participants: [
            {
              type: ParticipantType.Human,
              userId: '123',
              userName: 'testUser',
              email: 'test@example.com'
            }
          ]
        });
        done();
      });
    });
  });
});