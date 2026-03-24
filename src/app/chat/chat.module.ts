import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LetDirective } from '@ngrx/component';
import { EffectsModule } from '@ngrx/effects';
import { AngularAcceleratorModule, providePortalDialogService } from '@onecx/angular-accelerator';
import { PortalPageComponent, provideTranslationConnectionService } from '@onecx/angular-utils';
import { ChatDetailsComponent } from './pages/chat-details/chat-details.component';
import { ChatDetailsEffects } from './pages/chat-details/chat-details.effects';

import { StoreModule } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { DropdownModule } from 'primeng/dropdown';
import { SharedModule } from '../shared/shared.module';
import { chatFeature } from './chat.reducers';
import { routes } from './chat.routes';
import { ChatAssistantComponent } from './pages/chat-assistant/chat-assistant.component';
import { ChatAssistantEffects } from './pages/chat-assistant/chat-assistant.effects';
import { ChatSearchComponent } from './pages/chat-search/chat-search.component';
import { ChatSearchEffects } from './pages/chat-search/chat-search.effects';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';

@NgModule({
  declarations: [ChatDetailsComponent, ChatSearchComponent],
  imports: [
    CommonModule,
    SharedModule,
    LetDirective,
    AngularAcceleratorModule,
    PortalPageComponent,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    DatePickerModule,
    StoreModule.forFeature(chatFeature),
    EffectsModule.forFeature([ChatDetailsEffects, ChatSearchEffects, ChatAssistantEffects]),
    TranslateModule,
    DrawerModule,
    AvatarModule,
    DropdownModule,
    InputTextModule,
    TooltipModule,
    ChatAssistantComponent,
  ],
  providers: [
    providePortalDialogService(),
    provideTranslationConnectionService(),
  ],
})
export class ChatModule { }