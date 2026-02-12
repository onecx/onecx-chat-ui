import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MenuItem, SharedModule } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { MenuModule } from 'primeng/menu';
import { Chat, ChatType } from '../../generated';

export const NEW_HUMAN_DIRECT_CHAT_ITEM = {
  topic: 'CHAT.NEW_CHAT',
  id: 'new',
  type: ChatType.HumanDirectChat,
};
export const NEW_HUMAN_GROUP_CHAT_ITEM = {
  topic: 'CHAT.NEW_CHAT',
  id: 'new',
  type: ChatType.HumanGroupChat,
};
export const NEW_AI_CHAT_ITEM = {
  topic: 'CHAT.NEW_CHAT',
  id: 'new',
  type: ChatType.AiChat,
};

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.component.html',
  styleUrl: './chat-list.component.css',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TranslateModule,
    DropdownModule,
    MenuModule,
    SharedModule,
  ],
})
export class ChatListComponent {
  @Input()
  chats: Chat[] | undefined;

  @Input()
  selectedChat: Chat | undefined;

  @Input()
  loading = false;

  @Input()
  menuItems: MenuItem[] | undefined;

  @Output()
  chatSelected = new EventEmitter<Chat>();

  onChange({ value }: { value: Chat }) {
    this.chatSelected.emit(value);
  }
}
