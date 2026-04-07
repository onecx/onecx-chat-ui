import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-chat-option-button',
  imports: [CommonModule, ButtonModule],
  templateUrl: './chat-option-button.component.html',
  styleUrls: ['./chat-option-button.component.scss']
})
export class ChatOptionButtonComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() icon = '';
  @Input() colorClass = '';
  @Output() buttonClick = new EventEmitter<void>();

  onButtonClick() {
    this.buttonClick.emit();
  }
}
