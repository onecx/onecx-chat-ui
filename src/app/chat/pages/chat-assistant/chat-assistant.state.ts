import { Chat, Message, ChatType } from 'src/app/shared/generated';

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
  selectedChatMode: ChatType | null;
  chatInitialized: boolean;
  searchQuery: string;
  voiceChatEnabled: boolean;
}