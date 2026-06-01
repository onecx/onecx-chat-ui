import { Chat, Message } from 'src/app/shared/generated';

export interface ChatDetailsState {
  details: Chat | undefined;
  messages: Message[] | undefined;
  detailsLoadingIndicator: boolean;
  detailsLoaded: boolean;
}
