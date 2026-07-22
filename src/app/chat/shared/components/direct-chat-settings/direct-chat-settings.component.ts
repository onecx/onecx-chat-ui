import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core'
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'

import { ButtonModule } from 'primeng/button'
import { InputGroupModule } from 'primeng/inputgroup'
import { InputGroupAddonModule } from 'primeng/inputgroupaddon'
import { InputTextModule } from 'primeng/inputtext'
import { FloatLabelModule } from 'primeng/floatlabel'
import { TooltipModule } from 'primeng/tooltip'

@Component({
  selector: 'app-direct-chat-settings',
  imports: [
    ButtonModule,
    ReactiveFormsModule,
    TranslateModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputTextModule,
    FloatLabelModule,
    TooltipModule
  ],
  templateUrl: './direct-chat-settings.component.html',
  styleUrls: ['./direct-chat-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DirectChatSettingsComponent implements OnInit, OnDestroy {
  @Input() form!: FormGroup

  ngOnInit() {
    if (!this.form.contains('recipientInput')) {
      this.form.addControl(
        'recipientInput',
        new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(100)])
      )
    }
  }

  ngOnDestroy() {
    if (this.form.contains('recipientInput')) {
      this.form.removeControl('recipientInput')
    }
  }

  get recipientInputControl(): FormControl {
    return this.form.get('recipientInput') as FormControl
  }

  onSearch(): void {
    // Placeholder for future search functionality
  }
}
