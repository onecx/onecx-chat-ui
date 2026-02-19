import { Chat, Message } from '../../../shared/generated';
import { initialState } from './chat-details.reducers';
import { selectChatDetailsViewModel } from './chat-details.selectors';
import { ChatDetailsState } from './chat-details.state';
import { ChatDetailsViewModel } from './chat-details.viewmodel';

describe('ChatDetailsSelectors', () => {
  const mockChat: Chat = {
    id: '1',
    topic: 'Test Chat',
    type: 'AI_CHAT' as any,
    participants: []
  };

  const mockMessages: Message[] = [
    {
      id: 'msg1',
      text: 'Hello',
      createdAt: '2024-01-01T00:00:00Z',
      sender: { id: 'user1', name: 'User 1' }
    } as any,
    {
      id: 'msg2',
      text: 'Hi there',
      createdAt: '2024-01-01T00:01:00Z',
      sender: { id: 'user2', name: 'User 2' }
    } as any
  ];

  const mockState: { chat: { details: ChatDetailsState }, onecx: { location: { backNavigationPossible: boolean } } } = {
    chat: {
      details: {
        ...initialState,
        details: mockChat,
        messages: mockMessages,
        detailsLoadingIndicator: false,
        detailsLoaded: true
      }
    },
    onecx: {
      location: {
        backNavigationPossible: true
      }
    }
  };

  describe('selectChatDetailsViewModel', () => {
    it('should select details view model from state', () => {
      expect(
        selectChatDetailsViewModel.projector(
          mockState.chat.details.details,
          mockState.chat.details.detailsLoadingIndicator,
          mockState.onecx.location.backNavigationPossible,
          mockState.chat.details.detailsLoaded,
          mockState.chat.details.messages
        )
      ).toEqual<ChatDetailsViewModel>({
        details: mockChat,
        detailsLoadingIndicator: false,
        backNavigationPossible: true,
        detailsLoaded: true,
        messages: mockMessages
      }
      )
    });
  })
});