import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateTestingModule } from 'ngx-translate-testing';
import { provideMockStore } from '@ngrx/store/testing';
import { ReplaySubject, BehaviorSubject } from 'rxjs';
import { UserService } from '@onecx/angular-integration-interface';
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils';
import { SlotService } from '@onecx/angular-remote-components';
import { ChatInternalService } from 'src/app/shared/services/chat-internal.service';
import { initialState } from 'src/app/chat/pages/chat-assistant/chat-assistant.reducers';
import { OneCXChatPanelComponent, slotInitializer } from './chat-panel.component';

describe('OneCXChatPanelComponent', () => {
  let component: OneCXChatPanelComponent;
  let fixture: ComponentFixture<OneCXChatPanelComponent>;
  let rcConfig: ReplaySubject<RemoteComponentConfig>;

  const defaultConfig: RemoteComponentConfig = {
    productName: 'chatProduct',
    appId: 'chatApp',
    baseUrl: 'https://api.example.com',
    permissions: ['CHAT#VIEW', 'CHAT#EDIT'],
  };

  beforeEach(waitForAsync(() => {
    rcConfig = new ReplaySubject<RemoteComponentConfig>(1);

    TestBed.configureTestingModule({
      imports: [
        OneCXChatPanelComponent,
        NoopAnimationsModule,
        TranslateTestingModule.withTranslations('en', {}).withTranslations('de', {}),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({
          initialState: { chat: { assistant: initialState } },
        }),
        { provide: REMOTE_COMPONENT_CONFIG, useValue: rcConfig },
        { provide: ChatInternalService, useValue: { overwriteBaseURL: jest.fn() } },
        { provide: UserService, useValue: { lang$: new BehaviorSubject<string>('en') } },
      ],
    }).compileComponents();
  }));

  function setUp() {
    fixture = TestBed.createComponent(OneCXChatPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('creation', () => {
    it('should create the component', () => {
      setUp();
      expect(component).toBeTruthy();
    });
  });

  describe('ocxInitRemoteComponent', () => {
    it('should emit config on remoteComponentConfig subject', () => {
      setUp();
      const nextSpy = jest.spyOn(rcConfig, 'next');

      component.ocxInitRemoteComponent(defaultConfig);

      expect(nextSpy).toHaveBeenCalledWith(defaultConfig);
    });
  });

  describe('ocxRemoteComponentConfig @Input setter', () => {
    it('should delegate to ocxInitRemoteComponent when input is set', () => {
      setUp();
      const spy = jest.spyOn(component, 'ocxInitRemoteComponent');

      component.ocxRemoteComponentConfig = defaultConfig;

      expect(spy).toHaveBeenCalledWith(defaultConfig);
    });
  });

  describe('slotInitializer', () => {
    it('should call slotService.init() when returned function is invoked', () => {
      const mockSlotService: Partial<SlotService> = { init: jest.fn() };
  
      const initializer = slotInitializer(mockSlotService as SlotService);
      initializer();
  
      expect(mockSlotService.init).toHaveBeenCalled();
    });
  });
});
