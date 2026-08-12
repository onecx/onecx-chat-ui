import { DatePipe, NgTemplateOutlet } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
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

const SCROLL_THRESHOLD = 50

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
export class ChatComponent implements OnInit, OnChanges {
  private _chatMessages: ChatMessage[] = []

  @Input()
  get chatMessages(): ChatMessage[] {
    return this._chatMessages
  }

  set chatMessages(value: ChatMessage[]) {
    this._chatMessages = value ?? []
  }

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
  @ViewChild('bottomAnchor') private readonly bottomAnchorRef: ElementRef | undefined

  private previousMessageCount = 0
  private isAtBottom = true

  private _showNewMessageHint = false
  private _newMessagesCount = 0

  public get showNewMessageHint(): boolean {
    return this._showNewMessageHint
  }

  public get newMessagesCount(): number {
    return this._newMessagesCount
  }

  public formGroup: FormGroup

  constructor(private readonly translateService: TranslateService) {
    this.formGroup = new FormGroup({
      message: new FormControl(null, [Validators.minLength(1), Validators.maxLength(255), Validators.required])
    })
  }

  ngOnInit(): void {
    this.previousMessageCount = this.chatMessages?.length ?? 0
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chatMessages']) {
      this.onMessagesChanged()
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

  onMessagesScroll(): void {
    const el = this.scrollContainerRef?.nativeElement
    if (!el) return

    const { scrollTop, clientHeight, scrollHeight } = el
    this.isAtBottom = scrollTop + clientHeight >= scrollHeight - SCROLL_THRESHOLD

    if (this.isAtBottom) {
      this._showNewMessageHint = false
      this._newMessagesCount = 0
    }
  }

  onMessagesChanged(): void {
    const currentCount = this.chatMessages?.length ?? 0
    const delta = currentCount - this.previousMessageCount

    if (delta > 0) {
      if (this.isAtBottom) {
        this.scrollToBottomSmooth()
        this._showNewMessageHint = false
        this._newMessagesCount = 0
      } else {
        this._newMessagesCount += delta
        this._showNewMessageHint = true
      }
    }

    this.previousMessageCount = currentCount
  }

  scrollToBottomSmooth(): void {
    const anchor = this.bottomAnchorRef?.nativeElement
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'end' })
    } else {
      const el = this.scrollContainerRef?.nativeElement
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      }
    }
  }

  onNewMessageHintClick(): void {
    this.scrollToBottomSmooth()
    this._showNewMessageHint = false
    this._newMessagesCount = 0
  }
}
