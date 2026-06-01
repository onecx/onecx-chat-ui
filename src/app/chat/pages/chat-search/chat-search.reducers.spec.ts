import { routerNavigatedAction } from '@ngrx/router-store';
import { ChatSearchActions } from './chat-search.actions';
import { chatSearchColumns } from './chat-search.columns';
import { chatSearchReducer, initialState } from './chat-search.reducers';
import { ChatSearchState } from './chat-search.state';
import { Chat } from 'src/app/shared/generated';

describe('ChatSearchReducer', () => {
  const mockChat: Chat = {
    id: '1',
    topic: 'Test Chat',
    type: 'AI_CHAT' as any,
    participants: []
  };

  const mockChats: Chat[] = [
    {
      id: '1',
      topic: 'Chat 1',
      type: 'AI_CHAT' as any,
      participants: []
    },
    {
      id: '2',
      topic: 'Chat 2',
      type: 'HUMAN_CHAT' as any,
      participants: []
    }
  ];

  describe('initial state', () => {
    it('should have correct initial state', () => {
      expect(initialState).toEqual({
        columns: chatSearchColumns,
        results: [],
        displayedColumns: null,
        viewMode: 'basic',
        chartVisible: false,
        searchLoadingIndicator: false,
        criteria: {},
      });
    });

    it('should return initial state when action is unknown', () => {
      const action = { type: 'UNKNOWN_ACTION' } as any;
      const result = chatSearchReducer(initialState, action);

      expect(result).toBe(initialState);
    });
  });

  describe('routerNavigatedAction', () => {
    it('should update criteria and searchLoadingIndicator when router navigation has valid query params', () => {
      const queryParams = {
        topic: 'test'
      };

      const action = routerNavigatedAction({
        payload: {
          routerState: {
            root: {
              queryParams
            }
          } as any,
          event: {} as any
        }
      });

      const result = chatSearchReducer(initialState, action);

      expect(result.searchLoadingIndicator).toBe(true);
      expect(result.criteria).toEqual(expect.objectContaining({
        topic: 'test'
      }));
    });

    it('should not set searchLoadingIndicator when query params are empty', () => {
      const queryParams = {};

      const action = routerNavigatedAction({
        payload: {
          routerState: {
            root: {
              queryParams
            }
          } as any,
          event: {} as any
        }
      });

      const result = chatSearchReducer(initialState, action);

      expect(result.searchLoadingIndicator).toBe(false);
      expect(result.criteria).toEqual({});
    });

    it('should return unchanged state when query params parsing fails', () => {
      const action = routerNavigatedAction({
        payload: {
          routerState: {
            root: {
              queryParams: {
                topic: 123 // number instead of string - should fail validation
              }
            }
          } as any,
          event: {} as any
        }
      });

      const result = chatSearchReducer(initialState, action);

      expect(result).toBe(initialState);
    });
  });

  describe('resetButtonClicked', () => {
    it('should reset results and criteria to initial values', () => {
      const currentState: ChatSearchState = {
        ...initialState,
        results: [mockChat],
        criteria: { topic: 'test' },
        searchLoadingIndicator: true,
        chartVisible: true
      };

      const action = ChatSearchActions.resetButtonClicked();
      const result = chatSearchReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        results: [],
        criteria: {}
      });
    });

    it('should preserve other state properties when resetting', () => {
      const currentState: ChatSearchState = {
        ...initialState,
        results: [mockChat],
        criteria: { topic: 'test' },
        viewMode: 'advanced',
        chartVisible: true,
        displayedColumns: ['id', 'name']
      };

      const action = ChatSearchActions.resetButtonClicked();
      const result = chatSearchReducer(currentState, action);

      expect(result.viewMode).toBe('advanced');
      expect(result.chartVisible).toBe(true);
      expect(result.displayedColumns).toEqual(['id', 'name']);
    });
  });

  describe('searchButtonClicked', () => {
    it('should set searchLoadingIndicator to true and update criteria', () => {
      const searchCriteria = {
        topic: 'test search'
      };

      const action = ChatSearchActions.searchButtonClicked({ searchCriteria });
      const result = chatSearchReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        searchLoadingIndicator: true,
        criteria: searchCriteria
      });
    });

    it('should override previous criteria with new search criteria', () => {
      const currentState: ChatSearchState = {
        ...initialState,
        criteria: { topic: 'old value' }
      };

      const newCriteria = { topic: 'new value' };
      const action = ChatSearchActions.searchButtonClicked({ searchCriteria: newCriteria });
      const result = chatSearchReducer(currentState, action);

      expect(result.criteria).toEqual(newCriteria);
      expect(result.searchLoadingIndicator).toBe(true);
    });
  });

  describe('chatSearchResultsReceived', () => {
    it('should update results with received data', () => {
      const results = mockChats;
      const totalNumberOfResults = 2;

      const action = ChatSearchActions.chatSearchResultsReceived({ 
        results, 
        totalNumberOfResults 
      });
      const result = chatSearchReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        results
      });
    });

    it('should preserve other state properties when updating results', () => {
      const currentState: ChatSearchState = {
        ...initialState,
        searchLoadingIndicator: true,
        criteria: { topic: 'test' },
        chartVisible: true
      };

      const results = [mockChat];
      const action = ChatSearchActions.chatSearchResultsReceived({ 
        results, 
        totalNumberOfResults: 1 
      });
      const result = chatSearchReducer(currentState, action);

      expect(result.results).toEqual(results);
      expect(result.searchLoadingIndicator).toBe(true);
      expect(result.criteria).toEqual({ topic: 'test' });
      expect(result.chartVisible).toBe(true);
    });

    it('should handle empty results array', () => {
      const action = ChatSearchActions.chatSearchResultsReceived({ 
        results: [], 
        totalNumberOfResults: 0 
      });
      const result = chatSearchReducer(initialState, action);

      expect(result.results).toEqual([]);
    });
  });

  describe('chatSearchResultsLoadingFailed', () => {
    it('should clear results on loading failure', () => {
      const currentState: ChatSearchState = {
        ...initialState,
        results: [mockChat],
        searchLoadingIndicator: true
      };

      const action = ChatSearchActions.chatSearchResultsLoadingFailed({ error: 'Network error' });
      const result = chatSearchReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        results: []
      });
    });

    it('should preserve other state properties when clearing results', () => {
      const currentState: ChatSearchState = {
        ...initialState,
        results: [mockChat],
        searchLoadingIndicator: true,
        criteria: { topic: 'test' },
        chartVisible: true
      };

      const action = ChatSearchActions.chatSearchResultsLoadingFailed({ error: 'Network error' });
      const result = chatSearchReducer(currentState, action);

      expect(result.results).toEqual([]);
      expect(result.searchLoadingIndicator).toBe(true);
      expect(result.criteria).toEqual({ topic: 'test' });
      expect(result.chartVisible).toBe(true);
    });

    it('should handle null error', () => {
      const action = ChatSearchActions.chatSearchResultsLoadingFailed({ error: null });
      const result = chatSearchReducer(initialState, action);

      expect(result.results).toEqual([]);
    });
  });

  describe('chartVisibilityRehydrated', () => {
    it('should set chartVisible to true when rehydrated with visible=true', () => {
      const action = ChatSearchActions.chartVisibilityRehydrated({ visible: true });
      const result = chatSearchReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        chartVisible: true
      });
    });

    it('should set chartVisible to false when rehydrated with visible=false', () => {
      const currentState: ChatSearchState = {
        ...initialState,
        chartVisible: true
      };

      const action = ChatSearchActions.chartVisibilityRehydrated({ visible: false });
      const result = chatSearchReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        chartVisible: false
      });
    });
  });

  describe('chartVisibilityToggled', () => {
    it('should toggle chartVisible from false to true', () => {
      const action = ChatSearchActions.chartVisibilityToggled();
      const result = chatSearchReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        chartVisible: true
      });
    });

    it('should toggle chartVisible from true to false', () => {
      const currentState: ChatSearchState = {
        ...initialState,
        chartVisible: true
      };

      const action = ChatSearchActions.chartVisibilityToggled();
      const result = chatSearchReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        chartVisible: false
      });
    });
  });

  describe('viewModeChanged', () => {
    it('should update viewMode to advanced', () => {
      const action = ChatSearchActions.viewModeChanged({ viewMode: 'advanced' });
      const result = chatSearchReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        viewMode: 'advanced'
      });
    });

    it('should update viewMode to basic', () => {
      const currentState: ChatSearchState = {
        ...initialState,
        viewMode: 'advanced'
      };

      const action = ChatSearchActions.viewModeChanged({ viewMode: 'basic' });
      const result = chatSearchReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        viewMode: 'basic'
      });
    });
  });

  describe('displayedColumnsChanged', () => {
    it('should update displayedColumns with column ids', () => {
      const displayedColumns = [
        { id: 'name', name: 'Name' },
        { id: 'status', name: 'Status' },
        { id: 'date', name: 'Date' }
      ] as any;

      const action = ChatSearchActions.displayedColumnsChanged({ displayedColumns });
      const result = chatSearchReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        displayedColumns: ['name', 'status', 'date']
      });
    });

    it('should handle empty displayedColumns array', () => {
      const action = ChatSearchActions.displayedColumnsChanged({ displayedColumns: [] });
      const result = chatSearchReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        displayedColumns: []
      });
    });

    it('should extract only ids from column objects', () => {
      const displayedColumns = [
        { id: 'name', name: 'Name', sortable: true, width: 100 },
        { id: 'status', name: 'Status', sortable: false, width: 80 }
      ] as any;

      const action = ChatSearchActions.displayedColumnsChanged({ displayedColumns });
      const result = chatSearchReducer(initialState, action);

      expect(result.displayedColumns).toEqual(['name', 'status']);
    });
  });

  describe('state immutability', () => {
    it('should not mutate the original state', () => {
      const originalState = { ...initialState };
      const action = ChatSearchActions.searchButtonClicked({ 
        searchCriteria: { topic: 'test' } 
      });

      chatSearchReducer(initialState, action);

      expect(initialState).toEqual(originalState);
    });

    it('should create new state object for each action', () => {
      const action1 = ChatSearchActions.chartVisibilityToggled();
      const result1 = chatSearchReducer(initialState, action1);

      const action2 = ChatSearchActions.viewModeChanged({ viewMode: 'advanced' });
      const result2 = chatSearchReducer(result1, action2);

      expect(result1).not.toBe(initialState);
      expect(result2).not.toBe(result1);
      expect(result2).not.toBe(initialState);
    });
  });

  describe('edge cases', () => {
    it('should handle searchLoadingIndicator flag correctly with empty query params', () => {
      const action = routerNavigatedAction({
        payload: {
          routerState: {
            root: {
              queryParams: {}
            }
          } as any,
          event: {} as any
        }
      });

      const result = chatSearchReducer(initialState, action);

      expect(result.searchLoadingIndicator).toBe(false);
    });

    it('should handle searchLoadingIndicator flag correctly with single query param', () => {
      const action = routerNavigatedAction({
        payload: {
          routerState: {
            root: {
              queryParams: { topic: 'value' }
            }
          } as any,
          event: {} as any
        }
      });

      const result = chatSearchReducer(initialState, action);

      expect(result.searchLoadingIndicator).toBe(true);
    });

    it('should handle undefined criteria gracefully', () => {
      const action = ChatSearchActions.searchButtonClicked({ 
        searchCriteria: {} 
      });
      const result = chatSearchReducer(initialState, action);

      expect(result.criteria).toEqual({});
      expect(result.searchLoadingIndicator).toBe(true);
    });
  });
});
