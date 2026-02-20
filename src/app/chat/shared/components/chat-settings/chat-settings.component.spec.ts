import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatSettingsComponent } from './chat-settings.component';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslateTestingModule } from 'ngx-translate-testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChatSettingsHarness } from './chat-settings.harness';
import { ChatType } from 'src/app/shared/generated';

describe('ChatSettingsComponent', () => {
  let component: ChatSettingsComponent;
  let fixture: ComponentFixture<ChatSettingsComponent>;
  let harness: ChatSettingsHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatSettingsComponent,
        ReactiveFormsModule,
        TranslateTestingModule.withTranslations(
          'en',
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
          require('./../../../../../assets/i18n/en.json'),
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        ).withTranslations('de', require('./../../../../../assets/i18n/de.json')),
      ],
    }).compileComponents();
  });

  beforeEach(async () => {
    fixture = TestBed.createComponent(ChatSettingsComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
    fixture.detectChanges();
    harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, ChatSettingsHarness);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize chatForm on ngOnInit', () => {
    expect(component.chatForm).toBeTruthy();
    expect(component.chatForm).toBeInstanceOf(FormGroup);
  });

  it('should mark all controls as touched and not emit if form is invalid on onCreate', async () => {
    const emitSpy = jest.spyOn(component.create, 'emit');
    component.chatForm.addControl('testControl', new FormControl('', Validators.required));
    
    // Call onCreate directly since button is disabled when form is invalid
    component.onCreate();
    
    expect(component.chatForm.get('testControl')?.touched).toBe(true);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit form value if form is valid on onCreate', async () => {
    const emitSpy = jest.spyOn(component.create, 'emit');
    
    await harness.clickCreateButton();
    
    expect(emitSpy).toHaveBeenCalledWith({ chatName: '' });
  });

  it('should emit data with both recipients and recipientInput', async () => {
    component.chatForm.addControl('recipients', new FormControl(['user1']));
    component.chatForm.addControl('recipientInput', new FormControl('user2@test.com'));
    
    const emitSpy = jest.spyOn(component.create, 'emit');

    await harness.clickCreateButton();
    
    expect(emitSpy).toHaveBeenCalledWith({ 
      chatName: '',
      recipients: ['user1'],
      recipientInput: 'user2@test.com'
    });
  });

  it('should have default settingsType as ai', () => {
    expect(component.settingsType).toBe(ChatType.AiChat);
  });

  describe('Layout based on chat type', () => {
    it('should always show SharedChatSettingsComponent regardless of settingsType', () => {
      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('app-shared-chat-settings')).toBeTruthy();
    });

    it('should not show type-specific components when settingsType is "ai"', () => {
      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('app-direct-chat-settings')).toBeFalsy();
      expect(compiled.querySelector('app-group-chat-settings')).toBeFalsy();
    });
  });

  describe('Create button behavior', () => {
    it('should emit empty object when onCreate is called with empty form', async () => {
      const emitSpy = jest.spyOn(component.create, 'emit');

      await harness.clickCreateButton();
      
      expect(emitSpy).toHaveBeenCalledWith({ chatName: '' });
    });

    it('should have form validity based on controls', () => {
      // Empty form is valid
      expect(component.chatForm.valid).toBe(true);
      
      // Add required control - form becomes invalid
      component.chatForm.addControl('testControl', new FormControl('', Validators.required));
      expect(component.chatForm.invalid).toBe(true);
      
      // Fill the control - form becomes valid
      component.chatForm.get('testControl')?.setValue('test');
      expect(component.chatForm.valid).toBe(true);
    });
  });
});
