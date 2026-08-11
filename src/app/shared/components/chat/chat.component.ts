import { DatePipe, NgTemplateOutlet } from '@angular/common'
import {
  ChangeDetectionStrategy,
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms'
import { TranslateModule, TranslateService } from '@ngx-translate/core'

import { AvatarModule } from 'primeng/avatar'
import { ButtonModule } from 'primeng/button'
import { CardModule } from 'primeng/card'
import { InputTextModule } from 'primeng/inputtext'
import { ProgressBarModule } from 'primeng/progressbar'
import { SelectModule } from 'primeng/select'
import { TextareaModule } from 'primeng/textarea'

import { ChatAgent } from 'src/app/chat/pages/chat-assistant/chat-assistant.state'
import { ChatMessage } from './chat.viewmodel'
import { TooltipModule } from 'primeng/tooltip'
import { MarkdownPipe } from '../../pipes/markdown.pipe'
import { FloatLabelModule } from 'primeng/floatlabel'

const BOTTOM_THRESHOLD = 50
const UNREAD_DISPLAY_CAP = 99

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
    NgTemplateOutlet
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnChanges, OnDestroy, AfterViewChecked {
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

  @ViewChild('scrollContainer') private readonly scrollContainerRef: ElementRef | undefined

  public formGroup: FormGroup

  // Auto-scroll state
  private _isNearBottom = true
  private _unreadCount = 0
  private _previousMessageCount = 0
  private readonly _scrollThreshold = BOTTOM_THRESHOLD
  private _destroyed = false
  private _scrollTimeout: any

  constructor(
    private readonly translateService: TranslateService,
    private readonly ngZone: NgZone
  ) {
    this.formGroup = new FormGroup({
      message: new FormControl(null, [Validators.minLength(1), Validators.maxLength(255), Validators.required])
    })
  }

  /** Check whether the user is considered at/near the bottom of the chat. */
  get isNearBottom(): boolean {
    return this._isNearBottom
  }

  /** Number of unread messages that appeared while the user was scrolled up. */
  get unreadCount(): number {
    return this._unreadCount
  }

  /** Whether the "new messages" indicator should be visible. */
  get showNewMessagesIndicator(): boolean {
    return this._unreadCount > 0
  }

  /** Display value clamped to 99+ for the indicator badge. */
  get unreadCountDisplay(): string {
    if (this._unreadCount > UNREAD_DISPLAY_CAP) {
      return `${UNREAD_DISPLAY_CAP}+`
    }
    return `${this._unreadCount}`
  }

  get agentsForDropdown() {
    return this.agents.map((a) => ({
      id: a.id,
      labelKey: a.labelKey
    }))
  }

  /**
   * Detect when the rendered message count changes.
   * Called from ngAfterViewChecked to trigger auto-scroll or increment unread counter.
   */
  ngAfterViewChecked(): void {
    this._checkForNewMessages()
  }

  /** Implement OnChanges to reset snapshot when messages input changes externally. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chatMessages']) {
      this._previousMessageCount = this.chatMessages.length
    }
  }

  ngOnDestroy(): void {
    this._destroyed = true
    if (this._scrollTimeout) {
      clearTimeout(this._scrollTimeout)
    }
  }

  /**
   * Handler for scroll events on the message container.
   * Determines whether the user is near the bottom and resets unread state accordingly.
   */
  onScroll(): void {
    const el = this.scrollContainerRef?.nativeElement
    if (!el) return

    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight)
    this._isNearBottom = distanceFromBottom <= this._scrollThreshold

    // Reset unread counter and hide indicator when user scrolls to the bottom
    if (this._isNearBottom) {
      this._unreadCount = 0
    }
  }

  /**
   * Scroll to the bottom of the message container using smooth scrolling,
   * with a direct fallback.
   */
  scrollToBottom(): void {
    const el = this.scrollContainerRef?.nativeElement
    if (!el) return

    // Try smooth scroll first
    let smoothSucceeded = false
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      smoothSucceeded = true
    } catch {
      // Fallback for environments that don't support smooth behavior
      try {
        el.scrollTop = el.scrollHeight
      } catch {
        // Some test environments (jsdom) don't allow setting scrollTop
        // In production browsers this is never reached
      }
    }

    // After smooth scroll completes, mark user as at bottom and clear unread
    if (smoothSucceeded) {
      this._scrollTimeout = setTimeout(() => {
        this._isNearBottom = true
        this._unreadCount = 0
      }, 350)
    }
  }

  /**
   * Handler for clicking the "new messages" indicator.
   * Scrolls to bottom and clears unread/indicator state in one operation.
   */
  scrolltoLatestMessages(): void {
    this.scrollToBottom()
  }

  sendButtonClicked() {
    if (!this.formGroup.value['message'] || this.formGroup.value['message'] === '') return
    this.sendMessage.emit(this.formGroup.value['message'])
    this.formGroup.reset()

    // After sending a message, scroll to bottom to show loading/progress
    this._scrollTimeout = setTimeout(() => {
      this.scrollToBottom()
    }, 50)
  }

  retrySending(msg: ChatMessage) {
    this.retrySendMessage.emit(msg.text)
  }

  /**
   * Detect newly rendered messages by comparing current message count
   * to the previous snapshot. When new items appear:
   * - If user is near bottom: smooth scroll to reveal them.
   * - Otherwise: increment unread counter and show indicator.
   */
  private _checkForNewMessages(): void {
    if (this._destroyed) return

    const currentCount = this.chatMessages.length
    if (currentCount > this._previousMessageCount) {
      if (this._isNearBottom) {
        this.scrollToBottom()
      } else {
        this._unreadCount += currentCount - this._previousMessageCount
      }
      this._previousMessageCount = currentCount
    }
  }
}
