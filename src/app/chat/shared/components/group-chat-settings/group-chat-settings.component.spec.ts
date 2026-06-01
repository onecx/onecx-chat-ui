import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { GroupChatSettingsComponent } from './group-chat-settings.component';
import { TranslateTestingModule } from 'ngx-translate-testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { GroupChatSettingsHarness } from './group-chat-settings.harness';

describe('GroupChatSettingsComponent', () => {
  let component: GroupChatSettingsComponent;
  let fixture: ComponentFixture<GroupChatSettingsComponent>;
  let form: FormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        GroupChatSettingsComponent,
        ReactiveFormsModule,
        TranslateTestingModule.withTranslations({
          'en': require('./src/assets/i18n/en.json'),
          'de': require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ],
    }).compileComponents();
  });

  describe('ngOnInit', () => {
    it('should add recipients control on init if not present', () => {
      form = new FormGroup({});
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      expect(form.contains('recipients')).toBe(false);
      fixture.detectChanges();
      expect(form.contains('recipients')).toBe(true);
      expect(form.get('recipients')).toBeInstanceOf(FormControl);
      expect(form.get('recipients')?.validator).toBeTruthy();
    });

    it('should not overwrite recipients if already present', () => {
      form = new FormGroup({});
      const existing = new FormControl(['existing'], Validators.required);
      form.addControl('recipients', existing);
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      fixture.detectChanges();
      expect(form.get('recipients')).toBe(existing);
    });

    it('should initialize recipients from form value and display them in UI', async () => {
      form = new FormGroup({ recipients: new FormControl(['user1', 'user2']) });
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      
      fixture.detectChanges();
      
      const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, GroupChatSettingsHarness);
      const recipientsCount = await harness.getRecipientsCount();
      
      expect(component.recipients).toEqual(['user1', 'user2']);
      expect(recipientsCount).toBe(2);
    });

    it('should set recipients to [] if recipients control value is undefined', () => {
      form = new FormGroup({ recipients: new FormControl(undefined) });
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      fixture.detectChanges();
      expect(component.recipients).toEqual([]);
    });

    it('should set recipients to [] if recipients control value is null', () => {
      form = new FormGroup({ recipients: new FormControl(null) });
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      fixture.detectChanges();
      expect(component.recipients).toEqual([]);
    });

    it('should set recipients to [] and not display any items in UI', async () => {
      form = new FormGroup({ recipients: new FormControl([]) });
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      
      fixture.detectChanges();
      
      const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, GroupChatSettingsHarness);
      const recipientsCount = await harness.getRecipientsCount();
      
      expect(component.recipients).toEqual([]);
      expect(recipientsCount).toBe(0);
    });

    it('should clear recipientInputControl on init', async () => {
      form = new FormGroup({});
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      component.recipientInputControl.setValue('test');
      
      fixture.detectChanges();
      
      const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, GroupChatSettingsHarness);
      const inputValue = await harness.getRecipientInputValue();
      
      expect(component.recipientInputControl.value).toBe('');
      expect(inputValue).toBe('');
    });
  });

  describe('onAddRecipient', () => {
    it('should add recipient via UI interaction', async () => {
      form = new FormGroup({});
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      
      fixture.detectChanges();
      
      const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, GroupChatSettingsHarness);
      
      await harness.setRecipientInputValue('newUser');
      await harness.clickAddButton();
      
      const recipientsCount = await harness.getRecipientsCount();
      const inputValue = await harness.getRecipientInputValue();
      
      expect(component.recipients).toContain('newUser');
      expect(form.get('recipients')?.value).toContain('newUser');
      expect(recipientsCount).toBe(1);
      expect(inputValue).toBe('');
    });

    it('should not add recipient when input is empty or whitespace', async () => {
      form = new FormGroup({});
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      
      fixture.detectChanges();
      
      const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, GroupChatSettingsHarness);
      
      await harness.setRecipientInputValue('   ');
      await harness.clickAddButton();
      
      expect(component.recipients).toEqual([]);
    });

    it('should not throw or add if recipientInputControl.value is null', () => {
      form = new FormGroup({});
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      fixture.detectChanges();
      component.recipientInputControl.setValue(null);
      expect(() => component.onAddRecipient()).not.toThrow();
      expect(component.recipients).toEqual([]);
      expect(form.get('recipients')?.value).toEqual([]);
    });

    it('should not add duplicate recipient', async () => {
      form = new FormGroup({ recipients: new FormControl(['user1']) });
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      
      fixture.detectChanges();
      
      const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, GroupChatSettingsHarness);
      
      await harness.setRecipientInputValue('user1');
      await harness.clickAddButton();
      
      const recipientsCount = await harness.getRecipientsCount();
      
      expect(component.recipients).toEqual(['user1']);
      expect(recipientsCount).toBe(1);
    });
  });

  describe('onRemoveRecipient', () => {
    it('should remove recipient via UI interaction', async () => {
      form = new FormGroup({ recipients: new FormControl(['user1', 'user2', 'user3']) });
      fixture = TestBed.createComponent(GroupChatSettingsComponent);
      component = fixture.componentInstance;
      component.form = form;
      
      fixture.detectChanges();
      
      const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, GroupChatSettingsHarness);
      
      await harness.removeRecipientAtIndex(1);
      
      const recipientsCount = await harness.getRecipientsCount();
      
      expect(component.recipients).toEqual(['user1', 'user3']);
      expect(form.get('recipients')?.value).toEqual(['user1', 'user3']);
      expect(recipientsCount).toBe(2);
    });
  });
});