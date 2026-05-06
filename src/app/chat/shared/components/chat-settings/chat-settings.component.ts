import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SharedChatSettingsComponent } from '../shared-chat-settings/shared-chat-settings.component';
import { DirectChatSettingsComponent } from '../direct-chat-settings/direct-chat-settings.component';
import { GroupChatSettingsComponent } from '../group-chat-settings/group-chat-settings.component';
import { ButtonModule } from 'primeng/button';
import { Chat, ChatType } from 'src/app/shared/generated';
import { mapChatTypeToTitleKey } from '../../../pages/chat-assistant/chat-assistant.selectors';

export interface ChatSettingsFormValue {
  chatName?: string;
  recipientInput?: string;
  recipients?: string[];
}

@Component({
  selector: 'app-chat-settings',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    SharedChatSettingsComponent,
    DirectChatSettingsComponent,
    GroupChatSettingsComponent,
    ButtonModule,
  ],
  templateUrl: './chat-settings.component.html',
  styleUrls: ['./chat-settings.component.scss']
})
export class ChatSettingsComponent implements OnInit, AfterViewInit {
  @Input() settingsType: ChatType = ChatType.AiChat;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() currentChat: Chat | undefined;
  @Output() submitted = new EventEmitter<ChatSettingsFormValue>();
  @Output() deleteChat = new EventEmitter<void>();

  readonly ChatType = ChatType;

  chatForm!: FormGroup;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly translateService: TranslateService,
  ) {}

  ngOnInit() {
    this.initializeForm();
  }

  ngAfterViewInit() {
    if (this.mode === 'edit' && this.currentChat) {
      const topic = this.currentChat.topic;
      if (!topic || topic.startsWith('CHAT.')) {
        const nameKey = topic || mapChatTypeToTitleKey(this.currentChat.type);
        this.translateService.get(nameKey).subscribe((chatName: string) => {
          this.chatForm.patchValue({ chatName });
        });
      } else {
        this.chatForm.patchValue({ chatName: topic });
      }
    }
    // Trigger change detection after child components have initialized
    this.cdr.detectChanges();
  }

  private initializeForm() {
    this.chatForm = new FormGroup({});
  }

  onSubmit(): void {
    if (this.chatForm.invalid) {
      this.chatForm.markAllAsTouched();
      return;
    }
    const formValue = this.chatForm.value as ChatSettingsFormValue;
    this.submitted.emit({ ...formValue, chatName: this.chatForm.get('chatName')?.value });
  }

  onDeleteChat(): void {
    this.deleteChat.emit();
  }
}
