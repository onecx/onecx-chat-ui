import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-group-chat-settings',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputTextModule,
    ButtonModule,
    FloatLabelModule,
  ],
  templateUrl: './group-chat-settings.component.html',
  styleUrls: ['./group-chat-settings.component.scss']
})
export class GroupChatSettingsComponent implements OnInit, OnDestroy {
  @Input() form!: FormGroup;

  recipientInputControl = new FormControl('');
  private recipientsSet = new Set<string>();

  get recipients(): string[] {
    return Array.from(this.recipientsSet);
  }

  ngOnInit() {
    const existingRecipients = this.form.get('recipients')?.value || [];
    this.recipientsSet = new Set(existingRecipients);
    this.syncRecipientsFromSet();
    
    if (!this.form.contains('recipients')) {
      this.form.addControl(
        'recipients',
        new FormControl([], [
          Validators.required,
          (control) => {
            const value = control.value;
            return Array.isArray(value) && value.length > 0 ? null : { minLength: true };
          },
        ])
      );
    }
    this.recipientInputControl.setValue('');
  }

  ngOnDestroy() {
    if (this.form.contains('recipients')) {
      this.form.removeControl('recipients');
    }
  }

  onAddRecipient() {
    const value = this.recipientInputControl.value?.trim();
    if (value) {
      this.recipientsSet.add(value);
      this.syncRecipientsFromSet();
      this.recipientInputControl.setValue('');
    }
  }

  onRemoveRecipient(index: number) {
    const recipientToRemove = this.recipients[index];
    this.recipientsSet.delete(recipientToRemove);
    this.syncRecipientsFromSet();
  }

  private syncRecipientsFromSet(): void {
    this.form.patchValue({ recipients: Array.from(this.recipientsSet) });
  }
}
