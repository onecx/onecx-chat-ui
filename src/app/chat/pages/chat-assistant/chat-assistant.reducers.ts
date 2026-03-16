import { createReducer, on } from '@ngrx/store';
import { MessageType } from 'src/app/shared/generated';
import { ChatAssistantActions } from './chat-assistant.actions';
import { ChatAssistantState } from './chat-assistant.state';

export const initialState: ChatAssistantState = {
  user: undefined,
  chats: [],
  currentChat: undefined,
  currentMessages: undefined,
  selectedChatMode: null,
  chatInitialized: false,
  searchQuery: '',
  totalAvailableChats: undefined,
};

const cleanTemp = (m: { id?: string | undefined }) => {
  return m.id !== 'new' && !m?.id?.includes('temp');
};

export const chatAssistantReducer = createReducer(
  initialState,
  on(ChatAssistantActions.userProfileLoaded, (state, action) => ({
    ...state,
    user: action.user,
  })),
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
    }
  ),
  on(ChatAssistantActions.chatsLoaded, (state: ChatAssistantState, action) => {
    const newChats = action.append ? [...state.chats, ...action.chats] : action.chats;
    return {
      ...state,
      chats: newChats,
      totalAvailableChats: action.totalElements,
    };
  }),
  on(
    ChatAssistantActions.messagesLoaded,
    (state: ChatAssistantState, action) => {
      return {
        ...state,
        currentMessages: action.messages,
      };
    }
  ),
  on(
    ChatAssistantActions.chatSelected,
    (state: ChatAssistantState, action) => {
      return {
        ...state,
        currentChat: action.chat,
        currentMessages: [],
      };
    }
  ),
  on(
    ChatAssistantActions.chatCreationSuccessful,
    (state: ChatAssistantState, action) => {
      return {
        ...state,
        currentChat: action.chat,
        currentMessages: [],
      };
    }
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
    }
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
      topic: action.topic ?? ''
    },
    currentMessages: [],
  })),
  on(ChatAssistantActions.updateCurrentChatTopic, (state, action) => ({
    ...state,
    currentChat: state.currentChat ? { ...state.currentChat, topic: action.topic } : state.currentChat,
  })),
  on(ChatAssistantActions.searchQueryChanged, (state, action) => ({
    ...state,
    searchQuery: action.query,
  })),
);