import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LetDirective } from '@ngrx/component';
import { EffectsModule } from '@ngrx/effects';
import { AngularAcceleratorModule, providePortalDialogService } from '@onecx/angular-accelerator';
import { PortalPageComponent } from '@onecx/angular-utils';
import { ChatDetailsComponent } from './pages/chat-details/chat-details.component';
import { ChatDetailsEffects } from './pages/chat-details/chat-details.effects';
import { StoreModule } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { SelectModule } from 'primeng/select';
import { SharedModule } from 'src/app/shared/shared.module';
import { chatFeature } from './chat.reducers';
import { routes } from './chat.routes';
import { ChatAssistantComponent } from './pages/chat-assistant/chat-assistant.component';
import { ChatAssistantEffects } from './pages/chat-assistant/chat-assistant.effects';
import { ChatSearchComponent } from './pages/chat-search/chat-search.component';
import { ChatSearchEffects } from './pages/chat-search/chat-search.effects';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';

@NgModule({
  declarations: [],
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
    SelectModule,
    InputTextModule,
    FloatLabelModule,
    TooltipModule,
    ChatAssistantComponent,
    ChatDetailsComponent,
    ChatSearchComponent,
  ],
  providers: [
    providePortalDialogService(),
  ],
})
export class ChatModule { }