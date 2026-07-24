import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'

import { ButtonModule } from 'primeng/button'
import { TooltipModule } from 'primeng/tooltip'

@Component({
  selector: 'app-chat-header',
  imports: [ButtonModule, TranslateModule, TooltipModule],
  templateUrl: './chat-header.component.html',
  styleUrls: ['./chat-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatHeaderComponent {
  @Input() title = ''
  @Input() showClose = true
  @Input() showBack = false
  @Input() showSettings = false
  @Input() backLabelKey = 'CHAT.HEADER.BACK'
  @Output() closed = new EventEmitter<void>()
  @Output() backClicked = new EventEmitter<void>()
  @Output() settingsClicked = new EventEmitter<void>()
}
