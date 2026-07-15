import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { ChatMessage } from './chat.viewmodel';
import { TooltipModule } from 'primeng/tooltip';
import { ChatAgent } from 'src/app/chat/pages/chat-assistant/chat-assistant.state';
import { SelectModule } from 'primeng/select';
import { MarkdownPipe } from 'src/app/shared/pipes/markdown.pipe';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
  imports: [
    CommonModule,
    AvatarModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    SelectModule,
    ReactiveFormsModule,
    FormsModule,
    TranslateModule,
    ProgressBarModule,
    TooltipModule,
    MarkdownPipe,
  ],
})
export class ChatComponent implements OnChanges {
  @Input()
  chatMessages: ChatMessage[] = [];

  @Input()
  sendMessageDisabled = false;

  @Input()
  agents: ChatAgent[] = [];

  @Input()
  selectedAgentId: string | undefined;

  @Input()
  showAgentSelector = false;

  @Output()
  sendMessage = new EventEmitter<string>();

  @Output()
  retrySendMessage = new EventEmitter<string>();

  @Output()
  agentSelected = new EventEmitter<string>();

  @ViewChild('historyContainer') private readonly historyContainer:
    | ElementRef
    | undefined;

  public formGroup: FormGroup;
  public showNewMessagesIndicator = false;
  public unreadMessagesCount = 0;
  private isAtBottom = true;
  private previousMessageCount = 0;
  private previousLastMessageSignature = '';
  private readonly bottomThreshold = 24;

  constructor(private readonly translateService: TranslateService) {
    this.formGroup = new FormGroup({
      message: new FormControl(null, [
        Validators.minLength(1),
        Validators.maxLength(255),
        Validators.required,
      ]),
    });
  }

  get agentsForDropdown() {
    return this.agents.map((a) => ({
      id: a.id,
      labelKey: a.labelKey,
    }));
  }

  get scrollToLatestMessagesLabel(): string {
    return this.translateService.instant('CHAT.ACTIONS.SCROLL_TO_LATEST');
  }

  /** Emits the current input message and clears the form field. */
  sendButtonClicked() {
    if (
      !this.formGroup.value['message'] ||
      this.formGroup.value['message'] === ''
    )
      return;
    this.sendMessage.emit(this.formGroup.value['message']);
    this.formGroup.reset();
  }

  /** Emits the message text so failed delivery can be retried. */
  retrySending(msg: ChatMessage) {
    this.retrySendMessage.emit(msg.text);
  }

  /** Reacts to chat list updates and updates scroll / unread indicator state. */
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['chatMessages']) {
      return;
    }

    const previousMessages = changes['chatMessages'].previousValue as
      | ChatMessage[]
      | undefined;
    const isConversationReplaced = this.isConversationReplaced(previousMessages);
    const wasAtBottom = this.isUserNearBottom();
    queueMicrotask(() => {
      this.handleChatMessagesChanged(wasAtBottom, isConversationReplaced);
    });
  }

  /** Tracks whether the user is near the latest message while scrolling. */
  onHistoryScroll(): void {
    this.isAtBottom = this.isUserNearBottom();
    if (this.isAtBottom) {
      this.resetUnreadIndicator();
    }
  }

  /** Scrolls to the newest chat message and clears unread-message state. */
  scrollToLatestMessages(): void {
    this.scrollToBottom();
    this.isAtBottom = true;
    this.resetUnreadIndicator();
  }

  private handleChatMessagesChanged(
    wasAtBottom: boolean,
    isConversationReplaced: boolean,
  ): void {
    const newMessagesCount = this.getNewMessagesCount();

    this.previousMessageCount = this.chatMessages.length;
    this.previousLastMessageSignature = this.getLastMessageSignature();

    if (isConversationReplaced) {
      this.resetUnreadIndicator();
      return;
    }

    if (newMessagesCount <= 0) {
      return;
    }

    if (wasAtBottom) {
      this.scrollToBottom();
      this.isAtBottom = true;
      this.resetUnreadIndicator();
      return;
    }

    this.isAtBottom = false;
    this.unreadMessagesCount += newMessagesCount;
    this.showNewMessagesIndicator = this.unreadMessagesCount > 0;
  }

  private getNewMessagesCount(): number {
    const currentLength = this.chatMessages.length;
    if (currentLength > this.previousMessageCount) {
      return currentLength - this.previousMessageCount;
    }

    const currentLastSignature = this.getLastMessageSignature();
    if (
      this.previousMessageCount > 0 &&
      currentLastSignature &&
      currentLastSignature !== this.previousLastMessageSignature
    ) {
      return 1;
    }

    return 0;
  }

  private getLastMessageSignature(): string {
    const lastMessage = this.chatMessages[this.chatMessages.length - 1];
    if (!lastMessage) {
      return '';
    }
    return [
      lastMessage.id,
      lastMessage.creationDate?.toString() ?? '',
      lastMessage.text ?? '',
      lastMessage.isLoadingInfo ? 'loading' : '',
      lastMessage.isFailed ? 'failed' : '',
    ].join('|');
  }

  private scrollToBottom(): void {
    const history = this.historyContainer?.nativeElement as
      | {
          scrollHeight: number;
          scrollTo?: (arg: { top: number; behavior: ScrollBehavior }) => void;
          scrollTop?: number;
        }
      | undefined;

    if (!history) {
      return;
    }

    const top = history.scrollHeight;
    if (history.scrollTo) {
      history.scrollTo({ top, behavior: 'smooth' });
      return;
    }

    history.scrollTop = top;
  }

  private isUserNearBottom(): boolean {
    const history = this.historyContainer?.nativeElement as
      | { scrollHeight: number; scrollTop: number; clientHeight: number }
      | undefined;

    if (!history) {
      return true;
    }

    const distanceToBottom =
      history.scrollHeight - (history.scrollTop + history.clientHeight);
    return distanceToBottom <= this.bottomThreshold;
  }

  private resetUnreadIndicator(): void {
    this.unreadMessagesCount = 0;
    this.showNewMessagesIndicator = false;
  }

  private isConversationReplaced(previousMessages: ChatMessage[] = []): boolean {
    if (previousMessages.length === 0) {
      return false;
    }

    if (this.chatMessages.length === 0) {
      return true;
    }

    const previousFirstMessageId = previousMessages[0]?.id;
    const currentFirstMessageId = this.chatMessages[0]?.id;
    return previousFirstMessageId !== currentFirstMessageId;
  }
}
