import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core'
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'

import { FloatLabelModule } from 'primeng/floatlabel'
import { TooltipModule } from 'primeng/tooltip'
import { InputTextModule } from 'primeng/inputtext'

@Component({
  selector: 'app-shared-chat-settings',
  imports: [ReactiveFormsModule, TranslateModule, FloatLabelModule, InputTextModule, TooltipModule],
  templateUrl: './shared-chat-settings.component.html',
  styleUrl: './shared-chat-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SharedChatSettingsComponent implements OnInit, OnDestroy {
  @Input() form!: FormGroup

  ngOnInit(): void {
    if (!this.form.contains('chatName')) {
      this.form.addControl('chatName', new FormControl(''))
    }
  }

  ngOnDestroy(): void {
    if (this.form?.contains('chatName')) {
      this.form.removeControl('chatName')
    }
  }

  get chatNameControl(): FormControl {
    return this.form.get('chatName') as FormControl
  }
}
