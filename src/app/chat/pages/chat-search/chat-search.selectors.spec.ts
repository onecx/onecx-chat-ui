import { DataTableColumn } from '@onecx/angular-accelerator';
import { Chat } from 'src/app/shared/generated';
import { chatSearchColumns } from './chat-search.columns';
import { initialState } from './chat-search.reducers';
import {
  chatSearchSelectors,
  selectResults,
  selectDisplayedColumns,
  selectChatSearchViewModel
} from './chat-search.selectors';
import { ChatSearchState } from './chat-search.state';

describe('ChatSearchSelectors', () => {
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

  const mockColumns: DataTableColumn[] = [
    { id: 'id' } as DataTableColumn,
    { id: 'topic' } as DataTableColumn,
    { id: 'type' } as DataTableColumn,
    { id: 'participants' } as DataTableColumn
  ];

  const mockState: { chat: { search: ChatSearchState } } = {
    chat: {
      search: {
        ...initialState,
        results: mockChats,
        columns: mockColumns,
        displayedColumns: ['id', 'topic', 'type'],
        viewMode: 'advanced',
        chartVisible: true,
        criteria: { topic: 'test' }
      }
    }
  };

  describe('chatSearchSelectors', () => {
    it('should select results from state', () => {
      const result = chatSearchSelectors.selectResults(mockState);
      expect(result).toEqual(mockChats);
    });

    it('should select columns from state', () => {
      const result = chatSearchSelectors.selectColumns(mockState);
      expect(result).toEqual(mockColumns);
    });

    it('should select displayedColumns from state', () => {
      const result = chatSearchSelectors.selectDisplayedColumns(mockState);
      expect(result).toEqual(['id', 'topic', 'type']);
    });

    it('should select viewMode from state', () => {
      const result = chatSearchSelectors.selectViewMode(mockState);
      expect(result).toBe('advanced');
    });

    it('should select chartVisible from state', () => {
      const result = chatSearchSelectors.selectChartVisible(mockState);
      expect(result).toBe(true);
    });

    it('should select criteria from state', () => {
      const result = chatSearchSelectors.selectCriteria(mockState);
      expect(result).toEqual({ topic: 'test' });
    });

    it('should select searchLoadingIndicator from state', () => {
      const stateWithLoading = {
        chat: {
          search: {
            ...mockState.chat.search,
            searchLoadingIndicator: true
          }
        }
      };
      const result = chatSearchSelectors.selectSearchLoadingIndicator(stateWithLoading);
      expect(result).toBe(true);
    });
  });

  describe('selectResults', () => {
    it('should transform results to RowListGridData format', () => {
      const result = selectResults(mockState);
      
      expect(result).toEqual([
        {
          imagePath: '',
          id: '1',
          topic: 'Chat 1',
          type: 'AI_CHAT',
          participants: []
        },
        {
          imagePath: '',
          id: '2',
          topic: 'Chat 2',
          type: 'HUMAN_CHAT',
          participants: []
        }
      ]);
    });

    it('should handle item as undefined in results array', () => {
  const state = {
    chat: {
      search: {
        ...mockState.chat.search,
        results: [undefined]
      }
    }
  };
  const result = selectResults(state);
  expect(result[0].id).toBe('');
  expect(result[0].imagePath).toBe('');
});

    it('should handle empty results array', () => {
      const emptyState = {
        chat: {
          search: {
            ...mockState.chat.search,
            results: []
          }
        }
      };
      
      const result = selectResults(emptyState);
      expect(result).toEqual([]);
    });

    it('should handle results with undefined id', () => {
      const chatWithoutId = { ...mockChat };
      delete (chatWithoutId as any).id;
      
      const stateWithUndefinedId = {
        chat: {
          search: {
            ...mockState.chat.search,
            results: [chatWithoutId]
          }
        }
      };
      
      const result = selectResults(stateWithUndefinedId);
      expect(result[0].id).toBe('');
      expect(result[0].imagePath).toBe('');
    });

    it('should preserve all original properties', () => {
      const chatWithExtraProps = {
        ...mockChat,
        customProp: 'customValue',
        anotherProp: 123
      };
      
      const stateWithExtraProps = {
        chat: {
          search: {
            ...mockState.chat.search,
            results: [chatWithExtraProps]
          }
        }
      };
      
      const result = selectResults(stateWithExtraProps);
      expect(result[0]).toEqual({
        imagePath: '',
        id: '1',
        topic: 'Test Chat',
        type: 'AI_CHAT',
        participants: [],
        customProp: 'customValue',
        anotherProp: 123
      });
    });
  });

  describe('selectDisplayedColumns', () => {
    it('should return columns matching displayedColumns ids', () => {
      const result = selectDisplayedColumns(mockState);
      
      expect(result).toEqual([
        { id: 'id' } as DataTableColumn,
        { id: 'topic' } as DataTableColumn,
        { id: 'type' } as DataTableColumn
      ]);
    });

    it('should return empty array when displayedColumns is null', () => {
      const stateWithNullDisplayed = {
        chat: {
          search: {
            ...mockState.chat.search,
            displayedColumns: null
          }
        }
      };
      
      const result = selectDisplayedColumns(stateWithNullDisplayed);
      expect(result).toEqual([]);
    });

    it('should return empty array when displayedColumns is empty', () => {
      const stateWithEmptyDisplayed = {
        chat: {
          search: {
            ...mockState.chat.search,
            columns: mockColumns,
            displayedColumns: []
          }
        }
      };
      
      const result = selectDisplayedColumns(stateWithEmptyDisplayed);
      expect(result).toEqual([]);
    });

    it('should filter out non-existing column ids', () => {
      const stateWithInvalidIds = {
        chat: {
          search: {
            ...mockState.chat.search,
            displayedColumns: ['id', 'nonexistent', 'topic', 'invalid']
          }
        }
      };
      
      const result = selectDisplayedColumns(stateWithInvalidIds);
      expect(result).toEqual([
        { id: 'id' } as DataTableColumn,
        { id: 'topic' } as DataTableColumn
      ]);
    });

    it('should preserve order of displayedColumns', () => {
      const stateWithReorderedColumns = {
        chat: {
          search: {
            ...mockState.chat.search,
            displayedColumns: ['type', 'id', 'topic']
          }
        }
      };
      
      const result = selectDisplayedColumns(stateWithReorderedColumns);
      expect(result).toEqual([
        { id: 'type' } as DataTableColumn,
        { id: 'id' } as DataTableColumn,
        { id: 'topic' } as DataTableColumn
      ]);
    });

    it('should handle duplicate column ids', () => {
      const stateWithDuplicates = {
        chat: {
          search: {
            ...mockState.chat.search,
            columns: mockColumns,
            displayedColumns: ['id', 'topic', 'id', 'type']
          }
        }
      };
      
      const result = selectDisplayedColumns(stateWithDuplicates);
      expect(result).toEqual([
        { id: 'id' } as DataTableColumn,
        { id: 'topic' } as DataTableColumn,
        { id: 'id' } as DataTableColumn,
        { id: 'type' } as DataTableColumn
      ]);
    });
  });

  describe('selectChatSearchViewModel', () => {
    it('should create complete view model', () => {
      const result = selectChatSearchViewModel(mockState);
      
      expect(result).toEqual({
        columns: mockColumns,
        searchCriteria: { topic: 'test' },
        results: [
          {
            imagePath: '',
            id: '1',
            topic: 'Chat 1',
            type: 'AI_CHAT',
            participants: []
          },
          {
            imagePath: '',
            id: '2',
            topic: 'Chat 2',
            type: 'HUMAN_CHAT',
            participants: []
          }
        ],
        displayedColumns: [
          { id: 'id' } as DataTableColumn,
          { id: 'topic' } as DataTableColumn,
          { id: 'type' } as DataTableColumn
        ],
        viewMode: 'advanced',
        chartVisible: true
      });
    });

    it('should handle initial state', () => {
      const initialMockState = {
        chat: {
          search: {
            ...initialState,
            columns: chatSearchColumns
          }
        }
      };
      
      const result = selectChatSearchViewModel(initialMockState);
      
      expect(result).toEqual({
        columns: chatSearchColumns,
        searchCriteria: {},
        results: [],
        displayedColumns: [],
        viewMode: 'basic',
        chartVisible: false
      });
    });

    it('should handle basic view mode', () => {
      const basicModeState = {
        chat: {
          search: {
            ...mockState.chat.search,
            viewMode: 'basic' as const,
            chartVisible: false
          }
        }
      };
      
      const result = selectChatSearchViewModel(basicModeState);
      
      expect(result.viewMode).toBe('basic');
      expect(result.chartVisible).toBe(false);
    });

    it('should handle empty criteria', () => {
      const emptyCriteriaState = {
        chat: {
          search: {
            ...mockState.chat.search,
            criteria: {}
          }
        }
      };
      
      const result = selectChatSearchViewModel(emptyCriteriaState);
      expect(result.searchCriteria).toEqual({});
    });

    it('should handle null displayedColumns in view model', () => {
      const nullDisplayedState = {
        chat: {
          search: {
            ...mockState.chat.search,
            displayedColumns: null
          }
        }
      };
      
      const result = selectChatSearchViewModel(nullDisplayedState);
      expect(result.displayedColumns).toEqual([]);
    });
  });

  describe('selector memoization', () => {
    it('should return same reference when input state unchanged', () => {
      const result1 = selectResults(mockState);
      const result2 = selectResults(mockState);
      
      expect(result1).toBe(result2);
    });

    it('should return new reference when results change', () => {
      const result1 = selectResults(mockState);
      
      const modifiedState = {
        chat: {
          search: {
            ...mockState.chat.search,
            results: [...mockState.chat.search.results, mockChat]
          }
        }
      };
      
      const result2 = selectResults(modifiedState);
      
      expect(result1).not.toBe(result2);
    });

    it('should return same displayedColumns reference when columns and displayedColumns unchanged', () => {
      const result1 = selectDisplayedColumns(mockState);
      const result2 = selectDisplayedColumns(mockState);
      
      expect(result1).toBe(result2);
    });

    it('should return same view model reference when all dependencies unchanged', () => {
      const result1 = selectChatSearchViewModel(mockState);
      const result2 = selectChatSearchViewModel(mockState);
      
      expect(result1).toBe(result2);
    });

    it('should return new view model when any dependency changes', () => {
      const result1 = selectChatSearchViewModel(mockState);
      
      const modifiedState = {
        chat: {
          search: {
            ...mockState.chat.search,
            chartVisible: false
          }
        }
      };
      
      const result2 = selectChatSearchViewModel(modifiedState);
      
      expect(result1).not.toBe(result2);
      expect(result2.chartVisible).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle null results gracefully', () => {
      const nullResultsState = {
        chat: {
          search: {
            ...mockState.chat.search,
            results: null as any
          }
        }
      };
      
      const result = selectResults(nullResultsState);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle columns with missing id property', () => {
      const stateWithIncompleteColumns = {
        chat: {
          search: {
            ...mockState.chat.search,
            columns: [
              { id: 'id' } as DataTableColumn,
              {} as DataTableColumn, // Missing id
              { id: 'topic' } as DataTableColumn
            ],
            displayedColumns: ['id', 'missing', 'topic']
          }
        }
      };
      
      const result = selectDisplayedColumns(stateWithIncompleteColumns);
      expect(result).toEqual([
        { id: 'id' } as DataTableColumn,
        { id: 'topic' } as DataTableColumn
      ]);
    });

    it('should handle null columns gracefully', () => {
      const nullColumnsState = {
        chat: {
          search: {
            ...mockState.chat.search,
            columns: null as any,
            displayedColumns: ['id', 'topic']
          }
        }
      };
      
      const result = selectDisplayedColumns(nullColumnsState);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  it('should handle columns array with undefined element', () => {
  const state = {
    chat: {
      search: {
        ...mockState.chat.search,
        columns: [undefined, { id: 'id' }, { id: 'topic' }],
        displayedColumns: ['id', 'topic', 'missing']
      }
    }
  };
  const result = selectDisplayedColumns(state);
  expect(result).toEqual([{ id: 'id' }, { id: 'topic' }]);
});

});