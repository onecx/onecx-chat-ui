import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
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
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { ChatMessage } from './chat.viewmodel';
import { VoiceComponent } from '../voice/voice.component';
import { Chat } from '../../generated';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
  standalone: true,
  imports: [
    CommonModule,
    AvatarModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    ReactiveFormsModule,
    FormsModule,
    TranslateModule,
    DropdownModule,
    ProgressBarModule,
    VoiceComponent,
  ],
})
export class ChatComponent implements OnChanges, AfterViewChecked {

  @Input()
  chat: Chat | undefined;

  @Input()
  chatMessages: ChatMessage[] = [];

  @Input()
  sendMessageDisabled = false;

  @Input()
  voiceChatEnabled = false;

  @Output()
  voiceChatToggled = new EventEmitter<boolean>();

  @Output()
  voiceUserTranscript = new EventEmitter<{ text: string; isFinal: boolean }>();

  @Output()
  voiceBotTranscript = new EventEmitter<{ text: string; spoken: boolean }>();

  @Output()
  sendMessage = new EventEmitter<string>();

  @Output()
  retrySendMessage = new EventEmitter<string>();

  @ViewChild('scrollContainer') private scrollContainer: ElementRef | undefined;

  private shouldScrollToBottom = false;

  public formGroup: FormGroup;

  constructor(private translateService: TranslateService) {
    this.formGroup = new FormGroup({
      message: new FormControl(null, [
        Validators.minLength(1),
        Validators.maxLength(255),
        Validators.required,
      ]),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chatMessages']) {
      this.shouldScrollToBottom = true;
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private scrollToBottom(): void {
    if (this.scrollContainer) {
      this.scrollContainer.nativeElement.scrollTop =
        this.scrollContainer.nativeElement.scrollHeight;
    }
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

  onVoiceChatToggled(enabled: boolean) {
    this.voiceChatToggled.emit(enabled);
  }
}
