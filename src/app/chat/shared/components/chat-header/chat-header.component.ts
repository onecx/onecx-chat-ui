import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-chat-header',
  imports: [CommonModule, ButtonModule],
  templateUrl: './chat-header.component.html',
  styleUrls: ['./chat-header.component.scss']
})
export class ChatHeaderComponent {
  @Input() title = '';
  @Input() showClose = true;
  @Input() showBack = false;
  @Input() showSettings = false;
  @Output() closed = new EventEmitter<void>();
  @Output() backClicked = new EventEmitter<void>();
  @Output() settingsClicked = new EventEmitter<void>();
}
