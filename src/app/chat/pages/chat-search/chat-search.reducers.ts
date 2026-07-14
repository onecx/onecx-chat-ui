import { routerNavigatedAction, RouterNavigatedAction } from '@ngrx/router-store'
import { createReducer, on } from '@ngrx/store'

import { ChatSearchActions } from './chat-search.actions'
import { chatSearchColumns } from './chat-search.columns'
import { chatSearchCriteriasSchema } from './chat-search.parameters'
import { ChatSearchState } from './chat-search.state'

export const initialState: ChatSearchState = {
  columns: chatSearchColumns,
  results: [],
  displayedColumns: null,
  viewMode: 'basic',
  chartVisible: false,
  searchLoadingIndicator: false,
  criteria: {}
}

export const chatSearchReducer = createReducer(
  initialState,
  on(routerNavigatedAction, (state: ChatSearchState, action: RouterNavigatedAction) => {
    const results = chatSearchCriteriasSchema.safeParse(action.payload.routerState.root.queryParams)
    if (results.success) {
      return {
        ...state,
        criteria: results.data,
        searchLoadingIndicator: Object.keys(action.payload.routerState.root.queryParams).length != 0
      }
    }
    return state
  }),
  on(ChatSearchActions.resetButtonClicked, (state: ChatSearchState): ChatSearchState => ({
    ...state,
    results: initialState.results,
    criteria: {}
  })),
  on(ChatSearchActions.searchButtonClicked, (state: ChatSearchState, { searchCriteria }): ChatSearchState => ({
    ...state,
    searchLoadingIndicator: true,
    criteria: searchCriteria
  })),
  on(ChatSearchActions.chatSearchResultsReceived, (state: ChatSearchState, { results }): ChatSearchState => ({
    ...state,
    results
  })),
  on(ChatSearchActions.chatSearchResultsLoadingFailed, (state: ChatSearchState): ChatSearchState => ({
    ...state,
    results: []
  })),
  on(ChatSearchActions.chartVisibilityRehydrated, (state: ChatSearchState, { visible }): ChatSearchState => ({
    ...state,
    chartVisible: visible
  })),
  on(ChatSearchActions.chartVisibilityToggled, (state: ChatSearchState): ChatSearchState => ({
    ...state,
    chartVisible: !state.chartVisible
  })),
  on(ChatSearchActions.viewModeChanged, (state: ChatSearchState, { viewMode }): ChatSearchState => ({
    ...state,
    viewMode: viewMode
  })),
  on(ChatSearchActions.displayedColumnsChanged, (state: ChatSearchState, { displayedColumns }): ChatSearchState => ({
    ...state,
    displayedColumns: displayedColumns.map((v) => v.id)
  }))
)
