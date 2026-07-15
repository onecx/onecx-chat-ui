import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';

@Component({
  selector: 'app-chat-slider',
  imports: [ DrawerModule ],
  templateUrl: './chat-slider.component.html',
  styleUrls: ['./chat-slider.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSliderComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() modal = false;
  @Input() showCloseIcon = false;
  @Input() closeOnEscape = true;
  @Input() position: 'left' | 'right' = 'right';
  @Input() styleClass = '';
}
