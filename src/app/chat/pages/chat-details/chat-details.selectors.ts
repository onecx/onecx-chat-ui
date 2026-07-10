import { createSelector } from '@ngrx/store';
import { createChildSelectors } from '@onecx/ngrx-accelerator';
import { chatFeature } from 'src/app/chat/chat.reducers';
import { initialState } from './chat-details.reducers';
import { ChatDetailsViewModel } from './chat-details.viewmodel';
import { selectBackNavigationPossible } from 'src/app/shared/selectors/onecx.selectors';
import { Chat, Message } from 'src/app/shared/generated';

export const chatDetailsSelectors = createChildSelectors(
  chatFeature.selectDetails,
  initialState,
);

export const selectChatDetailsViewModel = createSelector(
  chatDetailsSelectors.selectDetails,
  chatDetailsSelectors.selectDetailsLoadingIndicator,
  selectBackNavigationPossible,
  chatDetailsSelectors.selectDetailsLoaded,
  chatDetailsSelectors.selectMessages,
  (
    details: Chat | undefined,
    detailsLoadingIndicator: boolean,
    backNavigationPossible: boolean,
    detailsLoaded: boolean,
    messages: Message[] | undefined,
  ): ChatDetailsViewModel => ({
    details,
    detailsLoadingIndicator,
    backNavigationPossible,
    detailsLoaded,
    messages,
  }),
);
