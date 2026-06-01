import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { isDevMode, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { LetDirective } from '@ngrx/component';
import { EffectsModule } from '@ngrx/effects';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import {
  TranslateLoader,
  TranslateModule,
} from '@ngx-translate/core';
import { AngularAuthModule } from '@onecx/angular-auth';
import {
  AngularAcceleratorModule,
  providePortalDialogService,
} from '@onecx/angular-accelerator';
import {
  AppStateService,
  APP_CONFIG,
  PortalMessageService,
  ConfigurationService,
} from '@onecx/angular-integration-interface';
import {
  createTranslateLoader,
  provideThemeConfig,
  provideTranslationPathFromMeta,
} from '@onecx/angular-utils';
import { environment } from 'src/environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { metaReducers, reducers } from './app.reducers';
import { Configuration } from 'src/app/shared/generated';
import { apiConfigProvider } from './shared/utils/apiConfigProvider.utils';

export const commonImports = [CommonModule];

@NgModule({
  declarations: [],
  imports: [
    ...commonImports,
    AngularAuthModule,
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    AppComponent,
    LetDirective,
    StoreRouterConnectingModule.forRoot(),
    StoreModule.forRoot(reducers, { metaReducers }),
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true,
      trace: false,
      traceLimit: 75,
    }),
    EffectsModule.forRoot([]),
    HttpClientModule,
    AngularAcceleratorModule,
    TranslateModule.forRoot({
      extend: true,
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient, AppStateService],
      },
    }),
  ],
  providers: [
    PortalMessageService,
    providePortalDialogService(),
    provideThemeConfig(),
    { provide: APP_CONFIG, useValue: environment },
    {
      provide: Configuration,
      useFactory: apiConfigProvider,
      deps: [ConfigurationService, AppStateService],
    },
    provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
  ],
})
export class AppModule {}
