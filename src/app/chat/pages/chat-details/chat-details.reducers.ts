import { createReducer, on } from '@ngrx/store'

import { ChatDetailsActions } from './chat-details.actions'
import { ChatDetailsState } from './chat-details.state'

export const initialState: ChatDetailsState = {
  details: undefined,
  detailsLoadingIndicator: true,
  detailsLoaded: false,
  messages: undefined
}

export const chatDetailsReducer = createReducer(
  initialState,
  on(ChatDetailsActions.chatDetailsReceived, (state: ChatDetailsState, { details }): ChatDetailsState => ({
    ...state,
    details,
    detailsLoadingIndicator: false,
    detailsLoaded: true
  })),
  on(ChatDetailsActions.chatDetailsLoadingFailed, (state: ChatDetailsState): ChatDetailsState => ({
    ...state,
    details: undefined,
    detailsLoadingIndicator: false,
    detailsLoaded: false
  })),
  on(ChatDetailsActions.navigatedToDetailsPage, (): ChatDetailsState => ({
    ...initialState
  })),
  on(ChatDetailsActions.messagesLoaded, (state: ChatDetailsState, { messages }): ChatDetailsState => ({
    ...state,
    messages
  }))
)
