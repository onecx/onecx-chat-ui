import { createSelector } from '@ngrx/store';
import { createChildSelectors } from '@onecx/ngrx-accelerator';
import { DataTableColumn, RowListGridData } from '@onecx/angular-accelerator';
import { chatFeature } from '../../chat.reducers';
import { initialState } from './chat-search.reducers';
import { ChatSearchViewModel } from './chat-search.viewmodel';

export const chatSearchSelectors = createChildSelectors(
  chatFeature.selectSearch,
  initialState
);

export const selectResults = createSelector(
  chatSearchSelectors.selectResults,
  (results): RowListGridData[] => {
    if (!results || !Array.isArray(results)) {
      return [];
    }
    return results.map((item) => ({
      imagePath: '',
      id: item?.id ?? '',
      ...item,
      // ACTION S7: Here you can create a mapping of the items and their corresponding translation strings
    }));
  }
);

export const selectDisplayedColumns = createSelector(
  chatSearchSelectors.selectColumns,
  chatSearchSelectors.selectDisplayedColumns,
  (columns, displayedColumns): DataTableColumn[] => {
    if (!columns || !Array.isArray(columns) || !displayedColumns || !Array.isArray(displayedColumns)) {
      return [];
    }
    return (
      displayedColumns
        .map((d) => columns.find((c) => c?.id === d))
        .filter(Boolean) as DataTableColumn[]
    ) ?? [];
  }
);

export const selectChatSearchViewModel = createSelector(
  chatSearchSelectors.selectColumns,
  chatSearchSelectors.selectCriteria,
  selectResults,
  selectDisplayedColumns,
  chatSearchSelectors.selectViewMode,
  chatSearchSelectors.selectChartVisible,
  (
    columns,
    searchCriteria,
    results,
    displayedColumns,
    viewMode,
    chartVisible
  ): ChatSearchViewModel => ({
    columns,
    searchCriteria,
    results,
    displayedColumns,
    viewMode,
    chartVisible,
  })
);