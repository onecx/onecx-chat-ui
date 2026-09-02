import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectorRef,
  AfterViewInit,
  ChangeDetectionStrategy
} from '@angular/core'
import { FormGroup, ReactiveFormsModule } from '@angular/forms'
import { TranslateModule, TranslateService } from '@ngx-translate/core'

import { ButtonModule } from 'primeng/button'
import { TooltipModule } from 'primeng/tooltip'

import { Chat, ChatType } from 'src/app/shared/generated'
import { mapChatTypeToTitleKey } from 'src/app/chat/pages/chat-assistant/chat-assistant.selectors'
import { SharedChatSettingsComponent } from '../shared-chat-settings/shared-chat-settings.component'
import { DirectChatSettingsComponent } from '../direct-chat-settings/direct-chat-settings.component'
import { GroupChatSettingsComponent } from '../group-chat-settings/group-chat-settings.component'

export interface ChatSettingsFormValue {
  chatName?: string
  recipientInput?: string
  recipients?: string[]
}

@Component({
  selector: 'app-chat-settings',
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    SharedChatSettingsComponent,
    DirectChatSettingsComponent,
    GroupChatSettingsComponent,
    ButtonModule,
    TooltipModule
  ],
  templateUrl: './chat-settings.component.html',
  styleUrls: ['./chat-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatSettingsComponent implements OnInit, AfterViewInit {
  @Input() settingsType: ChatType = ChatType.AiChat
  @Input() mode: 'create' | 'edit' = 'create'
  @Input() currentChat: Chat | undefined
  @Output() submitted = new EventEmitter<ChatSettingsFormValue>()
  @Output() deleteChat = new EventEmitter<void>()

  readonly ChatType = ChatType

  chatForm!: FormGroup

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit() {
    this.initializeForm()
  }

  ngAfterViewInit() {
    const chatNameControl = this.chatForm.get('chatName')
    if (this.mode === 'edit' && this.currentChat && chatNameControl) {
      const topic = this.currentChat.topic
      if (!topic || topic.startsWith('CHAT.')) {
        const nameKey = topic || mapChatTypeToTitleKey(this.currentChat.type)
        this.translateService.get(nameKey).subscribe((chatName: string) => {
          chatNameControl.setValue(chatName)
        })
      } else {
        chatNameControl.setValue(topic)
      }
    }
    // Trigger change detection after child components have initialized
    this.cdr.detectChanges()
  }

  private initializeForm() {
    this.chatForm = new FormGroup({})
  }

  onSubmit(): void {
    if (this.chatForm.invalid) {
      this.chatForm.markAllAsTouched()
      return
    }
    const formValue = this.chatForm.value as ChatSettingsFormValue
    this.submitted.emit({ ...formValue, chatName: this.chatForm.get('chatName')?.value })
  }

  onDeleteChat(): void {
    this.deleteChat.emit()
  }

  onDeleteChatKeydown(event: KeyboardEvent): void {
    // If focus is on the internal native button, Enter already triggers click.
    if ((event.target as HTMLElement | null)?.tagName === 'BUTTON') {
      return
    }
    event.preventDefault()
    this.onDeleteChat()
  }
}
