import { ColumnType, DataTableColumn } from '@onecx/angular-accelerator'

export const chatSearchColumns: DataTableColumn[] = [
  {
    columnType: ColumnType.STRING,
    id: 'topic',
    nameKey: 'CHAT_SEARCH.RESULTS.TOPIC',
    filterable: true,
    sortable: true,
    predefinedGroupKeys: ['CHAT_SEARCH.PREDEFINED_GROUP.DEFAULT', 'CHAT_SEARCH.PREDEFINED_GROUP.EXTENDED']
  },
  {
    columnType: ColumnType.STRING,
    id: 'summary',
    nameKey: 'CHAT_SEARCH.RESULTS.SUMMARY',
    filterable: false,
    sortable: true,
    predefinedGroupKeys: ['CHAT_SEARCH.PREDEFINED_GROUP.EXTENDED']
  },
  {
    columnType: ColumnType.STRING,
    id: 'type',
    nameKey: 'CHAT_SEARCH.RESULTS.TYPE',
    filterable: true,
    sortable: true,
    predefinedGroupKeys: ['CHAT_SEARCH.PREDEFINED_GROUP.DEFAULT', 'CHAT_SEARCH.PREDEFINED_GROUP.EXTENDED']
  },
  {
    columnType: ColumnType.STRING,
    id: 'creationUser',
    nameKey: 'CHAT_SEARCH.RESULTS.CREATED_BY',
    filterable: true,
    sortable: true,
    predefinedGroupKeys: ['CHAT_SEARCH.PREDEFINED_GROUP.EXTENDED']
  },
  {
    columnType: ColumnType.DATE,
    id: 'creationDate',
    nameKey: 'CHAT_SEARCH.RESULTS.CREATED_DATE',
    filterable: true,
    sortable: true,
    predefinedGroupKeys: ['CHAT_SEARCH.PREDEFINED_GROUP.EXTENDED']
  }
]
