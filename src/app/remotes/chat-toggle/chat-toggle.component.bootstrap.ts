import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { importProvidersFrom, inject, provideAppInitializer } from '@angular/core'
import { provideAnimations } from '@angular/platform-browser/animations'
import { provideRouter } from '@angular/router'
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
import { AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { UserService } from '@onecx/angular-integration-interface'

import { environment } from 'src/environments/environment'
import { OneCXChatToggleComponent } from './chat-toggle.component'

bootstrapRemoteComponent(
  OneCXChatToggleComponent,
  'ocx-chat-toggle-component',
  environment.production,
  [
    provideHttpClient(withInterceptorsFromDi()),
    { provide: REMOTE_COMPONENT_CONFIG, useValue: new ReplaySubject<RemoteComponentConfig>(1) },
    provideThemeConfig(),
    provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
    provideTranslateService({
      fallbackLang: 'en',
      loader: provideTranslateLoader(OnecxTranslateLoader),
      missingTranslationHandler: provideMissingTranslationHandler(MultiLanguageMissingTranslationHandler)
    }),
    importProvidersFrom(AngularAcceleratorModule, AngularAuthModule),
    provideAnimations(),
    provideRouter([
      {
        path: '**',
        children: []
      }
    ]),
    provideAppInitializer(() => inject(UserService).isInitialized)
  ],
  { usePortalLayoutStyles: false }
).catch((err) => console.error(err))
