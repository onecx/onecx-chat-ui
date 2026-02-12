import { createSelector } from '@ngrx/store';
import { createChildSelectors } from '@onecx/ngrx-accelerator';
import { ChatMessage } from 'src/app/shared/components/chat/chat.viewmodel';
import { Chat, Message } from 'src/app/shared/generated';
import { chatFeature } from '../../chat.reducers';
import { initialState } from './chat-assistant.reducers';
import { ChatAssistantViewModel } from './chat-assistant.viewmodel';

export const chatAssistantSelectors = createChildSelectors(
  chatFeature.selectAssistant,
  initialState
);

export const selectChatAssistantViewModel = createSelector(
  chatAssistantSelectors.selectChats,
  chatAssistantSelectors.selectCurrentChat,
  chatAssistantSelectors.selectCurrentMessages,
  chatFeature.selectAssistant,
  (
    chats: Chat[],
    currentChat: Chat | undefined,
    currentMessages: Message[] | undefined,
    state,
  ): ChatAssistantViewModel => {
    let chatTitleKey = 'CHAT.TITLE.DEFAULT';
    switch (state.selectedChatMode) {
      case 'ai':
        chatTitleKey = 'CHAT.TITLE.AI';
        break;
      case 'direct':
        chatTitleKey = 'CHAT.TITLE.DIRECT';
        break;
      case 'group':
        chatTitleKey = 'CHAT.TITLE.GROUP';
        break;
    }
    return {
      chats,
      currentChat: currentChat,
      currentMessages: currentMessages
        ?.map(
          (m) =>
          ({
            ...m,
            id: m.id ?? '',
            text: m.text ?? '',
            userName: currentChat?.participants
              ?.find((p) => p.id === m.userId)
              ?.userName?.trim(),
            userNameKey: `CHAT.PARTICIPANT.${m.type.toUpperCase()}`,
            creationDate: new Date(m.creationDate ?? ''),
          } as ChatMessage)
        )
        .sort((a, b) => a.creationDate.getTime() - b.creationDate.getTime()),
      chatTitleKey,
      selectedChatMode: state.selectedChatMode,
    };
  }
);