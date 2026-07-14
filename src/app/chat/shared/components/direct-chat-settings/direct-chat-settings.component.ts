import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-direct-chat-settings',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputTextModule,
    FloatLabelModule,
    TooltipModule,
  ],
  templateUrl: './direct-chat-settings.component.html',
  styleUrls: ['./direct-chat-settings.component.scss'],
})
export class DirectChatSettingsComponent implements OnInit, OnDestroy {
  @Input() form!: FormGroup;

  ngOnInit() {
    if (!this.form.contains('recipientInput')) {
      this.form.addControl('recipientInput', new FormControl('', [Validators.required]));
    }
  }

  ngOnDestroy() {
    if (this.form.contains('recipientInput')) {
      this.form.removeControl('recipientInput');
    }
  }

  get recipientInputControl(): FormControl {
    return this.form.get('recipientInput') as FormControl;
  }

  onSearch(): void {
    // Placeholder for future search functionality
  }
}
