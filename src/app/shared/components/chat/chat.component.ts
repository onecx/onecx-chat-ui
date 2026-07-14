import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
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
export class ChatComponent implements AfterViewInit, OnChanges {
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

  @ViewChild('scrollViewport') private readonly scrollViewport:
    | ElementRef<HTMLDivElement>
    | undefined;

  public formGroup: FormGroup;
  showNewMessageIndicator = false;
  unreadMessagesCount = 0;
  private previousMessageCount = 0;
  private wasNearBottom = true;
  private readonly bottomThresholdPx = 24;

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

  sendButtonClicked() {
    if (
      !this.formGroup.value['message'] ||
      this.formGroup.value['message'] === ''
    )
      return;
    this.sendMessage.emit(this.formGroup.value['message']);
    this.formGroup.reset();
  }

  retrySending(msg: ChatMessage) {
    this.retrySendMessage.emit(msg.text);
  }

  ngAfterViewInit() {
    queueMicrotask(() => this.scrollToBottom('auto'));
    this.previousMessageCount = this.chatMessages.length;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['chatMessages']) {
      return;
    }
    const previousMessageCount = this.previousMessageCount;
    const currentMessageCount = this.chatMessages.length;
    const hasMoreMessages = currentMessageCount > previousMessageCount;
    this.previousMessageCount = currentMessageCount;

    if (!hasMoreMessages) {
      this.resetUnreadIndicator();
      return;
    }

    queueMicrotask(() => {
      if (!this.scrollViewport) {
        return;
      }
      const isUserNearBottom = this.wasNearBottom || this.isNearBottom();
      if (isUserNearBottom) {
        this.scrollToBottom('smooth');
        this.resetUnreadIndicator();
      } else {
        this.unreadMessagesCount += currentMessageCount - previousMessageCount;
        this.showNewMessageIndicator = true;
      }
    });
  }

  onHistoryScrolled() {
    if (this.isNearBottom()) {
      this.wasNearBottom = true;
      this.resetUnreadIndicator();
    } else {
      this.wasNearBottom = false;
    }
  }

  scrollToLatestMessages() {
    this.scrollToBottom('smooth');
    this.resetUnreadIndicator();
  }

  private resetUnreadIndicator() {
    this.unreadMessagesCount = 0;
    this.showNewMessageIndicator = false;
  }

  private isNearBottom(): boolean {
    const container = this.scrollViewport?.nativeElement;
    if (!container) return true;
    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceToBottom <= this.bottomThresholdPx;
  }

  private scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    const container = this.scrollViewport?.nativeElement;
    if (!container) {
      return;
    }
    container.scrollTo({ top: container.scrollHeight, behavior });
    this.wasNearBottom = true;
  }
}
