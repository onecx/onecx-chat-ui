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
import { Observable } from 'rxjs';
import { ChatListComponent } from 'src/app/shared/components/chat-list/chat-list.component';
import { ChatComponent } from 'src/app/shared/components/chat/chat.component';
import { Chat, ChatType } from 'src/app/shared/generated';
import { environment } from 'src/environments/environment';
import { ChatHeaderComponent } from '../../shared/components/chat-header/chat-header.component';
import { ChatListScreenComponent } from '../../shared/components/chat-list-screen/chat-list-screen.component';
import { ChatSliderComponent } from '../../shared/components/chat-silder/chat-slider.component';
import { ChatAssistantActions } from './chat-assistant.actions';
import { selectChatAssistantViewModel } from './chat-assistant.selectors';
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
  ],
})
export class ChatAssistantComponent implements OnChanges {
  environment = environment;
  viewModel$: Observable<ChatAssistantViewModel>;
  
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
  selectChatMode(mode: ChatType | 'close') {
    if (mode === 'close') {
      this._sidebarVisible = false;
      this.sidebarVisibleChange.emit(false);
      this.store.dispatch(ChatAssistantActions.chatPanelClosed());
      return;
    }

    this.store.dispatch(ChatAssistantActions.newChatClicked({ mode }));
  }

  goBack() {
    this.store.dispatch(ChatAssistantActions.backButtonClicked());
  }

  closeSidebar() {
    this._sidebarVisible = false;
    this.sidebarVisibleChange.emit(false);
    this.store.dispatch(ChatAssistantActions.chatPanelClosed());
  }

  voiceChatToggled(enabled: boolean) {
    if (enabled) {
      this.store.dispatch(ChatAssistantActions.voiceChatEnabled());
    } else {
      this.store.dispatch(ChatAssistantActions.voiceChatDisabled());
    }
  }

  voiceUserTranscriptReceived(event: { text: string; isFinal: boolean }) {
    this.store.dispatch(
      ChatAssistantActions.voiceUserTranscriptReceived({
        text: event.text,
        isFinal: event.isFinal,
      }),
    );
  }

  voiceBotTranscriptReceived(event: { text: string, spoken: boolean }) {
    this.store.dispatch(
      ChatAssistantActions.voiceBotTranscriptReceived({
        text: event.text,
        spoken: event.spoken,
      }),
    );
  }
}
