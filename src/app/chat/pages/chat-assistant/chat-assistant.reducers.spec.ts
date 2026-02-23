import { ChatType, MessageType } from 'src/app/shared/generated';
import { ChatAssistantActions } from './chat-assistant.actions';
import { chatAssistantReducer, initialState } from './chat-assistant.reducers';
import { ChatAssistantState } from './chat-assistant.state';

describe('ChatAssistant Reducer', () => {
  const mockChat = {
    id: 'chat1',
    topic: 'Test Chat',
    type: ChatType.AiChat
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

  describe('initial state', () => {
    it('should have correct initial state', () => {
      expect(initialState).toEqual({
        chatInitialized: false,
        user: {
          userId: '123',
          userName: 'human',
          email: 'human@earth.io',
        },
        chats: [],
        currentChat: undefined,
        currentMessages: undefined,
        searchQuery: '',
        topic: 'chat-assistant',
        selectedChatMode: null,
        voiceChatEnabled: false,
      });
    });

    it('should return initial state when no action is provided', () => {
      const result = chatAssistantReducer(undefined, { type: 'UNKNOWN' });
      expect(result).toEqual(initialState);
    });
  });

  describe('chatInitialized action', () => {
    it('should set chatInitialized to true when chatInitialized is dispatched', () => {
      const action = ChatAssistantActions.chatInitialized();
      const result = chatAssistantReducer(initialState, action);  
      expect(result.chatInitialized).toBe(true);
    });
  });

  describe('voiceChatEnabled and voiceChatDisabled actions', () => {
    it('should set voiceChatEnabled to true when voiceChatEnabled is dispatched', () => {
      const action = ChatAssistantActions.voiceChatEnabled();
      const result = chatAssistantReducer(initialState, action);  
      expect(result.voiceChatEnabled).toBe(true);
    });

    it('should set voiceChatEnabled to false when voiceChatDisabled is dispatched', () => {
      const stateWithVoiceChatEnabled: ChatAssistantState = {
        ...initialState,
        voiceChatEnabled: true
      };
      const action = ChatAssistantActions.voiceChatDisabled();
      const result = chatAssistantReducer(stateWithVoiceChatEnabled, action);  
      expect(result.voiceChatEnabled).toBe(false);
    });
  });

  describe('messageSentForNewChat action', () => {
    it('should set currentChat when messageSentForNewChat is dispatched', () => {
      const action = ChatAssistantActions.messageSentForNewChat({
        chat: mockChat,
        message: 'Test message'
      });

      const result = chatAssistantReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        currentChat: mockChat
      });
    });
  });

  describe('messageSent action', () => {
    it('should add human message and AI loading message when messageSent is dispatched', () => {
      const action = ChatAssistantActions.messageSent({
        message: 'Hello AI'
      });

      const result = chatAssistantReducer(initialState, action);

      expect(result.currentMessages).toHaveLength(2);
      expect(result.currentMessages?.[0]).toEqual(
        expect.objectContaining({
          type: MessageType.Human,
          id: 'new',
          text: 'Hello AI'
        })
      );
      expect(result.currentMessages?.[1]).toEqual(
        expect.objectContaining({
          type: MessageType.Assistant,
          id: 'ai-temp',
          text: '',
          isLoadingInfo: true
        })
      );
    });

    it('should filter out temp messages when adding new message', () => {
      const stateWithTempMessages: ChatAssistantState = {
        ...initialState,
        currentMessages: [
          {
            id: 'temp-123',
            text: 'temp message',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:00:00Z'
          },
          {
            id: 'msg1',
            text: 'real message',
            type: MessageType.Assistant,
            creationDate: '2023-01-01T09:01:00Z'
          },
          {
            id: 'new',
            text: 'another temp',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:02:00Z'
          }
        ]
      };

      const action = ChatAssistantActions.messageSent({
        message: 'Hello AI'
      });

      const result = chatAssistantReducer(stateWithTempMessages, action);

      expect(result.currentMessages).toHaveLength(3);
      expect(result.currentMessages?.some(m => m.id === 'temp-123')).toBe(false);
      expect(result.currentMessages?.some(m => m.id === 'new' && m.text === 'another temp')).toBe(false);
      expect(result.currentMessages?.some(m => m.id === 'msg1')).toBe(true);
    });
  });

  describe('messageSendingFailed action', () => {
    it('should add failed human message when messageSendingFailed is dispatched', () => {
      const action = ChatAssistantActions.messageSendingFailed({
        message: 'Failed message',
        error: 'Network error'
      });

      const result = chatAssistantReducer(initialState, action);

      expect(result.currentMessages).toHaveLength(1);
      expect(result.currentMessages?.[0]).toEqual(
        expect.objectContaining({
          type: MessageType.Human,
          id: 'new',
          text: 'Failed message',
          isFailed: true
        })
      );
    });

    it('should filter out temp messages when adding failed message', () => {
      const stateWithTempMessages: ChatAssistantState = {
        ...initialState,
        currentMessages: [
          {
            id: 'temp-456',
            text: 'temp message',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:00:00Z'
          },
          {
            id: 'msg1',
            text: 'real message',
            type: MessageType.Assistant,
            creationDate: '2023-01-01T09:01:00Z'
          }
        ]
      };

      const action = ChatAssistantActions.messageSendingFailed({
        message: 'Failed message',
        error: 'Network error'
      });

      const result = chatAssistantReducer(stateWithTempMessages, action);

      expect(result.currentMessages).toHaveLength(2);
      expect(result.currentMessages?.some(m => m.id === 'temp-456')).toBe(false);
      expect(result.currentMessages?.some(m => m.id === 'msg1')).toBe(true);
    });
  });

  describe('chatsLoaded action', () => {
    it('should set chats when chatsLoaded is dispatched', () => {
      const action = ChatAssistantActions.chatsLoaded({
        chats: mockChats
      });

      const result = chatAssistantReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        chats: mockChats
      });
    });
  });

  describe('messagesLoaded action', () => {
    it('should set currentMessages when messagesLoaded is dispatched', () => {
      const action = ChatAssistantActions.messagesLoaded({
        messages: mockMessages
      });

      const result = chatAssistantReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        currentMessages: mockMessages
      });
    });
  });

  describe('chatSelected and chatCreationSuccessful actions', () => {
   it('should set currentChat and clear messages when chatSelected is dispatched', () => {
      const stateWithMessages: ChatAssistantState = {
        ...initialState,
        currentMessages: mockMessages
      };

      const action = ChatAssistantActions.chatSelected({
        chat: mockChat
      });

      const result = chatAssistantReducer(stateWithMessages, action);

      expect(result).toEqual({
        ...stateWithMessages,
        currentChat: mockChat,
        currentMessages: []
      });
    });

    it('should set currentChat and clear messages when chatCreationSuccessful is dispatched', () => {
      const stateWithMessages: ChatAssistantState = {
        ...initialState,
        currentMessages: mockMessages
      };

      const action = ChatAssistantActions.chatCreationSuccessful({
        chat: mockChat
      });

      const result = chatAssistantReducer(stateWithMessages, action);

      expect(result).toEqual({
        ...stateWithMessages,
        currentChat: mockChat,
        currentMessages: []
      });
    });
  });

  describe('chatDeletionSuccessful action', () => {
    it('should remove chat from chats array and clear current chat when chatDeletionSuccessful is dispatched', () => {
      const stateWithChats: ChatAssistantState = {
        ...initialState,
        chats: mockChats,
        currentChat: mockChats[0],
        currentMessages: mockMessages
      };

      const action = ChatAssistantActions.chatDeletionSuccessful({
        chatId: 'chat1'
      });

      const result = chatAssistantReducer(stateWithChats, action);

      expect(result).toEqual({
        ...stateWithChats,
        currentChat: undefined,
        chats: [mockChats[1]], // Only chat2 should remain
        currentMessages: []
      });
    });

    it('should not affect chats array when deleting non-existent chat', () => {
      const stateWithChats: ChatAssistantState = {
        ...initialState,
        chats: mockChats,
        currentMessages: mockMessages
      };

      const action = ChatAssistantActions.chatDeletionSuccessful({
        chatId: 'non-existent-chat'
      });

      const result = chatAssistantReducer(stateWithChats, action);

      expect(result).toEqual({
        ...stateWithChats,
        currentChat: undefined,
        chats: mockChats, // All chats should remain
        currentMessages: []
      });
    });
  });

  describe('newChatClicked action', () => {
    it('should set currentChat to a new chat object when newChatClicked is dispatched', () => {
      const action = ChatAssistantActions.newChatClicked({
        mode: ChatType.AiChat
      });
      const result = chatAssistantReducer(initialState, action);

      expect(result.currentChat).toEqual({
        id: 'new',
        type: ChatType.AiChat
      });
      expect(result.currentMessages).toEqual([]);
    });
  });

  describe('chatModeDeselected action', () => {
    it('should reset chat when backButtonClicked is dispatched', () => {
      const stateWithMode: ChatAssistantState = {
        ...initialState,
        selectedChatMode: ChatType.AiChat
      };

      const action = ChatAssistantActions.backButtonClicked();

      const result = chatAssistantReducer(stateWithMode, action);

      expect(result).toEqual({
        ...stateWithMode,
        selectedChatMode: null,
        currentChat: undefined,
        currentMessages: [],
        searchQuery: ''
      });
    });
  });

  describe('cleanTemp helper function behavior', () => {
    it('should preserve messages that are not temp when messageSent is dispatched', () => {
      const stateWithMixedMessages: ChatAssistantState = {
        ...initialState,
        currentMessages: [
          {
            id: 'real-msg-1',
            text: 'real message',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:00:00Z'
          },
          {
            id: 'new',
            text: 'temp message',
            type: MessageType.Human,
            creationDate: '2023-01-01T09:01:00Z'
          },
          {
            id: 'ai-temp-123',
            text: 'ai temp message',
            type: MessageType.Assistant,
            creationDate: '2023-01-01T09:02:00Z'
          },
          {
            id: 'real-msg-2',
            text: 'another real message',
            type: MessageType.Assistant,
            creationDate: '2023-01-01T09:03:00Z'
          }
        ]
      };

      const action = ChatAssistantActions.messageSent({
        message: 'New message'
      });

      const result = chatAssistantReducer(stateWithMixedMessages, action);

      expect(result.currentMessages).toHaveLength(4);
      expect(result.currentMessages?.some(m => m.id === 'real-msg-1')).toBe(true);
      expect(result.currentMessages?.some(m => m.id === 'real-msg-2')).toBe(true);
      expect(result.currentMessages?.some(m => m.id === 'new' && m.text === 'temp message')).toBe(false);
      expect(result.currentMessages?.some(m => m.id === 'ai-temp-123')).toBe(false);
    });
  });

  describe('searchQueryChanged action', () => {
    it('should update searchQuery when searchQueryChanged is dispatched', () => {
      const action = ChatAssistantActions.searchQueryChanged({ query: 'test query' });
      const result = chatAssistantReducer(initialState, action);

      expect(result.searchQuery).toBe('test query');
      expect(result.chats).toEqual(initialState.chats);
    });
  });
});