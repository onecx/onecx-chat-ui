import { createReducer, on } from '@ngrx/store';
import { MessageType } from 'src/app/shared/generated';
import { ChatAssistantActions } from './chat-assistant.actions';
import { ChatAssistantState } from './chat-assistant.state';

export const initialState: ChatAssistantState = {
  // TODO: use onecx user data
  user: {
    userId: '123',
    userName: 'human',
    email: 'human@earth.io',
  },
  chats: [],
  currentChat: undefined,
  currentMessages: undefined,
  topic: 'chat-assistant',
  selectedChatMode: null,
  chatInitialized: false,
  searchQuery: '',
  voiceChatEnabled: false,
};

const cleanTemp = (m: { id?: string | undefined }) => {
  return m.id !== 'new' && !m?.id?.includes('temp');
};

export const chatAssistantReducer = createReducer(
  initialState,
  on(
    ChatAssistantActions.messageSentForNewChat,
    (state: ChatAssistantState, action) => {
      return {
        ...state,
        currentChat: action.chat,
      };
    },
  ),
  on(ChatAssistantActions.chatInitialized, (state: ChatAssistantState) => {
    return {
      ...state,
      chatInitialized: true,
    };
  }),
  on(ChatAssistantActions.messageSent, (state: ChatAssistantState, action) => {
    return {
      ...state,
      currentMessages: [
        {
          type: MessageType.Human,
          id: 'new',
          text: action.message,
          creationDate: new Date().toISOString(),
        },
        {
          creationDate: new Date().toISOString(),
          id: 'ai-temp',
          type: MessageType.Assistant,
          text: '',
          isLoadingInfo: true,
        },
        ...(state.currentMessages?.filter(cleanTemp) ?? []),
      ],
    };
  }),
  on(
    ChatAssistantActions.messageSendingFailed,
    (state: ChatAssistantState, action) => {
      return {
        ...state,
        currentMessages: [
          {
            type: MessageType.Human,
            id: 'new',
            text: action.message,
            creationDate: new Date().toISOString(),
            isFailed: true,
          },
          ...(state.currentMessages?.filter(cleanTemp) ?? []),
        ],
      };
    },
  ),
  on(ChatAssistantActions.chatsLoaded, (state: ChatAssistantState, action) => {
    return {
      ...state,
      chats: action.chats,
    };
  }),
  on(
    ChatAssistantActions.messagesLoaded,
    (state: ChatAssistantState, action) => {
      return {
        ...state,
        currentMessages: action.messages,
      };
    },
  ),
  on(
    ChatAssistantActions.chatSelected,
    ChatAssistantActions.chatCreationSuccessful,
    (state: ChatAssistantState, action) => {
      return {
        ...state,
        currentChat: action.chat,
        currentMessages: [],
      };
    },
  ),
  on(
    ChatAssistantActions.chatDeletionSuccessful,
    (state: ChatAssistantState, action) => {
      return {
        ...state,
        currentChat: undefined,
        chats: state.chats.filter((c) => c.id !== action.chatId),
        currentMessages: [],
      };
    },
  ),
  on(ChatAssistantActions.backButtonClicked, (state) => ({
    ...state,
    selectedChatMode: null,
    currentChat: undefined,
    currentMessages: [],
    searchQuery: '',
  })),
  on(ChatAssistantActions.newChatClicked, (state, action) => ({
    ...state,
    currentChat: {
      id: 'new',
      type: action.mode,
    },
    currentMessages: [],
  })),
  on(ChatAssistantActions.searchQueryChanged, (state, action) => ({
    ...state,
    searchQuery: action.query,
  })),
  on(ChatAssistantActions.voiceChatEnabled, (state) => ({
    ...state,
    voiceChatEnabled: true,
  })),
  on(ChatAssistantActions.voiceChatDisabled, (state) => ({
    ...state,
    voiceChatEnabled: false,
  })),
  on(
    ChatAssistantActions.voiceUserTranscriptReceived,
    (state: ChatAssistantState, action) => {
      // Remove the streaming user placeholder
      const withoutStreamingUser = (state.currentMessages ?? []).filter(
        (m) => m.id !== 'voice-user-streaming',
      );
      // Finalize any ongoing bot streaming message as a permanent message
      const withFinalizedBot = withoutStreamingUser.map((m) =>
        m.id === 'voice-bot-streaming'
          ? { ...m, id: `voice-bot-${Date.now()}` }
          : m,
      );
      if (action.isFinal) {
        // Promote user transcript to a permanent message
        // Stream all transcripts to ensure that the message is finalized (even if it ends with an empty transcript due to e.g. trailing silence that is wrongly picked up as part of the user message)
        return {
          ...state,
          currentMessages: [
            ...withFinalizedBot,
            {
              id: `voice-user-${Date.now()}`,
              type: MessageType.Human,
              text: action.text,
              creationDate: new Date().toISOString(),
            },
          ],
        };
      }
      // Streaming: keep a temporary entry that gets replaced each time
      // Only stream non-empty text to avoid showing an empty message placeholder for non-final transcripts
      return {
        ...state,
        currentMessages: [
          ...withFinalizedBot,
          action.text
            ? {
                id: 'voice-user-streaming',
                type: MessageType.Human,
                text: action.text,
                creationDate: new Date().toISOString(),
              }
            : null,
        ].filter((m): m is NonNullable<typeof m> => m !== null),
      };
    },
  ),
  on(
    ChatAssistantActions.voiceBotTranscriptReceived,
    (state: ChatAssistantState, action) => {
      // Only append sentences that have not been marked as spoken yet, to avoid duplication with messages coming from the backend after the voice stream ends
      if (action.spoken) {
        return state;
      }
      const messages = state.currentMessages ?? [];
      const existing = messages.find((m) => m.id === 'voice-bot-streaming');
      if (existing) {
        // Append the new spoken sentence to the current streaming message
        return {
          ...state,
          currentMessages: messages.map((m) =>
            m.id === 'voice-bot-streaming'
              ? { ...m, text: m.text + ' ' + action.text }
              : m,
          ),
        };
      }
      // Start a new streaming bot message
      return {
        ...state,
        currentMessages: [
          ...messages,
          {
            id: 'voice-bot-streaming',
            type: MessageType.Assistant,
            text: action.text,
            creationDate: new Date().toISOString(),
          },
        ],
      };
    },
  ),
);
