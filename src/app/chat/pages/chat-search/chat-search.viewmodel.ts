import {
  DataTableColumn,
  RowListGridData,
} from '@onecx/angular-accelerator';
import { ChatSearchCriteria } from './chat-search.parameters';

export interface ChatSearchViewModel {
  columns: DataTableColumn[];
  searchCriteria: ChatSearchCriteria;
  results: RowListGridData[];
  displayedColumns: DataTableColumn[];
  viewMode: 'basic' | 'advanced';
  chartVisible: boolean;
}
