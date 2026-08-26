import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'
import { TooltipModule } from 'primeng/tooltip'

/**
 * Floating button that appears when new messages arrive while the user is scrolled up.
 *
 * Displays an arrow-down icon and unread message count with an animated gradient border.
 * Emits an event when clicked so the parent can scroll to the latest messages.
 */
@Component({
  selector: 'app-new-message-indicator',
  imports: [TranslateModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-message-indicator.component.html',
  styleUrl: './new-message-indicator.component.scss'
})
export class NewMessageIndicatorComponent {
  /** Number of unread messages to display */
  @Input() unreadCount = 0

  /** Emitted when the user clicks the indicator to scroll down */
  @Output() scrollClick = new EventEmitter<void>()

  /** Whether to show the count badge (hide for count of 0) */
  get showCount(): boolean {
    return this.unreadCount > 0
  }
}
