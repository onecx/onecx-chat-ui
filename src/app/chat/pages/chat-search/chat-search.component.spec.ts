import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed'
import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { QueryList } from '@angular/core'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { FormBuilder, ReactiveFormsModule } from '@angular/forms'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'
import { ActivatedRoute } from '@angular/router'
import { LetDirective } from '@ngrx/component'
import { ofType } from '@ngrx/effects'
import { Store, StoreModule } from '@ngrx/store'
import { MockStore, provideMockStore } from '@ngrx/store/testing'
import { TranslateService } from '@ngx-translate/core'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { firstValueFrom } from 'rxjs'

import { provideUserServiceMock, provideAppStateServiceMock } from '@onecx/angular-integration-interface/mocks'
import {
  BreadcrumbService,
  buildSearchCriteria,
  ColumnType,
  AngularAcceleratorModule
} from '@onecx/angular-accelerator'
import { UserService } from '@onecx/angular-integration-interface'
import {
  AlwaysGrantPermissionChecker,
  PortalPageComponent,
  PermissionService,
  HAS_PERMISSION_CHECKER
} from '@onecx/angular-utils'

import { DialogService } from 'primeng/dynamicdialog'
import { TooltipModule } from 'primeng/tooltip'
import { InputTextModule } from 'primeng/inputtext'
import { SelectModule } from 'primeng/select'
import { FloatLabelModule } from 'primeng/floatlabel'

import { ChatSearchActions } from './chat-search.actions'
import { chatSearchColumns } from './chat-search.columns'
import { ChatSearchComponent } from './chat-search.component'
import { ChatSearchHarness } from './chat-search.harness'
import { initialState } from './chat-search.reducers'
import { selectChatSearchViewModel } from './chat-search.selectors'
import { ChatSearchViewModel } from './chat-search.viewmodel'

describe('ChatSearchComponent', () => {
  const origAddEventListener = window.addEventListener
  const origPostMessage = window.postMessage

  let listeners: any[] = []
  window.addEventListener = (_type: any, listener: any) => {
    listeners.push(listener)
  }

  window.removeEventListener = (_type: any, listener: any) => {
    listeners = listeners.filter((l) => l !== listener)
  }

  window.postMessage = (m: any) => {
    listeners.forEach((l) =>
      l({
        data: m,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        stopImmediatePropagation: () => {},
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        stopPropagation: () => {}
      })
    )
  }

  afterAll(() => {
    window.addEventListener = origAddEventListener
    window.postMessage = origPostMessage
  })

  HTMLCanvasElement.prototype.getContext = jest.fn()
  let component: ChatSearchComponent
  let fixture: ComponentFixture<ChatSearchComponent>
  let store: MockStore<Store>
  let formBuilder: FormBuilder

  const mockActivatedRoute = {
    snapshot: {
      data: {}
    }
  }
  const baseChatSearchViewModel: ChatSearchViewModel = {
    columns: chatSearchColumns,
    searchCriteria: { topic: '' },
    results: [],
    displayedColumns: [],
    viewMode: 'basic',
    chartVisible: false
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatSearchComponent,
        AngularAcceleratorModule,
        PortalPageComponent,
        TooltipModule,
        InputTextModule,
        SelectModule,
        FloatLabelModule,
        LetDirective,
        ReactiveFormsModule,
        StoreModule.forRoot({}),
        TranslateTestingModule.withTranslations({
          en: require('./src/assets/i18n/en.json'),
          de: require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en'),
        NoopAnimationsModule
      ],
      providers: [
        DialogService,
        PermissionService,
        provideAppStateServiceMock(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({
          initialState: { chat: { search: initialState } }
        }),
        FormBuilder,
        BreadcrumbService,
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        provideUserServiceMock(),
        {
          provide: HAS_PERMISSION_CHECKER,
          useClass: AlwaysGrantPermissionChecker
        }
      ]
    }).compileComponents()

    const mutationObserverMock = jest.fn(function MutationObserver(callback) {
      this.observe = jest.fn()
      this.disconnect = jest.fn()
      this.trigger = (mockedMutationsList: any) => {
        callback(mockedMutationsList, this)
      }
      return this
    })
    global.MutationObserver = mutationObserverMock
    global.origin = ''
  })

  beforeEach(async () => {
    const userService = TestBed.inject(UserService)
    userService.hasPermission = () => Promise.resolve(true)
    const translateService = TestBed.inject(TranslateService)
    translateService.use('en')
    formBuilder = TestBed.inject(FormBuilder)

    store = TestBed.inject(MockStore)
    store.overrideSelector(selectChatSearchViewModel, baseChatSearchViewModel)
    store.refreshState()

    fixture = TestBed.createComponent(ChatSearchComponent)
    component = fixture.componentInstance
    await TestbedHarnessEnvironment.harnessForFixture(fixture, ChatSearchHarness)
    fixture.detectChanges()
  })

  it('should create the component', () => {
    expect(component).toBeTruthy()
  })

  it('should dispatch resetButtonClicked action on resetSearch', async () => {
    const doneFn = jest.fn()
    store.overrideSelector(selectChatSearchViewModel, {
      ...baseChatSearchViewModel,
      results: [
        {
          id: '1',
          imagePath: '',
          column_1: 'val_1'
        }
      ],
      columns: [
        {
          columnType: ColumnType.STRING,
          nameKey: 'COLUMN_KEY',
          id: 'column_1'
        }
      ]
    })
    store.refreshState()

    store.scannedActions$.pipe(ofType(ChatSearchActions.resetButtonClicked)).subscribe(() => {
      doneFn()
    })

    component.resetSearch()
    expect(doneFn).toHaveBeenCalledTimes(1)
  })

  it('should generate 2 header actions when search config is disabled', async () => {
    store.overrideSelector(selectChatSearchViewModel, {
      ...baseChatSearchViewModel,
      columns: [
        {
          columnType: ColumnType.STRING,
          nameKey: 'COLUMN_KEY',
          id: 'column_1'
        }
      ],
      displayedColumns: [
        {
          columnType: ColumnType.STRING,
          nameKey: 'COLUMN_KEY',
          id: 'column_1'
        }
      ],
      results: [
        {
          id: '1',
          imagePath: '',
          column_1: 'val_1'
        }
      ],
      chartVisible: false
    })
    store.refreshState()
    fixture.detectChanges()
    await fixture.whenStable()

    const actions = component.headerActions$ ? await firstValueFrom(component.headerActions$) : []
    expect(actions).toHaveLength(2)
    expect(actions.some((a) => a.labelKey === 'CHAT_SEARCH.HEADER_ACTIONS.EXPORT_ALL')).toBeTruthy()
    expect(actions.some((a) => a.labelKey === 'CHAT_SEARCH.HEADER_ACTIONS.SHOW_CHART')).toBeTruthy()
  })

  it('should display hide chart action if chart is visible', async () => {
    const columns = [
      {
        columnType: ColumnType.STRING,
        nameKey: 'COLUMN_KEY',
        id: 'column_1'
      }
    ]
    store.overrideSelector(selectChatSearchViewModel, {
      ...baseChatSearchViewModel,
      columns,
      displayedColumns: columns,
      chartVisible: true,
      results: [
        {
          id: '1',
          imagePath: '',
          column_1: 'val_1'
        }
      ]
    })
    store.refreshState()
    fixture.detectChanges()
    await fixture.whenStable()

    const actions = component.headerActions$ ? await firstValueFrom(component.headerActions$) : []
    expect(actions).toHaveLength(2)
    expect(actions.some((a) => a.labelKey === 'CHAT_SEARCH.HEADER_ACTIONS.HIDE_CHART')).toBeTruthy()
  })

  it('should dispatch export csv data on export action click', async () => {
    jest.spyOn(store, 'dispatch')
    const columns = [
      {
        columnType: ColumnType.STRING,
        nameKey: 'COLUMN_KEY',
        id: 'column_1'
      }
    ]
    store.overrideSelector(selectChatSearchViewModel, {
      ...baseChatSearchViewModel,
      columns,
      displayedColumns: columns,
      results: [
        {
          id: '1',
          imagePath: '',
          column_1: 'val_1'
        }
      ],
      chartVisible: false
    })
    store.refreshState()
    fixture.detectChanges()
    await fixture.whenStable()

    const actions = component.headerActions$ ? await firstValueFrom(component.headerActions$) : []
    const exportAction = actions.find((a) => a.labelKey === 'CHAT_SEARCH.HEADER_ACTIONS.EXPORT_ALL')
    expect(exportAction).toBeTruthy()

    if (typeof (exportAction as any)?.actionCallback === 'function') {
      ;(exportAction as any).actionCallback()
    } else {
      throw new Error('Export action does not have a callable handler')
    }

    expect(store.dispatch).toHaveBeenCalledWith(ChatSearchActions.exportButtonClicked())
  })

  it('should display chosen column in the diagram', async () => {
    component.diagramColumnId = 'column_1'
    store.overrideSelector(selectChatSearchViewModel, {
      ...baseChatSearchViewModel,
      chartVisible: true,
      results: [
        { id: '1', imagePath: '', column_1: 'val_1' },
        { id: '2', imagePath: '', column_1: 'val_2' },
        { id: '3', imagePath: '', column_1: 'val_2' }
      ],
      columns: [{ columnType: ColumnType.STRING, nameKey: 'COLUMN_KEY', id: 'column_1' }]
    })
    store.refreshState()
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()

    const diagram = fixture.nativeElement.querySelector('ocx-group-by-count-diagram')
    expect(diagram).toBeTruthy()
  })

  it('should display correct breadcrumbs', () => {
    const breadcrumbService = fixture.debugElement.injector.get(BreadcrumbService)
    const spy = jest.spyOn(breadcrumbService, 'setItems')
    spy.mockClear()

    component.ngOnInit()
    fixture.detectChanges()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith([
      {
        titleKey: 'CHAT_SEARCH.BREADCRUMB',
        labelKey: 'CHAT_SEARCH.BREADCRUMB',
        routerLink: '/chat'
      }
    ])
  })

  it('should dispatch detailsButtonClicked action on details clicked', () => {
    jest.spyOn(store, 'dispatch')

    component.details({ id: '1', imagePath: '' })

    expect(store.dispatch).toHaveBeenCalledWith(ChatSearchActions.detailsButtonClicked({ id: '1' }))
  })

  it('should dispatch searchButtonClicked action on search', async () => {
    const doneFn = jest.fn()
    const sampleDate = new Date(2024, 5, 1, 10, 0, 0)
    const formValue = formBuilder.group({
      topic: '123',
      summary: sampleDate
    })
    component.chatSearchFormGroup = formValue

    component.search(component.chatSearchFormGroup)

    const searchCriteria = buildSearchCriteria(formValue.getRawValue(), new QueryList(), {
      removeNullValues: true
    })
    store.scannedActions$.pipe(ofType(ChatSearchActions.searchButtonClicked)).subscribe((a) => {
      expect(a.searchCriteria).toEqual(searchCriteria)
      doneFn()
    })
    expect(doneFn).toHaveBeenCalledTimes(1)
  })

  it('should dispatch viewModeChanged action on view mode changes', async () => {
    jest.spyOn(store, 'dispatch')

    component.viewModeChanged('advanced')

    expect(store.dispatch).toHaveBeenCalledWith(ChatSearchActions.viewModeChanged({ viewMode: 'advanced' }))
  })

  it('should dispatch displayedColumnsChanged on data view column change', () => {
    jest.spyOn(store, 'dispatch')

    component.onDisplayedColumnsChange(
      new CustomEvent('displayedColumnsChange', {
        detail: [
          { columnType: ColumnType.STRING, nameKey: 'COLUMN_KEY', id: 'column_1' },
          { columnType: ColumnType.STRING, nameKey: 'SECOND_COLUMN_KEY', id: 'column_2' }
        ]
      } as any)
    )

    expect(store.dispatch).toHaveBeenCalledWith(
      ChatSearchActions.displayedColumnsChanged({
        displayedColumns: [
          { columnType: ColumnType.STRING, nameKey: 'COLUMN_KEY', id: 'column_1' },
          { columnType: ColumnType.STRING, nameKey: 'SECOND_COLUMN_KEY', id: 'column_2' }
        ]
      })
    )
  })

  it('should dispatch chartVisibilityToggled on show/hide chart header', async () => {
    jest.spyOn(store, 'dispatch')
    const columns = [
      {
        columnType: ColumnType.STRING,
        nameKey: 'COLUMN_KEY',
        id: 'column_1'
      }
    ]
    store.overrideSelector(selectChatSearchViewModel, {
      ...baseChatSearchViewModel,
      columns,
      displayedColumns: columns,
      chartVisible: false,
      results: [
        {
          id: '1',
          imagePath: '',
          column_1: 'val_1'
        }
      ]
    })
    store.refreshState()
    fixture.detectChanges()
    await fixture.whenStable()

    const actions = component.headerActions$ ? await firstValueFrom(component.headerActions$) : []
    const showChartAction = actions.find((a) => a.labelKey === 'CHAT_SEARCH.HEADER_ACTIONS.SHOW_CHART')
    expect(showChartAction).toBeTruthy()

    if (typeof (showChartAction as any)?.actionCallback === 'function') {
      ;(showChartAction as any).actionCallback()
    } else {
      throw new Error('Show chart action does not have a callable handler')
    }

    expect(store.dispatch).toHaveBeenCalledWith(ChatSearchActions.chartVisibilityToggled())
  })

  it('should display translated headers', async () => {
    fixture.detectChanges()
    await fixture.whenStable()

    const pageContent = fixture.nativeElement.textContent
    expect(pageContent).toContain('Chat Search')
    expect(pageContent).toContain('Searching and displaying of Chat')
  })

  it('should display translated empty message when no search results', async () => {
    const columns = [{ columnType: ColumnType.STRING, nameKey: 'COLUMN_KEY', id: 'column_1' }]
    store.overrideSelector(selectChatSearchViewModel, {
      ...baseChatSearchViewModel,
      results: [],
      columns,
      displayedColumns: columns
    })
    store.refreshState()
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()

    const pageContent = fixture.nativeElement.textContent
    expect(pageContent).toContain('No results.')
  })

  it('should not display chart when no results or toggled to not visible', async () => {
    component.diagramColumnId = 'column_1'

    store.overrideSelector(selectChatSearchViewModel, {
      ...baseChatSearchViewModel,
      results: [],
      chartVisible: true,
      columns: [{ columnType: ColumnType.STRING, nameKey: 'COLUMN_KEY', id: 'column_1' }]
    })
    store.refreshState()
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
    expect(fixture.nativeElement.querySelector('ocx-group-by-count-diagram')).toBeNull()

    store.overrideSelector(selectChatSearchViewModel, {
      ...baseChatSearchViewModel,
      results: [{ id: '1', imagePath: '', column_1: 'val_1' }],
      chartVisible: false,
      columns: [{ columnType: ColumnType.STRING, nameKey: 'COLUMN_KEY', id: 'column_1' }]
    })
    store.refreshState()
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
    expect(fixture.nativeElement.querySelector('ocx-group-by-count-diagram')).toBeNull()

    store.overrideSelector(selectChatSearchViewModel, {
      ...baseChatSearchViewModel,
      results: [{ id: '1', imagePath: '', column_1: 'val_1' }],
      chartVisible: true,
      columns: [{ columnType: ColumnType.STRING, nameKey: 'COLUMN_KEY', id: 'column_1' }]
    })
    store.refreshState()
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
    expect(fixture.nativeElement.querySelector('ocx-group-by-count-diagram')).toBeTruthy()
  })
})
