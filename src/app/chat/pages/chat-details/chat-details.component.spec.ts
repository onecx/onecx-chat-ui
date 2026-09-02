import { ComponentFixture, TestBed } from '@angular/core/testing'
import { ActivatedRoute } from '@angular/router'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { LetDirective } from '@ngrx/component'
import { ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { MockStore, provideMockStore } from '@ngrx/store/testing'
import { TranslateService, TranslatePipe } from '@ngx-translate/core'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { of, firstValueFrom } from 'rxjs'

import { PrimeIcons } from 'primeng/api'

import { BreadcrumbService, AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { UserService } from '@onecx/angular-integration-interface'
import {
  AlwaysGrantPermissionChecker,
  HAS_PERMISSION_CHECKER,
  PortalPageComponent,
  PermissionService
} from '@onecx/angular-utils'
import { provideAppStateServiceMock, provideUserServiceMock } from '@onecx/angular-integration-interface/mocks'

import { ChatType, Message, MessageType } from 'src/app/shared/generated'
import { ChatDetailsComponent } from './chat-details.component'
import { initialState } from './chat-details.reducers'
import { ChatDetailsHarness } from './chat-details.harness'
import { ChatDetailsViewModel } from './chat-details.viewmodel'
import { selectChatDetailsViewModel } from './chat-details.selectors'
import { ChatDetailsActions } from './chat-details.actions'

describe('ChatDetailsComponent', () => {
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
    // eslint-disable-next-line @typescript-eslint/no-empty-function
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

  let component: ChatDetailsComponent
  let fixture: ComponentFixture<ChatDetailsComponent>
  let store: MockStore<Store>
  let breadcrumbService: BreadcrumbService
  let chatDetails: ChatDetailsHarness
  let translateService: TranslateService

  const mockActivatedRoute = {
    snapshot: {
      data: {}
    }
  }
  const baseChatDetailsViewModel: ChatDetailsViewModel = {
    details: {
      id: 'chat-1',
      topic: 'Support Inquiry',
      type: ChatType.AiChat
    },
    detailsLoadingIndicator: false,
    detailsLoaded: true,
    backNavigationPossible: true,
    messages: undefined
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatDetailsComponent,
        AngularAcceleratorModule,
        PortalPageComponent,
        LetDirective,
        BrowserAnimationsModule,
        TranslateTestingModule.withTranslations({
          en: require('./src/assets/i18n/en.json'),
          de: require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        provideHttpClientTesting(),
        provideMockStore({
          initialState: { chat: { details: initialState } }
        }),
        BreadcrumbService,
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        provideUserServiceMock(),
        provideAppStateServiceMock(),
        {
          provide: HAS_PERMISSION_CHECKER,
          useClass: AlwaysGrantPermissionChecker
        },
        PermissionService
      ]
    }).compileComponents()

    // Mock MutationObserver
    const mutationObserverMock = jest.fn(function MutationObserver(callback) {
      this.observe = jest.fn()
      this.disconnect = jest.fn()
      this.trigger = (mockedMutationsList: any) => {
        callback(mockedMutationsList, this)
      }
      return this
    })
    global.MutationObserver = mutationObserverMock as any
  })

  beforeEach(async () => {
    const userService = TestBed.inject(UserService)
    userService.getPermissions = () =>
      of([
        'CHAT#CREATE',
        'CHAT#EDIT',
        'CHAT#DELETE',
        'CHAT#IMPORT',
        'CHAT#EXPORT',
        'CHAT#VIEW',
        'CHAT#SEARCH',
        'CHAT#BACK'
      ])

    translateService = TestBed.inject(TranslateService)
    translateService.use('en')

    store = TestBed.inject(MockStore)
    store.overrideSelector(selectChatDetailsViewModel, baseChatDetailsViewModel)
    store.refreshState()

    fixture = TestBed.createComponent(ChatDetailsComponent)
    component = fixture.componentInstance
    breadcrumbService = fixture.debugElement.injector.get(BreadcrumbService)
    fixture.detectChanges()
    chatDetails = await TestbedHarnessEnvironment.harnessForFixture(fixture, ChatDetailsHarness)
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should display correct breadcrumbs', () => {
    const spy = jest.spyOn(breadcrumbService, 'setItems')
    spy.mockClear()

    component.ngOnInit()
    fixture.detectChanges()

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenCalledWith([
      { titleKey: 'CHAT_SEARCH.BREADCRUMB', labelKey: 'CHAT_SEARCH.BREADCRUMB', routerLink: '../../' }
    ])
    expect(spy).toHaveBeenCalledWith([
      { titleKey: 'CHAT_SEARCH.BREADCRUMB', labelKey: 'CHAT_SEARCH.BREADCRUMB', routerLink: '../../' },
      { titleKey: 'CHAT_DETAILS.BREADCRUMB', labelKey: 'CHAT_DETAILS.BREADCRUMB', routerLink: './' }
    ])
  })

  it('should display translated headers', async () => {
    const pageHeader = await chatDetails.getHeader()
    expect(await pageHeader.getHeaderText()).toEqual('Chat Details')
    expect(await pageHeader.getSubheaderText()).toEqual('Display of Chat Details')
  })

  it('should have 2 inline actions', async () => {
    const actions = await firstValueFrom(component.headerActions$)
    const inlineActions = actions.filter((a) => a.show === 'always')
    expect(inlineActions).toHaveLength(1)

    const backAction = inlineActions.find((a) => a.labelKey === 'CHAT_DETAILS.GENERAL.BACK')
    expect(backAction).toBeTruthy()
  })

  it('should dispatch navigateBackButtonClicked action on back button click', async () => {
    const doneFn = jest.fn()
    const actions = await firstValueFrom(component.headerActions$)
    const backAction = actions.find((a) => a.labelKey === 'CHAT_DETAILS.GENERAL.BACK')

    store.scannedActions$.pipe(ofType(ChatDetailsActions.navigateBackButtonClicked)).subscribe(() => {
      doneFn()
    })
    backAction?.actionCallback?.()
    expect(doneFn).toHaveBeenCalledTimes(1)
  })

  it('should have overflow menu button', async () => {
    const pageHeader = await chatDetails.getHeader()
    const overflowAction = await pageHeader.getOverflowActionMenuButton()
    expect(overflowAction).toBeTruthy()
  })

  it('delete clicked should dispatch delete action', () => {
    jest.spyOn(store, 'dispatch')

    component.delete()

    expect(store.dispatch).toHaveBeenCalledWith(ChatDetailsActions.deleteButtonClicked())
  })

  it('should display item details in page header', async () => {
    const labels = [
      { label: 'HELLO_DETAILS.FORM.ID', labelPipe: TranslatePipe, value: 'test id' },
      { label: 'first', value: 'first value' },
      { label: 'second', value: 'second value' },
      { label: 'third', icon: PrimeIcons.PLUS },
      { label: 'fourth', value: 'fourth value', icon: PrimeIcons.QUESTION }
    ] as any[]
    component.headerLabels$ = of(labels)

    const emittedLabels = await firstValueFrom(component.headerLabels$)
    expect(emittedLabels).toHaveLength(5)

    const testDetailItem = emittedLabels.find((l) => l.label === 'HELLO_DETAILS.FORM.ID')
    expect(testDetailItem?.value).toEqual('test id')

    const firstDetailItem = emittedLabels.find((l) => l.label === 'first')
    expect(firstDetailItem?.value).toEqual('first value')

    const secondDetailItem = emittedLabels.find((l) => l.label === 'second')
    expect(secondDetailItem?.value).toEqual('second value')

    const thirdDetailItem = emittedLabels.find((l) => l.label === 'third')
    expect(thirdDetailItem?.value).toBeFalsy()
    expect(thirdDetailItem?.icon).toContain(PrimeIcons.PLUS)

    const fourthDetailItem = emittedLabels.find((l) => l.label === 'fourth')
    expect(fourthDetailItem?.value).toEqual('fourth value')
    expect(fourthDetailItem?.icon).toContain(PrimeIcons.QUESTION)
  })

  it('should work with details', async () => {
    store.overrideSelector(selectChatDetailsViewModel, {
      ...baseChatDetailsViewModel,
      details: {
        id: 'my-id',
        topic: 'my-topic',
        type: ChatType.AiChat
      }
    })
    store.refreshState()
    fixture.detectChanges()

    const labels = await firstValueFrom(component.headerLabels$)
    const topicItem = labels.find((l) => l.label === 'CHAT_DETAILS.FORM.TOPIC')
    expect(topicItem?.value).toEqual('my-topic')
  })

  it('handles missing details (covers optional chaining)', async () => {
    store.overrideSelector(selectChatDetailsViewModel, {
      ...baseChatDetailsViewModel,
      details: undefined
    } as any)
    store.refreshState()
    fixture.detectChanges()

    const labels = await firstValueFrom(component.headerLabels$)
    const topicItem = labels.find((l) => l.label === 'CHAT_DETAILS.FORM.TOPIC')
    expect(topicItem?.value).toBeFalsy()
  })

  describe('userName method', () => {
    it('should return translated ASSISTANT for Assistant message type', async () => {
      const message: Message = {
        type: MessageType.Assistant,
        userId: 'assistant-id'
      }

      const result = await component.userName(message)
      expect(result).toEqual('Assistant')
    })

    it('should return translated SYSTEM for System message type', async () => {
      const message: Message = {
        type: MessageType.System,
        userId: 'system-id'
      }

      const result = await component.userName(message)
      expect(result).toEqual('System')
    })

    it('should return participant name for Human message type when participant found', async () => {
      store.overrideSelector(selectChatDetailsViewModel, {
        ...baseChatDetailsViewModel,
        details: {
          id: baseChatDetailsViewModel.details?.id ?? 'chat-1',
          topic: baseChatDetailsViewModel.details?.topic ?? 'Support Inquiry',
          type: baseChatDetailsViewModel.details?.type ?? ChatType.AiChat,
          participants: [{ userId: 'user1', userName: 'John Doe', type: 'USER' as any }]
        }
      })
      store.refreshState()
      fixture.detectChanges()

      const message: Message = {
        type: MessageType.Human,
        userId: 'user1'
      }

      const result = await component.userName(message)
      expect(result).toBe('John Doe')
    })

    it('should return UNKNOWN when vm.details is undefined (covers vm.details?.participants)', async () => {
      store.overrideSelector(selectChatDetailsViewModel, {
        ...baseChatDetailsViewModel,
        details: undefined
      } as any)
      store.refreshState()
      fixture.detectChanges()

      const message: Message = {
        type: MessageType.Human,
        userId: 'user1'
      }

      const result = await component.userName(message)
      expect(result).toEqual('Unknown')
    })
  })
})
