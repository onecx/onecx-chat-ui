import { DatePipe, NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'

import { AvatarModule } from 'primeng/avatar'
import { ButtonModule } from 'primeng/button'
import { CardModule } from 'primeng/card'
import { InputTextModule } from 'primeng/inputtext'
import { ProgressBarModule } from 'primeng/progressbar'
import { SelectModule } from 'primeng/select'
import { TextareaModule } from 'primeng/textarea'

import { FloatLabelModule } from 'primeng/floatlabel'
import { TooltipModule } from 'primeng/tooltip'
import { ChatAgent } from 'src/app/chat/pages/chat-assistant/chat-assistant.state'
import { MarkdownPipe } from '../../pipes/markdown.pipe'
import { ChatScrollService } from '../../services/chat-scroll.service'
import { NewMessageIndicatorComponent } from '../new-message-indicator/new-message-indicator.component'
import { ChatMessage } from './chat.viewmodel'

/**
 * Bottom-aware scroll controller for the chat viewport.
 *
 * When a new message arrives while the user is at the bottom, the view
 * scrolls smoothly to show it. When the user has scrolled up, a floating
 * indicator appears instead. Progress/loading messages follow the same
 * flow as regular messages — they count as one "new message" when first
 * appended, regardless of how many times their content is updated in place.
 */
@Component({
  selector: 'app-chat',
  imports: [
    AvatarModule,
    ButtonModule,
    CardModule,
    DatePipe,
    InputTextModule,
    FloatLabelModule,
    SelectModule,
    ReactiveFormsModule,
    FormsModule,
    TextareaModule,
    TranslateModule,
    ProgressBarModule,
    TooltipModule,
    MarkdownPipe,
    NgTemplateOutlet,
    NewMessageIndicatorComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnChanges {
  @Input()
  chatMessages: ChatMessage[] = []

  @Input()
  sendMessageDisabled = false

  @Input()
  agents: ChatAgent[] = []

  @Input()
  selectedAgentId: string | undefined

  @Input()
  showAgentSelector = false

  @Output()
  sendMessage = new EventEmitter<string>()

  @Output()
  retrySendMessage = new EventEmitter<string>()

  @Output()
  agentSelected = new EventEmitter<string>()

  @ViewChild('historyContainer') private readonly historyContainer: ElementRef | undefined

  public formGroup: FormGroup;
  public showNewMessagesIndicator = false;
  public unreadMessagesCount = 0;

  /** Set to true when the user scrolls to within the bottom threshold */
  private isAtBottom = true;

  /** IDs of messages that were already present in the last ngOnChanges pass */
  private knownMessageIds = new Set<string>();

  /** Pixel threshold: user is "at bottom" when within this many pixels of the container's bottom edge */
  private readonly nearBottomThresholdPx = 24;

  constructor(private readonly scrollService: ChatScrollService) {
    this.formGroup = new FormGroup({
      message: new FormControl(null, [Validators.minLength(1), Validators.maxLength(255), Validators.required])
    })
  }

  get agentsForDropdown() {
    return this.agents.map((a) => ({
      id: a.id,
      labelKey: a.labelKey
    }))
  }

  /** Emits the current input message and clears the form field. */
  sendButtonClicked() {
    if (!this.formGroup.value['message'] || this.formGroup.value['message'] === '') return
    this.sendMessage.emit(this.formGroup.value['message'])
    this.formGroup.reset()
  }

  /** Emits the message text so failed delivery can be retried. */
  retrySending(msg: ChatMessage) {
    this.retrySendMessage.emit(msg.text)
  }

  /** Reacts to chat list updates and updates scroll / unread indicator state. */
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['chatMessages']) {
      return;
    }

    const wasAtBottom = this.isUserNearBottom();
    // Use queueMicrotask to let the DOM render new messages before scrolling
    queueMicrotask(() => {
      this.handleChatMessagesChanged(wasAtBottom);
    });
  }

  /** Tracks whether the user is near the latest message while scrolling. */
  onHistoryScroll(): void {
    this.isAtBottom = this.isUserNearBottom();
    if (this.isAtBottom) {
      this.scrollService.resetToBottom();
      this.resetUnreadIndicator();
    }
  }

  /** Scrolls to the newest chat message and clears unread-message state. */
  scrollToLatestMessages(): void {
    this.scrollToBottom();
    this.isAtBottom = true;
    this.resetUnreadIndicator();
  }

  private handleChatMessagesChanged(wasAtBottom: boolean): void {
    // Count only messages with IDs that weren't seen before.
    // This correctly handles loading/progress messages: the initial
    // append counts as 1 new message, but subsequent in-place content
    // updates (same ID) do NOT inflate the count.
    const newMessageCount = this.countNewMessages();

    if (newMessageCount <= 0) {
      return;
    }

    if (wasAtBottom) {
      this.scrollToBottom();
      this.isAtBottom = true;
      this.resetUnreadIndicator();
      return;
    }

    // User is scrolled up: increment unread count and show indicator
    this.isAtBottom = false;
    this.unreadMessagesCount += newMessageCount;
    this.showNewMessagesIndicator = this.unreadMessagesCount > 0;
  }

  /**
   * Returns the number of messages whose ID is not in the known set.
   * After counting, updates the known set to include all current IDs.
   *
   * This approach avoids the overcounting bug where in-place updates
   * to a loading/progress message would each be counted as a new message.
   */
  private countNewMessages(): number {
    let count = 0;
    for (const msg of this.chatMessages) {
      if (!this.knownMessageIds.has(msg.id)) {
        count++;
      }
    }
    // Update known set to current snapshot
    this.knownMessageIds = new Set(this.chatMessages.map((m) => m.id));
    return count;
  }

  private scrollToBottom(): void {
    const history = this.historyContainer?.nativeElement;

    if (!history) {
      return;
    }

    this.scrollService.init(history as HTMLElement, this.nearBottomThresholdPx);
    this.scrollService.scrollToBottom();
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
    return distanceToBottom <= this.nearBottomThresholdPx;
  }

  private resetUnreadIndicator(): void {
    this.unreadMessagesCount = 0;
    this.showNewMessagesIndicator = false;
  }
}
