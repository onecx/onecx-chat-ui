import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { LetDirective } from '@ngrx/component';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { TranslateTestingModule } from 'ngx-translate-testing';
import { PrimeIcons } from 'primeng/api';
import { of } from 'rxjs';
import {
  AlwaysGrantPermissionChecker,
  BreadcrumbService,
  HAS_PERMISSION_CHECKER,
  PortalCoreModule,
  UserService,
} from '@onecx/portal-integration-angular';
import { ChatDetailsComponent } from './chat-details.component';
import { initialState } from './chat-details.reducers';
import { ChatDetailsHarness } from './chat-details.harness';
import { ChatDetailsViewModel } from './chat-details.viewmodel';
import { selectChatDetailsViewModel } from './chat-details.selectors';
import { ChatDetailsActions } from './chat-details.actions';
import { ofType } from '@ngrx/effects';
import { provideUserServiceMock } from '@onecx/angular-integration-interface/mocks';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatType } from 'src/app/shared/generated';

describe('ChatDetailsComponent', () => {
  const origAddEventListener = window.addEventListener;
  const origPostMessage = window.postMessage;

  let listeners: any[] = [];
  window.addEventListener = (_type: any, listener: any) => {
    listeners.push(listener);
  };

  window.removeEventListener = (_type: any, listener: any) => {
    listeners = listeners.filter((l) => l !== listener);
  };

  window.postMessage = (m: any) => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    listeners.forEach((l) =>
      l({
        data: m,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        stopImmediatePropagation: () => { },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        stopPropagation: () => { },
      }),
    );
  };

  afterAll(() => {
    window.addEventListener = origAddEventListener;
    window.postMessage = origPostMessage;
  });

  let component: ChatDetailsComponent;
  let fixture: ComponentFixture<ChatDetailsComponent>;
  let store: MockStore<Store>;
  let breadcrumbService: BreadcrumbService;
  let chatDetails: ChatDetailsHarness;
  let translateService: TranslateService

  const mockActivatedRoute = {
    snapshot: {
      data: {},
    },
  };
  const baseChatDetailsViewModel: ChatDetailsViewModel = {
    details: {
      id: 'chat-1',
      topic: 'Support Inquiry',
      type: ChatType.AiChat
    },
    detailsLoadingIndicator: false,
    detailsLoaded: true,
    backNavigationPossible: true,
    messages: undefined,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChatDetailsComponent],
      imports: [
        PortalCoreModule,
        LetDirective,
        BrowserAnimationsModule,
        TranslateTestingModule.withTranslations(
          'en',
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('./../../../../assets/i18n/en.json'),
        ).withTranslations('de',
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('./../../../../assets/i18n/de.json')),
      ],
      providers: [
        provideHttpClientTesting(),
        provideMockStore({
          initialState: { chat: { details: initialState } },
        }),
        BreadcrumbService,
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        provideUserServiceMock(),
        {
          provide: HAS_PERMISSION_CHECKER,
          useClass: AlwaysGrantPermissionChecker
        },
      ],
    }).compileComponents();

    // Mock MutationObserver
    const mutationObserverMock = jest.fn(function MutationObserver(callback) {
      this.observe = jest.fn();
      this.disconnect = jest.fn();
      this.trigger = (mockedMutationsList: any) => {
        callback(mockedMutationsList, this);
      };
      return this;
    });
    global.MutationObserver = mutationObserverMock as any;

    const userService = TestBed.inject(UserService);
    userService.permissions$.next([
      'CHAT#CREATE',
      'CHAT#EDIT',
      'CHAT#DELETE',
      'CHAT#IMPORT',
      'CHAT#EXPORT',
      'CHAT#VIEW',
      'CHAT#SEARCH',
      'CHAT#BACK',
    ]);

    translateService = TestBed.inject(TranslateService);
    translateService.use('en');

    store = TestBed.inject(MockStore);
    store.overrideSelector(
      selectChatDetailsViewModel,
      baseChatDetailsViewModel,
    );
    store.refreshState();

    fixture = TestBed.createComponent(ChatDetailsComponent);
    component = fixture.componentInstance;
    breadcrumbService = TestBed.inject(BreadcrumbService);
    fixture.detectChanges();
    chatDetails = await TestbedHarnessEnvironment.harnessForFixture(
      fixture,
      ChatDetailsHarness,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display correct breadcrumbs', async () => {
    jest.spyOn(breadcrumbService, 'setItems');

    component.ngOnInit();
    fixture.detectChanges();

    expect(breadcrumbService.setItems).toHaveBeenCalledTimes(2);
    const pageHeader = await chatDetails.getHeader();
    const searchBreadcrumbItem = await pageHeader.getBreadcrumbItem('Search');
    expect(await searchBreadcrumbItem!.getText()).toEqual('Search');
    const detailsBreadcrumbItem = await pageHeader.getBreadcrumbItem('Details');
    expect(await detailsBreadcrumbItem!.getText()).toEqual('Details');
  });

  it('should display translated headers', async () => {
    const pageHeader = await chatDetails.getHeader();
    expect(await pageHeader.getHeaderText()).toEqual('Chat Details');
    expect(await pageHeader.getSubheaderText()).toEqual(
      'Display of Chat Details',
    );
  });

  it('should have 2 inline actions', async () => {
    const pageHeader = await chatDetails.getHeader();
    const inlineActions = await pageHeader.getInlineActionButtons();
    expect(inlineActions.length).toBe(1);

    const backAction = await pageHeader.getInlineActionButtonByLabel('Back');
    expect(backAction).toBeTruthy();
  });

  it('should dispatch navigateBackButtonClicked action on back button click', async () => {
    jest.spyOn(window.history, 'back');
    const doneFn = jest.fn();

    const pageHeader = await chatDetails.getHeader();
    const backAction = await pageHeader.getInlineActionButtonByLabel('Back');
    store.scannedActions$
      .pipe(ofType(ChatDetailsActions.navigateBackButtonClicked))
      .subscribe(() => {
        doneFn();
      });
    await backAction?.click();
    expect(doneFn).toHaveBeenCalledTimes(1);
  });

  it('should have overflow menu button', async () => {
    const pageHeader = await chatDetails.getHeader()
    const overflowAction = await pageHeader.getOverflowActionMenuButton()
    expect(overflowAction).toBeTruthy()
  })

  it('delete clicked should dispatch delete action', async () => {
    jest.spyOn(store, 'dispatch')
    const pageHeader = await chatDetails.getHeader()
    const overflowMenuButton = await pageHeader.getOverflowActionMenuButton()
    expect(overflowMenuButton).toBeDefined()
    await overflowMenuButton?.click()

    const overflowMenuItem = await pageHeader.getOverFlowMenuItem('Delete')
    await overflowMenuItem!.selectItem()

    expect(store.dispatch).toHaveBeenCalledWith(ChatDetailsActions.deleteButtonClicked())
  })


  it('should display item details in page header', async () => {
    component.headerLabels$ = of([
      {
        label: 'HELLO_DETAILS.FORM.ID',
        labelPipe: TranslatePipe,
        value: 'test id',
      },
      {
        label: 'first',
        value: 'first value',
      },
      {
        label: 'second',
        value: 'second value',
      },
      {
        label: 'third',
        icon: PrimeIcons.PLUS,
      },
      {
        label: 'fourth',
        value: 'fourth value',
        icon: PrimeIcons.QUESTION,
      },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const pageHeader = await chatDetails.getHeader();
    const objectDetails = await pageHeader.getObjectInfos();
    expect(objectDetails.length).toBe(5);

    const testDetailItem = await pageHeader.getObjectInfoByLabel(
      'HELLO_DETAILS.FORM.ID',
    );
    expect(await testDetailItem?.getLabel()).toEqual('HELLO_DETAILS.FORM.ID');
    expect(await testDetailItem?.getValue()).toEqual('test id');
    expect(await testDetailItem?.getIcon()).toBeUndefined();

    const firstDetailItem = await pageHeader.getObjectInfoByLabel('first');
    expect(await firstDetailItem?.getLabel()).toEqual('first');
    expect(await firstDetailItem?.getValue()).toEqual('first value');
    expect(await firstDetailItem?.getIcon()).toBeUndefined();

    const secondDetailItem = await pageHeader.getObjectInfoByLabel('second');
    expect(await secondDetailItem?.getLabel()).toEqual('second');
    expect(await secondDetailItem?.getValue()).toEqual('second value');
    expect(await secondDetailItem?.getIcon()).toBeUndefined();

    const thirdDetailItem = await pageHeader.getObjectInfoByLabel('third');
    expect(await thirdDetailItem?.getLabel()).toEqual('third');
    expect(await thirdDetailItem?.getValue()).toEqual('');
    expect(await thirdDetailItem?.getIcon()).toContain(PrimeIcons.PLUS);

    const fourthDetailItem = await pageHeader.getObjectInfoByLabel('fourth');
    expect(await fourthDetailItem?.getLabel()).toEqual('fourth');
    expect(await fourthDetailItem?.getValue()).toEqual('fourth value');
    expect(await fourthDetailItem?.getIcon()).toContain(PrimeIcons.QUESTION);
  });

  it('should work with details', async () => {
    store.overrideSelector(selectChatDetailsViewModel, {
      ...baseChatDetailsViewModel,
      details: {
        id: "my-id",
        topic: "my-topic",
        type: ChatType.AiChat,
      }
    })
    store.refreshState()
    fixture.detectChanges()

    const pageHeader = await chatDetails.getHeader()
    const translatedLabel = translateService.instant('CHAT_DETAILS.FORM.TOPIC')
    const idDetailItem = await pageHeader.getObjectInfoByLabel(translatedLabel)
    expect(await idDetailItem?.getValue()).toEqual('my-topic')
  })

  it('handles missing details (covers optional chaining)', async () => {
    store.overrideSelector(selectChatDetailsViewModel, {
      ...baseChatDetailsViewModel,
      details: undefined
    } as any)
    store.refreshState()
    fixture.detectChanges()

    const pageHeader = await chatDetails.getHeader()
    const translatedLabel = translateService.instant('CHAT_DETAILS.FORM.TOPIC')
    const idDetailItem = await pageHeader.getObjectInfoByLabel(translatedLabel)
    expect(await idDetailItem?.getValue()).toBeFalsy()
  })
});
