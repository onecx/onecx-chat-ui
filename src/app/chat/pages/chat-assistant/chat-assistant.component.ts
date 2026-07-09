import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '@onecx/angular-integration-interface';
import { SharedModule } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { TooltipModule } from 'primeng/tooltip';
import { Observable } from 'rxjs';
import { ChatComponent } from 'src/app/shared/components/chat/chat.component';
import { Chat, ChatType } from 'src/app/shared/generated';
import { environment } from 'src/environments/environment';
import { ChatHeaderComponent } from '../../shared/components/chat-header/chat-header.component';
import { ChatListScreenComponent } from '../../shared/components/chat-list-screen/chat-list-screen.component';
import { ChatSliderComponent } from '../../shared/components/chat-silder/chat-slider.component';
import {
  ChatSettingsComponent,
  ChatSettingsFormValue,
} from '../../shared/components/chat-settings/chat-settings.component';
import { ChatAssistantActions } from './chat-assistant.actions';
import { selectChatAssistantViewModel } from './chat-assistant.selectors';
import { ChatAssistantViewModel } from './chat-assistant.viewmodel';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-chat-assistant',
  templateUrl: './chat-assistant.component.html',
  styleUrls: ['./chat-assistant.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DatePickerModule,
    DrawerModule,
    TranslateModule,
    SharedModule,
    ChatComponent,
    TooltipModule,
    SelectModule,
    ChatSliderComponent,
    ChatHeaderComponent,
    ChatListScreenComponent,
    ChatSettingsComponent,
  ],
})
export class ChatAssistantComponent implements OnChanges {
  environment = environment;
  viewModel$: Observable<ChatAssistantViewModel>;
  private readonly destroyRef = inject(DestroyRef);
  protected readonly ChatType = ChatType;
  _sidebarVisible = false;

  @Input()
  set sidebarVisible(val: boolean) {
    if (val) {
      this.store.dispatch(ChatAssistantActions.chatPanelOpened());
    }
    this._sidebarVisible = val;
  }

  @Output() sidebarVisibleChange = new EventEmitter<boolean>();

  constructor(
    private readonly store: Store,
    private readonly notificationService: NotificationService,
  ) {
    this.viewModel$ = this.store.select(selectChatAssistantViewModel);
    this.notificationService.notificationTopic
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((notification) => {
        this.store.dispatch(
          ChatAssistantActions.notificationReceived({ notification }),
        );
      });
  }

  sendMessage(message: string) {
    this.store.dispatch(
      ChatAssistantActions.messageSent({
        message,
      }),
    );
  }

  agentSelected(agentId: string) {
    this.store.dispatch(ChatAssistantActions.agentSelected({ agentId }));
  }

  chatSelected(chat: Chat) {
    this.store.dispatch(
      ChatAssistantActions.chatSelected({
        chat,
      }),
    );
  }

  deleteChat(chat: Chat) {
    this.store.dispatch(
      ChatAssistantActions.deleteChatClicked({
        chat,
      }),
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['sidebarVisible']) {
      this.sidebarVisibleChange.emit(changes['sidebarVisible'].currentValue);
    }
  }

  // NEW METHODS ONECX COMPANION
  selectChatMode(event: { mode: ChatType | 'close'; chatName?: string }) {
    if (event.mode === 'close') {
      this._sidebarVisible = false;
      this.sidebarVisibleChange.emit(false);
      this.store.dispatch(ChatAssistantActions.chatPanelClosed());
      return;
    }

    this.store.dispatch(
      ChatAssistantActions.newChatClicked({
        mode: event.mode,
        topic: event.chatName,
      }),
    );
  }

  goBack() {
    this.store.dispatch(ChatAssistantActions.backButtonClicked());
  }

  closeSidebar() {
    this._sidebarVisible = false;
    this.sidebarVisibleChange.emit(false);
    this.store.dispatch(ChatAssistantActions.chatPanelClosed());
  }

  openSettings() {
    this.store.dispatch(ChatAssistantActions.settingsOpened());
  }

  closeSettings() {
    this.store.dispatch(ChatAssistantActions.settingsClosed());
  }

  onSaveSettings(formValue: ChatSettingsFormValue) {
    this.store.dispatch(
      ChatAssistantActions.saveSettingsClicked({
        chatName: formValue.chatName,
      }),
    );
  }
}
