import { ChatDetailsState } from './pages/chat-details/chat-details.state'
import { ChatAssistantState } from './pages/chat-assistant/chat-assistant.state'
import { ChatSearchState } from './pages/chat-search/chat-search.state'

export interface ChatState {
  details: ChatDetailsState
  search: ChatSearchState
  assistant: ChatAssistantState
}
