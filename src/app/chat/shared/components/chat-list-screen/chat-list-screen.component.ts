import { CommonModule, DatePipe } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { Component, EventEmitter, input, OnInit, Output, ViewChild } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ContextMenu, ContextMenuModule } from 'primeng/contextmenu';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { TabViewModule } from 'primeng/tabview';
import { map, Observable, of, switchMap, forkJoin } from 'rxjs';
import { Chat, ChatType } from 'src/app/shared/generated';
import { ChatHeaderComponent } from '../chat-header/chat-header.component';
import { ChatOptionButtonComponent } from '../chat-option-button/chat-option-button.component';
import { ChatAssistantActions } from 'src/app/chat/pages/chat-assistant/chat-assistant.actions';
import { Store } from '@ngrx/store';
import { selectFilteredChats, chatAssistantSelectors } from 'src/app/chat/pages/chat-assistant/chat-assistant.selectors';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-chat-list-screen',
  standalone: true,
  imports: [
    AvatarModule,
    CommonModule,
    ChatHeaderComponent,
    ChatOptionButtonComponent,
    TranslateModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    TabViewModule,
    ContextMenuModule,
    SelectButtonModule,
    InputGroupModule,
    FormsModule
  ],
  providers: [
    DatePipe
  ],
  templateUrl: './chat-list-screen.component.html',
  styleUrls: ['./chat-list-screen.component.scss'],
})
export class ChatListScreenComponent implements OnInit {
  @Output() selectMode = new EventEmitter<ChatType | 'close'>();
  @Output() chatSelected = new EventEmitter<Chat>();
  @Output() deleteChat = new EventEmitter<Chat>();

  chats = input<Chat[]>([]);

  @ViewChild('cm') cm!: ContextMenu;
  items: MenuItem[] | undefined;
  selectedChat: Chat | null = null;
  logoUrl = '';
  selectedChatMode: ChatType | null = null;
  chatModeOptions = [
    { label: 'AI', value: ChatType.AiChat },
    { label: 'Direct', value: ChatType.HumanDirectChat },
    { label: 'Group', value: ChatType.HumanGroupChat }
  ];
  filteredChats$: Observable<Chat[]>;
  searchQuery$: Observable<string>;
  searchQueryValue = '';


  constructor(
    private readonly datePipe: DatePipe,
    private readonly translate: TranslateService,
    private readonly store: Store
  ) { 
    this.filteredChats$ = this.store.select(selectFilteredChats);
    this.searchQuery$ = this.store.select(chatAssistantSelectors.selectSearchQuery);
  }

  ngOnInit() {
    this.items = [
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        command: () => {
          this.deleteChat.emit(this.selectedChat!);
        }
      },
    ];
  }

  formattedTimes$ = toObservable(this.chats).pipe(
    switchMap((chats: Chat[]) => {
      const entries = chats.map(chat =>
        this.formatLastMessageTime(chat.modificationDate).pipe(map(formattedTime => [chat.modificationDate, formattedTime] as [string, string]))
      );
      return forkJoin(entries);
    }),
    map((pairs: [string, string][]) => Object.fromEntries(pairs))
  );

  formatLastMessageTime(modificationDate: string | undefined): Observable<string> {
    if (!modificationDate) return of('');

    const messageDate = new Date(modificationDate);
    const diffDays = this.getDaysDifference(messageDate);

    if (diffDays < 1) {
      return of(this.datePipe.transform(messageDate, 'shortTime') || '');
    } else if (diffDays < 2) {
      return this.translate.get('CHAT.TIME.YESTERDAY');
    } else if (diffDays < 7) {
      const dayName = this.datePipe.transform(messageDate, 'EEEE') || '';
      const dayKey = dayName.toUpperCase();
      if (!dayKey) return of('');
      return this.translate.get(`CHAT.TIME.${dayKey}`);
    }

    return of(this.datePipe.transform(messageDate, 'shortDate') || '');
  }

  onContextMenu(event: any, chat: Chat) {
    this.selectedChat = chat;
    this.cm.show(event);
  }

  onHide() {
    this.selectedChat = null;
  }

  onChatModeChange(mode: ChatType): void {
    this.selectedChatMode = mode;
    this.selectMode.emit(mode);
  }

  onSearchQueryChange(query: string): void {
    this.searchQueryValue = query;
    this.store.dispatch(ChatAssistantActions.searchQueryChanged({ query }));
  }

  private getDaysDifference(date: Date): number {
    const now = new Date();
    return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  }
}