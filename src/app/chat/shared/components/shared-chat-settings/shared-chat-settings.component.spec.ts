import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { SharedChatSettingsComponent } from './shared-chat-settings.component';
import { TranslateTestingModule } from 'ngx-translate-testing';

describe('SharedChatSettingsComponent', () => {
  let component: SharedChatSettingsComponent;
  let fixture: ComponentFixture<SharedChatSettingsComponent>;
  let form: FormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SharedChatSettingsComponent,
        ReactiveFormsModule,
        TranslateTestingModule.withTranslations({
          'en': require('./src/assets/i18n/en.json'),
          'de': require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    form = new FormGroup({});
    fixture = TestBed.createComponent(SharedChatSettingsComponent);
    component = fixture.componentInstance;
    component.form = form;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should add chatName control on init if not present', () => {
      expect(form.contains('chatName')).toBe(false);
      component.ngOnInit();
      expect(form.contains('chatName')).toBe(true);
      expect(form.get('chatName')).toBeInstanceOf(FormControl);
    });

    it('should not overwrite chatName if already present', () => {
      const existing = new FormControl('existing name');
      form.addControl('chatName', existing);
      component.ngOnInit();
      expect(form.get('chatName')).toBe(existing);
      expect(form.get('chatName')?.value).toBe('existing name');
    });
  });

  describe('ngOnDestroy', () => {
    it('should remove chatName control on destroy if present', () => {
      component.ngOnInit();
      expect(form.contains('chatName')).toBe(true);
      component.ngOnDestroy();
      expect(form.contains('chatName')).toBe(false);
    });

    it('should not throw if chatName not present on destroy', () => {
      expect(form.contains('chatName')).toBe(false);
      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('should handle undefined form (covers this.form?.contains)', () => {
      component.form = undefined as any;
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('chatNameControl', () => {
    it('should return the chatName control', () => {
      component.ngOnInit();
      expect(component.chatNameControl).toBe(form.get('chatName'));
    });
  });
});
