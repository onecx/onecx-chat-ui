import { Chat, Message, ChatType } from 'src/app/shared/generated';

export interface ChatAssistantState {
  user: string | undefined;
  chats: Chat[];
  currentChat: Chat | undefined;
  currentMessages: Message[] | undefined;
  selectedChatMode: ChatType | null;
  chatInitialized: boolean;
  searchQuery: string;
  totalAvailableChats: number | undefined;
  settingsOpen: boolean;
}