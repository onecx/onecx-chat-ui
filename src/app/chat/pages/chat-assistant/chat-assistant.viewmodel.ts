import { ChatMessage } from 'src/app/shared/components/chat/chat.viewmodel';
import { Chat, ChatType } from 'src/app/shared/generated';

export interface ChatAssistantViewModel {
  chats: Chat[] | undefined;
  currentChat: Chat | undefined;
  currentMessages: ChatMessage[] | undefined;
  chatTitleKey: string;
  selectedChatMode: ChatType | null;
  voiceChatEnabled: boolean;
}