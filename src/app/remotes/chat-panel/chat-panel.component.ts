import { CommonModule } from '@angular/common';
import { APP_INITIALIZER, Component, Inject, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AngularAuthModule } from '@onecx/angular-auth';
import {
  PortalMessageService,
  UserService,
} from '@onecx/angular-integration-interface';
import {
  AngularRemoteComponentsModule,
  BASE_URL,
  ocxRemoteComponent,
  ocxRemoteWebcomponent,
  RemoteComponentConfig,
  SLOT_SERVICE,
  SlotService,
} from '@onecx/angular-remote-components';
import {
  PortalCoreModule
} from '@onecx/portal-integration-angular';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';
import { ReplaySubject } from 'rxjs';
import { ChatAssistantComponent } from 'src/app/chat/pages/chat-assistant/chat-assistant.component';
import { ChatsService } from 'src/app/shared/generated';
import { ChatInternalService } from 'src/app/shared/services/chat-internal.service';
import { SharedModule } from 'src/app/shared/shared.module';

export function slotInitializer(slotService: SlotService) {
  return () => slotService.init();
}

@Component({
  standalone: true,
  imports: [
    AngularAuthModule,
    AngularRemoteComponentsModule,
    ChatAssistantComponent,
    CommonModule,
    FormsModule,
    SharedModule,
    RippleModule,
    PortalCoreModule,
    TranslateModule,
    TabViewModule,
    ButtonModule,
    TooltipModule,
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: slotInitializer,
      deps: [SLOT_SERVICE],
      multi: true,
    },
    {
      provide: SLOT_SERVICE,
      useExisting: SlotService,
    },
    PortalMessageService,
    ChatsService,
  ],
  selector: 'app-chat-panel',
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss',
})
export class OneCXChatPanelComponent
  implements ocxRemoteComponent, ocxRemoteWebcomponent {
  permissions: string[] = [];
  loading = true;

  @Input() set ocxRemoteComponentConfig(config: RemoteComponentConfig) {
    this.ocxInitRemoteComponent(config);
  }

  constructor(
    @Inject(BASE_URL) private readonly baseUrl: ReplaySubject<string>,
    private readonly chatInternal: ChatInternalService,
    private readonly userService: UserService,
    private readonly translateService: TranslateService, // private readonly bookmarkApiUtils: BookmarkAPIUtilsService
  ) {
    this.translateService.use(this.userService.lang$.getValue());
  }

  ocxInitRemoteComponent(config: RemoteComponentConfig): void {
    this.baseUrl.next(config.baseUrl);
    this.permissions = config.permissions;
    this.chatInternal.overwriteBaseURL(config.baseUrl);
  }

}
