import {
  Chat,
  Message,
  ChatType,
  ConfigurationFilter,
  ConfigurationFilterKeyEnum,
} from 'src/app/shared/generated';

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
  agents: ChatAgent[];
  selectedAgentId: string;
}

export interface ChatAgent {
  id: string;
  labelKey: string;
  agentName: string;
  gatherContext: boolean;
  filter: ConfigurationFilter | null;
}

export const DEFAULT_AGENT_ID = 'default';

export const CHAT_AGENTS: ChatAgent[] = [
  {
    id: 'default',
    labelKey: 'CHAT.AGENTS.DEFAULT',
    agentName: 'assistant',
    gatherContext: false,
    filter: null,
  },
  {
    id: 'event-management',
    labelKey: 'CHAT.AGENTS.EVENT_MANAGEMENT',
    agentName: 'event-management',
    gatherContext: true,
    filter: {
      key: ConfigurationFilterKeyEnum.AppId,
      value: 'event-management-ui',
    },
  },
];
