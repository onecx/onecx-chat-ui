import { ChatMessage } from 'src/app/shared/components/chat/chat.viewmodel';
import { Chat } from 'src/app/shared/generated';

export interface ChatAssistantViewModel {
  chats: Chat[] | undefined;
  currentChat: Chat | undefined;
  currentMessages: ChatMessage[] | undefined;
  chatTitleKey: string;
  selectedChatMode: string | null;
  voiceChatEnabled: boolean;
}