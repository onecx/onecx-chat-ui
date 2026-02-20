import { Chat, Message } from 'src/app/shared/generated';

export interface ChatUser {
  userId: string;
  userName: string;
  email: string;
}

export interface ChatAssistantState {
  user: ChatUser | undefined;
  chats: Chat[];
  currentChat: Chat | undefined;
  currentMessages: Message[] | undefined;
  topic: string;
  selectedChatMode: string | null;
  chatInitialized: boolean;
  voiceChatEnabled: boolean;
}