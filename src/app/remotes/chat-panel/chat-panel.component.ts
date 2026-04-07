import { CommonModule } from '@angular/common';
import { Component, Inject, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AngularAuthModule } from '@onecx/angular-auth';
import {
  PortalMessageService,
  UserService,
} from '@onecx/angular-integration-interface';
import {
  AngularRemoteComponentsModule,
  ocxRemoteComponent,
  ocxRemoteWebcomponent,
  SLOT_SERVICE,
  SlotService,
} from '@onecx/angular-remote-components';
import {
  AngularAcceleratorModule,
} from '@onecx/angular-accelerator';
import {
  REMOTE_COMPONENT_CONFIG,
  RemoteComponentConfig,
} from '@onecx/angular-utils';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';
import { ReplaySubject } from 'rxjs';
import { ChatAssistantComponent } from 'src/app/chat/pages/chat-assistant/chat-assistant.component';
import { ChatInternalService } from 'src/app/shared/services/chat-internal.service';
import { SharedModule } from 'src/app/shared/shared.module';
import { ChatsService } from 'src/app/shared/generated';

export function slotInitializer(slotService: SlotService) {
  return () => slotService.init();
}

@Component({
  imports: [
    AngularAuthModule,
    AngularRemoteComponentsModule,
    ChatAssistantComponent,
    CommonModule,
    FormsModule,
    SharedModule,
    RippleModule,
    AngularAcceleratorModule,
    TranslateModule,
    ButtonModule,
    TooltipModule,
  ],
  providers: [
    {
      provide: SLOT_SERVICE,
      useExisting: SlotService,
    },
    PortalMessageService,
    ChatsService,
  ],
  selector: 'app-chat-panel',
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss'
})

export class OneCXChatPanelComponent
  implements ocxRemoteComponent, ocxRemoteWebcomponent {
  permissions: string[] = [];
  loading = true;

  @Input() set ocxRemoteComponentConfig(config: RemoteComponentConfig) {
    this.ocxInitRemoteComponent(config);
  }

  constructor(
    @Inject(REMOTE_COMPONENT_CONFIG) private readonly remoteComponentConfig: ReplaySubject<RemoteComponentConfig>,
    private readonly chatInternal: ChatInternalService,
    private readonly userService: UserService,
    private readonly translateService: TranslateService, // private readonly bookmarkApiUtils: BookmarkAPIUtilsService
  ) {
    this.translateService.use(this.userService.lang$.getValue());
  }

  ocxInitRemoteComponent(config: RemoteComponentConfig): void {
    this.remoteComponentConfig.next(config);
    this.permissions = config.permissions;
    this.chatInternal.overwriteBaseURL(config.baseUrl);
  }
}
