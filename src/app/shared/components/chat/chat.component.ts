import { DatePipe, NgTemplateOutlet } from '@angular/common'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
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

  @ViewChild('scrollContainer') private readonly scrollContainerRef: ElementRef | undefined

  /** Scroll behavior constants */
  private readonly SCROLL_TOLERANCE = 50
  private readonly SCROLL_BEHAVIOR = 'smooth' as ScrollBehavior

  /** Track whether the user is scrolled to the bottom of the chat */
  isAtBottom = true

  /** Count of unseen new messages while user is scrolled up */
  unreadCount = 0

  /** Previous message count used to detect newly appended content */
  private _previousMessageCount = 0

  public formGroup: FormGroup

  constructor(
    private readonly translateService: TranslateService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {
    this.formGroup = new FormGroup({
      message: new FormControl(null, [Validators.minLength(1), Validators.maxLength(255), Validators.required])
    })
  }

  /** Called when @Input changes are detected — used to detect new messages and trigger scroll or increment unread count. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chatMessages'] && this.chatMessages.length > 0) {
      const newCount = this.chatMessages.length
      const hadNewContent = newCount > this._previousMessageCount

      if (hadNewContent) {
        if (this.isAtBottom) {
          // Defer scroll to after Angular change detection updates the DOM
          setTimeout(() => this.scrollToBottomSmooth(), 0)
        } else {
          // Check if new content is from a non-HUMAN (incoming) message
          const lastMessage = this.chatMessages[this.chatMessages.length - 1]
          if (lastMessage && lastMessage.type !== 'HUMAN') {
            this.unreadCount++
            this.changeDetectorRef.markForCheck()
          }
        }
      }
      // Always track current count so that shrink/reset cases don't
      // falsely trigger new-content detection on the next change
      this._previousMessageCount = newCount
    }
  }

  get agentsForDropdown() {
    return this.agents.map((a) => ({
      id: a.id,
      labelKey: a.labelKey
    }))
  }

  sendButtonClicked() {
    if (!this.formGroup.value['message'] || this.formGroup.value['message'] === '') return
    this.sendMessage.emit(this.formGroup.value['message'])
    this.formGroup.reset()
  }

  retrySending(msg: ChatMessage) {
    this.retrySendMessage.emit(msg.text)
  }

  /**
   * Called on scroll events of the message container to determine if the user is at the bottom.
   * When the user reaches the bottom, resets the unread count and hides the indicator.
   */
  onMessagesScroll(): void {
    const el = this.getScrollContainerElement()
    if (!el) return

    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= this.SCROLL_TOLERANCE
    const wasAtBottom = this.isAtBottom

    this.isAtBottom = isBottom
    if (isBottom && !wasAtBottom) {
      this.unreadCount = 0
      this.changeDetectorRef.markForCheck()
    }
  }

  /** Smoothly scrolls the message container to the bottom. */
  scrollToBottomSmooth(): void {
    const el = this.getScrollContainerElement()
    if (!el) return

    el.scrollTo({
      top: el.scrollHeight,
      behavior: this.SCROLL_BEHAVIOR
    })
  }

  /**
   * Click handler for the unread indicator button.
   * Scrolls to bottom and clears the unread count.
   */
  scrollToBottomAndClear(): void {
    this.scrollToBottomSmooth()
    this.isAtBottom = true
    this.unreadCount = 0
    this.changeDetectorRef.markForCheck()
  }

  /** Returns the DOM element for the scrollable container, or undefined. */
  private getScrollContainerElement(): HTMLElement | undefined {
    return this.scrollContainerRef?.nativeElement
  }
}
