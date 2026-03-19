import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'primeng/api';
import { CalendarModule } from 'primeng/calendar';
import { SidebarModule } from 'primeng/sidebar';
import { TooltipModule } from 'primeng/tooltip';
import { Observable, firstValueFrom } from 'rxjs';
import { ChatListComponent } from 'src/app/shared/components/chat-list/chat-list.component';
import { ChatComponent } from 'src/app/shared/components/chat/chat.component';
import { Chat, ChatType } from 'src/app/shared/generated';
import { environment } from 'src/environments/environment';
import { ChatHeaderComponent } from '../../shared/components/chat-header/chat-header.component';
import { ChatListScreenComponent } from '../../shared/components/chat-list-screen/chat-list-screen.component';
import { ChatSliderComponent } from '../../shared/components/chat-silder/chat-slider.component';
import { ChatSettingsComponent, ChatSettingsFormValue } from '../../shared/components/chat-settings/chat-settings.component';
import { ChatAssistantActions } from './chat-assistant.actions';
import { selectChatAssistantViewModel, chatAssistantSelectors } from './chat-assistant.selectors';
import { ChatAssistantViewModel } from './chat-assistant.viewmodel';

@Component({
  selector: 'app-chat-assistant',
  templateUrl: './chat-assistant.component.html',
  styleUrls: ['./chat-assistant.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CalendarModule,
    SidebarModule,
    TranslateModule,
    SharedModule,
    ChatComponent,
    ChatListComponent,
    TooltipModule,
    ChatSliderComponent,
    ChatHeaderComponent,
    ChatListScreenComponent,
    ChatSettingsComponent,
  ],
})
export class ChatAssistantComponent implements OnChanges {
  environment = environment;
  viewModel$: Observable<ChatAssistantViewModel>;
  protected readonly ChatType = ChatType;
  _sidebarVisible = false;
  settingsOpen = false;

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
  ) {
    this.viewModel$ = this.store.select(selectChatAssistantViewModel);
  }

  sendMessage(message: string) {
    this.store.dispatch(
      ChatAssistantActions.messageSent({
        message,
      }),
    );
  }

  chatSelected(chat: Chat) {
    this.settingsOpen = false;
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

    this.store.dispatch(ChatAssistantActions.newChatClicked({ mode: event.mode, topic: event.chatName }));
  }

  goBack() {
    this.settingsOpen = false;
    this.store.dispatch(ChatAssistantActions.backButtonClicked());
  }

  closeSidebar() {
    this._sidebarVisible = false;
    this.sidebarVisibleChange.emit(false);
    this.store.dispatch(ChatAssistantActions.chatPanelClosed());
  }

  openSettings() {
    this.settingsOpen = true;
  }

  closeSettings() {
    this.settingsOpen = false;
  }

  onSaveSettings(formValue: ChatSettingsFormValue) {
    firstValueFrom(this.store.select(chatAssistantSelectors.selectCurrentChat)).then((currentChat: Chat | undefined) => {
      if (!currentChat) return;
      
      const payload: Partial<Chat> = {
        ...currentChat,
        topic: formValue.chatName ?? currentChat.topic ?? ''
      };

      this.store.dispatch(ChatAssistantActions.updateCurrentChat({ chat: payload }));
      this.settingsOpen = false;
    });
  }
}
