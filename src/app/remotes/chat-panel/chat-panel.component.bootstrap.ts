import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { importProvidersFrom, inject, provideAppInitializer } from '@angular/core'
import { provideAnimations } from '@angular/platform-browser/animations'
import { provideRouter } from '@angular/router'
import { EffectsModule } from '@ngrx/effects'
import { StoreRouterConnectingModule } from '@ngrx/router-store'
import { StoreModule } from '@ngrx/store'
import { StoreDevtoolsModule } from '@ngrx/store-devtools'
import { provideMissingTranslationHandler, provideTranslateLoader, provideTranslateService } from '@ngx-translate/core'
import { ReplaySubject } from 'rxjs'

import { AngularAuthModule } from '@onecx/angular-auth'
import {
  MultiLanguageMissingTranslationHandler,
  OnecxTranslateLoader,
  REMOTE_COMPONENT_CONFIG,
  RemoteComponentConfig,
  provideTranslationPathFromMeta
} from '@onecx/angular-utils'
import { provideThemeConfig } from '@onecx/angular-utils/theme/primeng'
import { bootstrapRemoteComponent } from '@onecx/angular-webcomponents'
import { AngularAcceleratorModule, providePortalDialogService } from '@onecx/angular-accelerator'
import { UserService } from '@onecx/angular-integration-interface'

import { chatAssistantFeature } from 'src/app/chat/chat.reducers'
import { ChatAssistantEffects } from 'src/app/chat/pages/chat-assistant/chat-assistant.effects'
import { ChatInternalService } from 'src/app/shared/services/chat-internal.service'
import { environment } from 'src/environments/environment'
import { OneCXChatPanelComponent } from './chat-panel.component'

function userProfileInitializer(userService: UserService) {
  return async () => {
    await userService.isInitialized
  }
}

bootstrapRemoteComponent(
  OneCXChatPanelComponent,
  'ocx-chat-panel-component',
  environment.production,
  [
    provideHttpClient(withInterceptorsFromDi()),
    { provide: REMOTE_COMPONENT_CONFIG, useValue: new ReplaySubject<RemoteComponentConfig>(1) },
    providePortalDialogService(),
    provideThemeConfig(),
    provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
    provideTranslateService({
      fallbackLang: 'en',
      loader: provideTranslateLoader(OnecxTranslateLoader),
      missingTranslationHandler: provideMissingTranslationHandler(MultiLanguageMissingTranslationHandler)
    }),
    importProvidersFrom(
      AngularAcceleratorModule,
      AngularAuthModule,
      StoreRouterConnectingModule.forRoot(),
      StoreModule.forRoot({}),
      StoreModule.forFeature(chatAssistantFeature),
      StoreDevtoolsModule.instrument(),
      EffectsModule.forRoot([]),
      EffectsModule.forFeature([ChatAssistantEffects])
    ),
    provideAnimations(),
    provideRouter([
      {
        path: '**',
        children: []
      }
    ]),
    provideAppInitializer(() => {
      const initializerFn = userProfileInitializer(inject(UserService))
      return initializerFn()
    }),
    ChatInternalService
  ],
  { usePortalLayoutStyles: false }
).catch((err) => console.error(err))
