import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { DataTableColumn } from '@onecx/angular-accelerator';
import { Chat } from 'src/app/shared/generated';
import { ChatSearchCriteria } from './chat-search.parameters';

export const ChatSearchActions = createActionGroup({
  source: 'ChatSearch',
  events: {
    'Details button clicked': props<{
      id: number | string;
    }>(),

    'Search button clicked': props<{
      searchCriteria: ChatSearchCriteria;
    }>(),
    'Reset button clicked': emptyProps(),
    'chat search results received': props<{
      results: Chat[];
      totalNumberOfResults: number;
    }>(),
    'chat search results loading failed': props<{ error: string | null }>(),
    'Displayed columns changed': props<{
      displayedColumns: DataTableColumn[];
    }>(),
    'Chart visibility rehydrated': props<{
      visible: boolean;
    }>(),
    'Chart visibility toggled': emptyProps(),
    'View mode changed': props<{
      viewMode: 'basic' | 'advanced';
    }>(),
    'Export button clicked': emptyProps(),
  },
});
