import { ComponentFixture, TestBed } from '@angular/core/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { Component } from '@angular/core'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'

import { NewMessageIndicatorComponent } from './new-message-indicator.component'

/**
 * Test host that binds unreadCount as an @Input,
 * allowing Angular's change detection to properly trigger for OnPush.
 */
@Component({
  imports: [NewMessageIndicatorComponent],
  template: `<app-new-message-indicator [unreadCount]="count" (scrollClick)="onScroll()"></app-new-message-indicator>`,
})
class TestHostComponent {
  count = 0
  scrollEmitted = false
  onScroll(): void {
    this.scrollEmitted = true
  }
}

describe('NewMessageIndicatorComponent', () => {
  let component: NewMessageIndicatorComponent
  let fixture: ComponentFixture<TestHostComponent>

  beforeEach(async () => {
    const translations = {
      en: require('./src/assets/i18n/en.json'),
      de: require('./src/assets/i18n/de.json')
    }

    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        AngularAcceleratorModule,
        TranslateTestingModule.withTranslations(translations).withDefaultLanguage('en')
      ]
    }).compileComponents()

    fixture = TestBed.createComponent(TestHostComponent)
    fixture.detectChanges()

    const child = fixture.debugElement.children
      .find((el: any) => el.componentInstance instanceof NewMessageIndicatorComponent)
    component = child?.componentInstance!
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  describe('showCount', () => {
    it('should return false when unreadCount is 0', () => {
      expect(component.showCount).toBe(false)
    })

    it('should return true when unreadCount is greater than 0', () => {
      component.unreadCount = 1
      expect(component.showCount).toBe(true)

      component.unreadCount = 5
      expect(component.showCount).toBe(true)
    })
  })

  describe('scrollClick', () => {
    it('should emit scrollClick when button is clicked', () => {
      jest.spyOn(component.scrollClick, 'emit')

      const button = fixture.nativeElement.querySelector('button')
      button.click()
      fixture.detectChanges()

      expect(component.scrollClick.emit).toHaveBeenCalled()
    })
  })

  describe('template', () => {
    it('should display the arrow down icon', () => {
      const icon = fixture.nativeElement.querySelector('.pi-arrow-down')
      expect(icon).toBeTruthy()
    })

    it('should show count badge when unreadCount is positive', () => {
      // Set through the host component to trigger OnPush change detection
      ;(fixture.componentInstance as TestHostComponent).count = 3
      fixture.detectChanges()

      const countBadge = fixture.nativeElement.querySelector('.new-messages-indicator__count')
      expect(countBadge).toBeTruthy()
      expect(countBadge.textContent.trim()).toBe('3')
    })

    it('should hide count badge when unreadCount is 0', () => {
      const countBadge = fixture.nativeElement.querySelector('.new-messages-indicator__count')
      expect(countBadge).toBeFalsy()
    })

    it('should have correct aria-label', () => {
      const button = fixture.nativeElement.querySelector('button')
      expect(button.getAttribute('aria-label')).toBe('Scroll to latest messages')
    })
  })
})