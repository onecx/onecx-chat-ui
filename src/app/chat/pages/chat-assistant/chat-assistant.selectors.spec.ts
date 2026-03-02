import { ChatMessage } from 'src/app/shared/components/chat/chat.viewmodel';
import { ChatType, MessageType } from 'src/app/shared/generated';
import * as fromSelectors from './chat-assistant.selectors';
import { ChatAssistantState } from './chat-assistant.state';
import { ChatAssistantViewModel } from './chat-assistant.viewmodel';

describe('ChatAssistant Selectors', () => {
  const mockChats = [
    { id: '1', topic: 'Test Chat 1', type: ChatType.AiChat },
    { id: '2', topic: 'Test Chat 2', type: ChatType.HumanDirectChat },
  ];

  const mockMessages = [
    {
      id: 'msg1',
      text: 'Hello AI',
      userName: 'User1',
      type: MessageType.Human,
      creationDate: '2023-01-01T10:00:00Z'
    },
    {
      id: 'msg2',
      text: 'Hello Human',
      userName: 'AI Assistant',
      type: MessageType.Assistant,
      creationDate: '2023-01-01T10:01:00Z'
    }
  ];

  const mockCurrentChat = {
    id: 'current-chat',
    topic: 'Current Chat',
    type: ChatType.AiChat
  };

  const baseMockState: ChatAssistantState = {
    chatInitialized: false,
    user: undefined,
    chats: [],
    currentChat: undefined,
    currentMessages: undefined,
    topic: '',
    selectedChatMode: ChatType.AiChat,
    searchQuery: '',
    voiceChatEnabled: false,
  };

  describe('chatAssistantSelectors', () => {
    it('should exist and be defined', () => {
      expect(fromSelectors.chatAssistantSelectors).toBeDefined();
    });

    it('should have child selectors created from chatFeature', () => {
      expect(fromSelectors.chatAssistantSelectors.selectUser).toBeDefined();
      expect(fromSelectors.chatAssistantSelectors.selectChats).toBeDefined();
      expect(fromSelectors.chatAssistantSelectors.selectCurrentChat).toBeDefined();
      expect(fromSelectors.chatAssistantSelectors.selectCurrentMessages).toBeDefined();
      expect(fromSelectors.chatAssistantSelectors.selectTopic).toBeDefined();
      expect(fromSelectors.chatAssistantSelectors.selectSelectedChatMode).toBeDefined();
    });
  });

  describe('selectChatAssistantViewModel', () => {
    it('should select the chat assistant view model with AI chat mode', () => {
      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        mockMessages,
        baseMockState
      );

      const expected: ChatAssistantViewModel = {
        chats: mockChats,
        currentChat: mockCurrentChat,
        currentMessages: [
          {
            id: 'msg1',
            text: 'Hello AI',            
            userNameKey: 'CHAT.PARTICIPANT.HUMAN',
            creationDate: new Date('2023-01-01T10:00:00Z'),
            type: MessageType.Human
          },
          {
            id: 'msg2',
            text: 'Hello Human',            
            userNameKey: 'CHAT.PARTICIPANT.ASSISTANT',
            creationDate: new Date('2023-01-01T10:01:00Z'),
            type: MessageType.Assistant
          }
        ] as ChatMessage[],
        chatTitleKey: 'CHAT.TITLE.AI',
        selectedChatMode: ChatType.AiChat,
        voiceChatEnabled: false,
      };

      expect(result).toEqual(expected);
    });

    it('should select the chat assistant view model with direct chat mode', () => {
      const mockState = {
        ...baseMockState,
        selectedChatMode: ChatType.HumanDirectChat
      };

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        undefined,
        mockMessages,
        mockState
      );

      expect(result.chatTitleKey).toBe('CHAT.TITLE.DIRECT');
    });

    it('should select the chat assistant view model with group chat mode', () => {
      const mockState = {
        ...baseMockState,
        selectedChatMode: ChatType.HumanGroupChat
      };

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        undefined,
        mockMessages,
        mockState
      );

      expect(result.chatTitleKey).toBe('CHAT.TITLE.GROUP');
    });

    it('should use default title key for unknown chat mode', () => {
      const mockState = {
        ...baseMockState,
        selectedChatMode: null
      };

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        undefined,
        mockMessages,
        mockState
      );

      expect(result.chatTitleKey).toBe('CHAT.TITLE.DEFAULT');
    });

    it('should use default title key for unknown currentChat.type', () => {
      const unknownTypeChat = { id: 'unknown', topic: 'Unknown', type: 'SOME_UNKNOWN_TYPE' as any };

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        unknownTypeChat,
        mockMessages,
        baseMockState
      );

      expect(result.chatTitleKey).toBe('CHAT.TITLE.DEFAULT');
    });

    it('should select selectedChatMode', () => {
      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        undefined,
        mockMessages,
        baseMockState
      );

      expect(result.selectedChatMode).toEqual(ChatType.AiChat);
    });

    it('should handle undefined currentMessages', () => {
      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        undefined,
        baseMockState
      );

      expect(result.currentMessages).toBeUndefined();
    });

    it('should handle empty currentMessages array', () => {
      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        [],
        baseMockState
      );

      expect(result.currentMessages).toEqual([]);
    });

    it('should handle messages with missing optional fields', () => {
      const messagesWithMissingFields = [
        {
          type: MessageType.Human,
        },
        {
          id: 'msg2',
          text: 'Complete message',
          userName: 'User',
          type: MessageType.Assistant,
          creationDate: '2023-01-01T10:00:00Z'
        }
      ];

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        messagesWithMissingFields,
        baseMockState
      );

      expect(result.currentMessages).toHaveLength(2);

      expect(result.currentMessages?.[0]).toEqual({
        id: '',
        text: '',        
        userNameKey: 'CHAT.PARTICIPANT.HUMAN',
        creationDate: expect.any(Date),
        type: MessageType.Human
      });

      expect(isNaN(result.currentMessages?.[0].creationDate.getTime() ?? 0)).toBe(true);

      expect(result.currentMessages?.[1]).toEqual({
        id: 'msg2',
        text: 'Complete message',        
        userNameKey: 'CHAT.PARTICIPANT.ASSISTANT',
        creationDate: new Date('2023-01-01T10:00:00Z'),
        type: MessageType.Assistant
      });
    });

    it('should sort messages by creation date', () => {
      const unsortedMessages = [
        {
          id: 'msg3',
          text: 'Third message',          
          type: MessageType.Human,
          creationDate: '2023-01-01T10:02:00Z'
        },
        {
          id: 'msg1',
          text: 'First message',          
          type: MessageType.Human,
          creationDate: '2023-01-01T10:00:00Z'
        },
        {
          id: 'msg2',
          text: 'Second message',          
          type: MessageType.Assistant,
          creationDate: '2023-01-01T10:01:00Z'
        }
      ];

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        unsortedMessages,
        baseMockState
      );

      expect(result.currentMessages?.[0].id).toBe('msg1');
      expect(result.currentMessages?.[1].id).toBe('msg2');
      expect(result.currentMessages?.[2].id).toBe('msg3');
    });

    it('should contain chats array', () => {
      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        mockMessages,
        baseMockState,
      );

      expect(result.chats).toEqual(mockChats);
    });

    it('should handle null selectedChatMode', () => {
      const mockState = {
        ...baseMockState,
        selectedChatMode: null
      };

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        undefined,
        mockMessages,
        mockState
      );

      expect(result.chatTitleKey).toBe('CHAT.TITLE.DEFAULT');
    });

    it('should transform message type to uppercase for userNameKey', () => {
      const messageWithLowercaseType = [{
        id: 'test',
        text: 'test message',
        userName: 'testUser',
        type: MessageType.Human,
        creationDate: '2023-01-01T10:00:00Z'
      }];

      const result = fromSelectors.selectChatAssistantViewModel.projector(
        mockChats,
        mockCurrentChat,
        messageWithLowercaseType,
        baseMockState
      );

      expect(result.currentMessages?.[0].userNameKey).toBe('CHAT.PARTICIPANT.HUMAN');
    });
  });

  describe('selectFilteredChats', () => {
    it('returns all chats when search query is empty or whitespace', () => {
      const result1 = fromSelectors.selectFilteredChats.projector(mockChats, '');
      const result2 = fromSelectors.selectFilteredChats.projector(mockChats, '   ');
      expect(result1).toEqual(mockChats);
      expect(result2).toEqual(mockChats);
    });

    it('filters chats by topic case-insensitively', () => {
      const result = fromSelectors.selectFilteredChats.projector(
        mockChats,
        'test chat 1'
      );
      expect(result).toEqual([mockChats[0]]);
    });

    it('filters chats by type case-insensitively', () => {
      const result = fromSelectors.selectFilteredChats.projector(
        mockChats,
        'human'
      );
      expect(result).toEqual([mockChats[1]]);
    });

    it('returns empty array when no matches', () => {
      const result = fromSelectors.selectFilteredChats.projector(
        mockChats,
        'no-match'
      );
      expect(result).toEqual([]);
    });

    it('handles chats with undefined topic and filters by type', () => {
      const chatsWithUndefinedTopic = [
        { id: '1', /* topic missing */ type: ChatType.AiChat },
        { id: '2', /* topic missing */ type: ChatType.HumanDirectChat },
      ];

      const result = fromSelectors.selectFilteredChats.projector(
        chatsWithUndefinedTopic as any,
        'ai'
      );

      expect(result).toEqual([chatsWithUndefinedTopic[0]]);
    });
  });
});