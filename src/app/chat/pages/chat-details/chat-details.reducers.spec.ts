import { ChatDetailsActions } from './chat-details.actions';
import { chatDetailsReducer, initialState } from './chat-details.reducers';
import { ChatDetailsState } from './chat-details.state';
import { Chat, Message } from 'src/app/shared/generated';

describe('ChatDetailsReducer', () => {
  const mockChat: Chat = {
    id: '1',
    topic: 'Test Chat',
    type: 'AI_CHAT' as any,
    participants: []
  };

  const mockMessages: Message[] = [
    {
      id: 'msg1',
      text: 'Hello',
      createdAt: '2024-01-01T00:00:00Z',
      sender: { id: 'user1', name: 'User 1' }
    } as any,
    {
      id: 'msg2',
      text: 'Hi there',
      createdAt: '2024-01-01T00:01:00Z',
      sender: { id: 'user2', name: 'User 2' }
    } as any
  ];

  describe('initial state', () => {
    it('should have correct initial state', () => {
      expect(initialState).toEqual({
        details: undefined,
        detailsLoadingIndicator: true,
        detailsLoaded: false,
        messages: undefined,
      });
    });

    it('should return initial state when action is unknown', () => {
      const action = { type: 'UNKNOWN_ACTION' } as any;
      
      const nextState = chatDetailsReducer(initialState, action);

      expect(nextState).toBe(initialState);
    });
  });

  describe('chatDetailsReceived', () => {
    it('should update details and set loading flags correctly', () => {
      const action = ChatDetailsActions.chatDetailsReceived({ details: mockChat });
      
      const nextState = chatDetailsReducer(initialState, action);

      expect(nextState).toEqual({
        ...initialState,
        details: mockChat,
        detailsLoadingIndicator: false,
        detailsLoaded: true,
      });
    });

    it('should override previous details with new data', () => {
      const previousChat: Chat = {
        id: '2',
        topic: 'Previous Chat',
        type: 'HUMAN_CHAT' as any,
        participants: []
      };

      const intermediateState: ChatDetailsState = {
        ...initialState,
        details: previousChat,
        detailsLoadingIndicator: false,
        detailsLoaded: true,
      };

      const action = ChatDetailsActions.chatDetailsReceived({ details: mockChat });
      const nextState = chatDetailsReducer(intermediateState, action);

      expect(nextState.details).toEqual(mockChat);
      expect(nextState.detailsLoadingIndicator).toBe(false);
      expect(nextState.detailsLoaded).toBe(true);
    });

    it('should preserve messages when updating details', () => {
      const intermediateState: ChatDetailsState = {
        ...initialState,
        messages: mockMessages,
      };

      const action = ChatDetailsActions.chatDetailsReceived({ details: mockChat });
      const nextState = chatDetailsReducer(intermediateState, action);

      expect(nextState.messages).toEqual(mockMessages);
      expect(nextState.details).toEqual(mockChat);
    });
  });

  describe('chatDetailsLoadingFailed', () => {
    it('should clear details and set loading flags correctly', () => {
      const intermediateState: ChatDetailsState = {
        ...initialState,
        details: mockChat,
        detailsLoadingIndicator: true,
        detailsLoaded: true,
      };

      const action = ChatDetailsActions.chatDetailsLoadingFailed({ error: 'Network error' });
      const nextState = chatDetailsReducer(intermediateState, action);

      expect(nextState).toEqual({
        ...intermediateState,
        details: undefined,
        detailsLoadingIndicator: false,
        detailsLoaded: false,
      });
    });

    it('should handle null error', () => {
      const action = ChatDetailsActions.chatDetailsLoadingFailed({ error: null });
      const nextState = chatDetailsReducer(initialState, action);

      expect(nextState.details).toBeUndefined();
      expect(nextState.detailsLoadingIndicator).toBe(false);
      expect(nextState.detailsLoaded).toBe(false);
    });

    it('should preserve messages when loading fails', () => {
      const intermediateState: ChatDetailsState = {
        ...initialState,
        details: mockChat,
        messages: mockMessages,
      };

      const action = ChatDetailsActions.chatDetailsLoadingFailed({ error: 'Error' });
      const nextState = chatDetailsReducer(intermediateState, action);

      expect(nextState.messages).toEqual(mockMessages);
      expect(nextState.details).toBeUndefined();
    });
  });

  describe('navigatedToDetailsPage', () => {
    it('should reset state to initial state', () => {
      const intermediateState: ChatDetailsState = {
        details: mockChat,
        messages: mockMessages,
        detailsLoadingIndicator: false,
        detailsLoaded: true,
      };

      const action = ChatDetailsActions.navigatedToDetailsPage({ id: '1' });
      const nextState = chatDetailsReducer(intermediateState, action);

      expect(nextState).toEqual(initialState);
    });

  });

  describe('messagesLoaded', () => {
    it('should update messages while preserving other state', () => {
      const intermediateState: ChatDetailsState = {
        ...initialState,
        details: mockChat,
        detailsLoadingIndicator: false,
        detailsLoaded: true,
      };

      const action = ChatDetailsActions.messagesLoaded({ messages: mockMessages });
      const nextState = chatDetailsReducer(intermediateState, action);

      expect(nextState).toEqual({
        ...intermediateState,
        messages: mockMessages,
      });
    });

    it('should handle empty messages array', () => {
      const action = ChatDetailsActions.messagesLoaded({ messages: [] });
      const nextState = chatDetailsReducer(initialState, action);

      expect(nextState.messages).toEqual([]);
    });

    it('should override previous messages with new messages', () => {
      const previousMessages: Message[] = [
        {
          id: 'oldMsg1',
          text: 'Old message',
          createdAt: '2023-01-01T00:00:00Z',
          sender: { id: 'user1', name: 'User 1' }
        } as any
      ];

      const intermediateState: ChatDetailsState = {
        ...initialState,
        messages: previousMessages,
      };

      const action = ChatDetailsActions.messagesLoaded({ messages: mockMessages });
      const nextState = chatDetailsReducer(intermediateState, action);

      expect(nextState.messages).toEqual(mockMessages);
      expect(nextState.messages).not.toEqual(previousMessages);
    });

    it('should preserve details when loading messages', () => {
      const intermediateState: ChatDetailsState = {
        ...initialState,
        details: mockChat,
        detailsLoadingIndicator: false,
        detailsLoaded: true,
      };

      const action = ChatDetailsActions.messagesLoaded({ messages: mockMessages });
      const nextState = chatDetailsReducer(intermediateState, action);

      expect(nextState.details).toEqual(mockChat);
      expect(nextState.detailsLoadingIndicator).toBe(false);
      expect(nextState.detailsLoaded).toBe(true);
    });
  });

  describe('state immutability', () => {
    it('should not mutate the original state', () => {
      const originalState = { ...initialState };
      const action = ChatDetailsActions.chatDetailsReceived({ details: mockChat });

      chatDetailsReducer(initialState, action);

      expect(initialState).toEqual(originalState);
    });

    it('should create new state object for each action', () => {
      const action1 = ChatDetailsActions.chatDetailsReceived({ details: mockChat });
      const nextState1 = chatDetailsReducer(initialState, action1);

      const action2 = ChatDetailsActions.messagesLoaded({ messages: mockMessages });
      const nextState2 = chatDetailsReducer(nextState1, action2);

      expect(nextState1).not.toBe(initialState);
      expect(nextState2).not.toBe(nextState1);
      expect(nextState2).not.toBe(initialState);
    });

    it('should maintain reference to action payload data', () => {
      const action = ChatDetailsActions.chatDetailsReceived({ details: mockChat });
      const nextState = chatDetailsReducer(initialState, action);

      expect(nextState.details).toEqual(mockChat);
      expect(nextState.details).toBe(mockChat);
    });
  });

  describe('edge cases', () => {
    it('should handle loading details when already loaded', () => {
      const intermediateState: ChatDetailsState = {
        details: mockChat,
        messages: mockMessages,
        detailsLoadingIndicator: false,
        detailsLoaded: true,
      };

      const newChat: Chat = {
        id: '2',
        topic: 'New Chat',
        type: 'AI_CHAT' as any,
        participants: []
      };

      const action = ChatDetailsActions.chatDetailsReceived({ details: newChat });
      const nextState = chatDetailsReducer(intermediateState, action);

      expect(nextState.details).toEqual(newChat);
      expect(nextState.messages).toEqual(mockMessages);
    });

    it('should handle multiple loading failures', () => {
      const intermediateState: ChatDetailsState = {
        ...initialState,
        details: undefined,
        detailsLoadingIndicator: false,
        detailsLoaded: false,
      };

      const action = ChatDetailsActions.chatDetailsLoadingFailed({ error: 'Second error' });
      const nextState = chatDetailsReducer(intermediateState, action);

      expect(nextState.details).toBeUndefined();
      expect(nextState.detailsLoadingIndicator).toBe(false);
      expect(nextState.detailsLoaded).toBe(false);
    });

    it('should reset state correctly even when already in initial state', () => {
      const action = ChatDetailsActions.navigatedToDetailsPage({ id: '1' });
      const nextState = chatDetailsReducer(initialState, action);

      expect(nextState).toEqual(initialState);
    });

    it('should handle messages loaded with undefined details', () => {
      const intermediateState: ChatDetailsState = {
        ...initialState,
        details: undefined,
      };

      const action = ChatDetailsActions.messagesLoaded({ messages: mockMessages });
      const nextState = chatDetailsReducer(intermediateState, action);

      expect(nextState.details).toBeUndefined();
      expect(nextState.messages).toEqual(mockMessages);
    });
  });
});
