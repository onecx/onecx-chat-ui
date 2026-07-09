import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatHeaderComponent } from './chat-header.component';
import { ChatHeaderHarness } from './chat-header.harness';
import { TestbedHarnessEnvironment } from '@onecx/angular-accelerator/testing';
import { TranslateTestingModule } from 'ngx-translate-testing';

describe('ChatHeaderComponent', () => {
  let component: ChatHeaderComponent;
  let fixture: ComponentFixture<ChatHeaderComponent>;
  let harness: ChatHeaderHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatHeaderComponent,
        TranslateTestingModule.withTranslations({
          'en': require('./src/assets/i18n/en.json'),
          'de': require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ChatHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, ChatHeaderHarness);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the title', async () => {
    component.title = 'Test Title';
    fixture.detectChanges();
    
    const titleEl = await harness.getTitleText();

    expect(titleEl).toContain('Test Title');
  });

  it('should emit closed event when close button is clicked', async () => {
    component.showClose = true;
    fixture.detectChanges();
    jest.spyOn(component.closed, 'emit');
    
    await harness.clickCloseButton();

    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('should emit backClicked event when back button is clicked', async () => {
    component.showBack = true;
    component.showClose = false;
    fixture.detectChanges();
    jest.spyOn(component.backClicked, 'emit');

    await harness.clickBackButton();

    expect(component.backClicked.emit).toHaveBeenCalled();
  });

  it('should not show settings button by default (showSettings=false)', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#chat_header_settings_button')).toBeFalsy();
  });

  it('should emit settingsClicked event when settings button is clicked', async () => {
    component.showSettings = true;
    component.showClose = false;
    fixture.detectChanges();
    jest.spyOn(component.settingsClicked, 'emit');

    await harness.clickSettingsButton();

    expect(component.settingsClicked.emit).toHaveBeenCalled();
  });
});
