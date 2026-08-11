import { DatePipe, NgTemplateOutlet } from '@angular/common'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
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
export class ChatComponent implements OnDestroy, AfterViewChecked {
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
  private _initialized = false
  private readonly _scrollThreshold = BOTTOM_THRESHOLD
  private _destroyed = false
  private _scrollTimeout: any

  constructor(
    private readonly translateService: TranslateService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
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

    // Trigger change detection so the indicator shows/hides immediately
    this.cdr.markForCheck()
  }

  /**
   * Scroll to the bottom of the message container using smooth scrolling,
   * with a direct scrollTop fallback when scrollTo is not available.
   */
  scrollToBottom(): void {
    const el = this.scrollContainerRef?.nativeElement
    if (!el) return

    this._isNearBottom = true
    this._unreadCount = 0

    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      // Fallback for environments without scrollTo.
      // Wrapped in a narrow try-catch because some test environments (jsdom)
      // expose a non-writable scrollTop property.
      try {
        el.scrollTop = el.scrollHeight
      } catch {
        // scrollTop assignment not supported in this environment
      }
    }

    // Ensure state is correct after smooth scroll animation completes
    this._scrollTimeout = setTimeout(() => {
      this._isNearBottom = true
      this._unreadCount = 0
    }, 350)
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
   *
   * On first invocation, captures the initial message count without triggering
   * any scroll or unread-side effects, so that subsequent increments are
   * correctly detected as newly appended messages.
   */
  private _checkForNewMessages(): void {
    if (this._destroyed) return

    const currentCount = this.chatMessages.length

    // Initialize snapshot once after first render
    if (!this._initialized) {
      this._previousMessageCount = currentCount
      this._initialized = true
      return
    }

    if (currentCount > this._previousMessageCount) {
      if (this._isNearBottom) {
        this.scrollToBottom()
      } else {
        this._unreadCount += currentCount - this._previousMessageCount
      }
      this._previousMessageCount = currentCount

      // Trigger change detection so the indicator updates when unread count changes
      this.cdr.markForCheck()
    }
  }
}
