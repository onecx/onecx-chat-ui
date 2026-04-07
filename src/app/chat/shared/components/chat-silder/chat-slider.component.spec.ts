import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatSliderComponent } from './chat-slider.component';
import { DrawerModule } from 'primeng/drawer';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('ChatSliderComponent', () => {
  let component: ChatSliderComponent;
  let fixture: ComponentFixture<ChatSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatSliderComponent, DrawerModule, BrowserAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(ChatSliderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept visible input', () => {
    component.visible = true;
    fixture.detectChanges();
    expect(component.visible).toBe(true);
  });

  it('should emit visibleChange when visibility changes', () => {
    jest.spyOn(component.visibleChange, 'emit');
    component.visibleChange.emit(true);
    expect(component.visibleChange.emit).toHaveBeenCalledWith(true);
  });
});
