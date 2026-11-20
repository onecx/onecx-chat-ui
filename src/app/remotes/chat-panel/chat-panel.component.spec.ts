import { ComponentFixture, TestBed } from '@angular/core/testing'
import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'
import { provideMockStore } from '@ngrx/store/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { ReplaySubject, BehaviorSubject } from 'rxjs'

import { UserService } from '@onecx/angular-integration-interface'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'
import { SlotService } from '@onecx/angular-remote-components'

import { ChatInternalService } from 'src/app/shared/services/chat-internal.service'
import { VoiceConfigService } from 'src/app/shared/services/voice-config.service'
import { initialState } from 'src/app/chat/pages/chat-assistant/chat-assistant.reducers'
import { OneCXChatPanelComponent, slotInitializer } from './chat-panel.component'

describe('OneCXChatPanelComponent', () => {
  let component: OneCXChatPanelComponent
  let fixture: ComponentFixture<OneCXChatPanelComponent>
  let rcConfig: ReplaySubject<RemoteComponentConfig>

  const defaultConfig: RemoteComponentConfig = {
    productName: 'chatProduct',
    appId: 'chatApp',
    baseUrl: 'https://api.example.com',
    permissions: ['CHAT#VIEW', 'CHAT#EDIT']
  }

  beforeEach(async () => {
    rcConfig = new ReplaySubject<RemoteComponentConfig>(1)

    await TestBed.configureTestingModule({
      imports: [
        OneCXChatPanelComponent,
        NoopAnimationsModule,
        TranslateTestingModule.withTranslations('en', {}).withTranslations('de', {})
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({
          initialState: { chat: { assistant: initialState } }
        }),
        { provide: REMOTE_COMPONENT_CONFIG, useValue: rcConfig },
        { provide: ChatInternalService, useValue: { overwriteBaseURL: jest.fn() } },
        { provide: UserService, useValue: { lang$: new BehaviorSubject<string>('en') } }
      ]
    }).compileComponents()
  })

  function setUp() {
    fixture = TestBed.createComponent(OneCXChatPanelComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  }

  describe('creation', () => {
    it('should create the component', () => {
      setUp()
      expect(component).toBeTruthy()
    })

    it('should render the inline chat assistant', () => {
      setUp()

      expect(fixture.nativeElement.querySelector('app-chat-assistant .chat-panel')).not.toBeNull()
    })

    it('should render the panel collapsed until it is opened', () => {
      setUp()

      expect(fixture.nativeElement.querySelector('.chat-panel-open')).toBeNull()
    })

    it('should constrain overflow at the remote component host', () => {
      setUp()

      const hostStyles = fixture.nativeElement.style

      expect(hostStyles.display).toBe('block')
      expect(hostStyles.flex).toBe('0 0 auto')
      expect(hostStyles.overflow).toBe('hidden')
      expect(hostStyles.minHeight).toBe('0')
    })
  })

  describe('height', () => {
    it('should fill the viewport below the top edge of the host', () => {
      setUp()
      jest.spyOn(fixture.nativeElement, 'getBoundingClientRect').mockReturnValue({ top: 64 } as DOMRect)
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

      window.dispatchEvent(new Event('resize'))

      expect(fixture.nativeElement.style.height).toBe('736px')
    })
  })

  describe('ocxInitRemoteComponent', () => {
    it('should emit config on remoteComponentConfig subject', () => {
      setUp()
      const nextSpy = jest.spyOn(rcConfig, 'next')

      component.ocxInitRemoteComponent(defaultConfig)

      expect(nextSpy).toHaveBeenCalledWith(defaultConfig)
    })

    it('should read the voice settings from the base URL of the remote component', () => {
      setUp()
      const init = jest.spyOn(TestBed.inject(VoiceConfigService), 'init').mockResolvedValue()

      component.ocxInitRemoteComponent(defaultConfig)

      expect(init).toHaveBeenCalledWith('https://api.example.com')
    })
  })

  describe('ocxRemoteComponentConfig @Input setter', () => {
    it('should delegate to ocxInitRemoteComponent when input is set', () => {
      setUp()
      const spy = jest.spyOn(component, 'ocxInitRemoteComponent')

      component.ocxRemoteComponentConfig = defaultConfig

      expect(spy).toHaveBeenCalledWith(defaultConfig)
    })
  })

  describe('slotInitializer', () => {
    it('should call slotService.init() when returned function is invoked', () => {
      const mockSlotService: Partial<SlotService> = { init: jest.fn() }

      const initializer = slotInitializer(mockSlotService as SlotService)
      initializer()

      expect(mockSlotService.init).toHaveBeenCalled()
    })
  })
})
