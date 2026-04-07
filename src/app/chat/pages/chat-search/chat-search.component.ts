import { CommonModule } from '@angular/common';
import { Component, Inject, LOCALE_ID, OnInit, QueryList } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LetDirective } from '@ngrx/component';
import { Store } from '@ngrx/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  Action,
  AngularAcceleratorModule,
  BreadcrumbService,
  buildSearchCriteria,
  DataTableColumn,
  enumToDropdownOptions,
  RowListGridData,
} from '@onecx/angular-accelerator';
import { PortalPageComponent } from '@onecx/angular-utils';
import { PrimeIcons } from 'primeng/api';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { map, Observable } from 'rxjs';
import { ChatType } from 'src/app/shared/generated';
import { ChatSearchActions } from './chat-search.actions';
import {
  ChatSearchCriteria,
  chatSearchCriteriasSchema,
} from './chat-search.parameters';
import { selectChatSearchViewModel } from './chat-search.selectors';
import { ChatSearchViewModel } from './chat-search.viewmodel';

@Component({
  selector: 'app-chat-search',
  templateUrl: './chat-search.component.html',
  styleUrls: ['./chat-search.component.scss'],
  imports: [
    CommonModule,
    AngularAcceleratorModule,
    PortalPageComponent,
    LetDirective,
    ReactiveFormsModule,
    TranslateModule,
    FloatLabelModule,
    InputTextModule,
    SelectModule,
    TooltipModule,
  ],
})
export class ChatSearchComponent implements OnInit {
  viewModel$: Observable<ChatSearchViewModel> = this.store.select(
    selectChatSearchViewModel,
  );

  // ACTION S10: Update header actions
  headerActions$: Observable<Action[]> = this.viewModel$.pipe(
    map((vm) => {
      const actions: Action[] = [
        {
          labelKey: 'CHAT_SEARCH.HEADER_ACTIONS.EXPORT_ALL',
          icon: PrimeIcons.DOWNLOAD,
          titleKey: 'CHAT_SEARCH.HEADER_ACTIONS.EXPORT_ALL',
          show: 'asOverflow',
          actionCallback: () => this.exportItems(),
        },
        {
          labelKey: vm.chartVisible
            ? 'CHAT_SEARCH.HEADER_ACTIONS.HIDE_CHART'
            : 'CHAT_SEARCH.HEADER_ACTIONS.SHOW_CHART',
          icon: PrimeIcons.EYE,
          titleKey: vm.chartVisible
            ? 'CHAT_SEARCH.HEADER_ACTIONS.HIDE_CHART'
            : 'CHAT_SEARCH.HEADER_ACTIONS.SHOW_CHART',
          show: 'asOverflow',
          actionCallback: () => this.toggleChartVisibility(),
        },
      ];
      return actions;
    }),
  );

  // ACTION S9: Please select the column to be displayed in the diagram
  diagramColumnId = 'id';
  diagramColumn$ = this.viewModel$.pipe(
    map(
      (vm) =>
        vm.columns.find(
          (e) => e.id === this.diagramColumnId,
        ) as DataTableColumn,
    ),
  );

  public chatSearchFormGroup: FormGroup = this.formBuilder.group({
    ...(Object.fromEntries(
      chatSearchCriteriasSchema.keyof().options.map((k) => [k, null]),
    ) as Record<keyof ChatSearchCriteria, unknown>),
  } satisfies Record<keyof ChatSearchCriteria, unknown>);

  type$ = enumToDropdownOptions(
    this.translateService,
    ChatType,
    'CHAT_SEARCH.CRITERIA.TYPE.',
  );

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly store: Store,
    private readonly formBuilder: FormBuilder,
    @Inject(LOCALE_ID) public readonly locale: string,
    private readonly translateService: TranslateService,
  ) { }

  ngOnInit() {
    this.breadcrumbService.setItems([
      {
        titleKey: 'CHAT_SEARCH.BREADCRUMB',
        labelKey: 'CHAT_SEARCH.BREADCRUMB',
        routerLink: '/chat',
      },
    ]);
    this.viewModel$.subscribe((vm) =>
      this.chatSearchFormGroup.patchValue(vm.searchCriteria),
    );
  }

  search(formValue: FormGroup) {
    const searchCriteria = buildSearchCriteria(formValue.getRawValue(), new QueryList(), {
      removeNullValues: true,
    });
    this.store.dispatch(
      ChatSearchActions.searchButtonClicked({ searchCriteria }),
    );
  }

  details({ id }: RowListGridData) {
    this.store.dispatch(ChatSearchActions.detailsButtonClicked({ id }));
  }

  resetSearch() {
    this.store.dispatch(ChatSearchActions.resetButtonClicked());
  }

  exportItems() {
    this.store.dispatch(ChatSearchActions.exportButtonClicked());
  }

  viewModeChanged(viewMode: 'basic' | 'advanced') {
    this.store.dispatch(
      ChatSearchActions.viewModeChanged({
        viewMode: viewMode,
      }),
    );
  }

  onDisplayedColumnsChange(event: Event): void {
    const displayedColumns = (event as CustomEvent<DataTableColumn[]>).detail;
    this.store.dispatch(
      ChatSearchActions.displayedColumnsChanged({ displayedColumns }),
    );
  }

  toggleChartVisibility() {
    this.store.dispatch(ChatSearchActions.chartVisibilityToggled());
  }
}
