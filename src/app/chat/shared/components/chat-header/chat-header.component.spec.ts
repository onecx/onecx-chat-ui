import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatHeaderComponent } from './chat-header.component';
import { ChatHeaderHarness } from './chat-header.harness';
import { TestbedHarnessEnvironment } from '@onecx/angular-accelerator/testing';

describe('ChatHeaderComponent', () => {
  let component: ChatHeaderComponent;
  let fixture: ComponentFixture<ChatHeaderComponent>;
  let harness: ChatHeaderHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatHeaderComponent],
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
});
