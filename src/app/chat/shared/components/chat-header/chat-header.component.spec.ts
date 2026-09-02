import { ComponentFixture, TestBed } from '@angular/core/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'

import { ChatHeaderComponent } from './chat-header.component'

describe('ChatHeaderComponent', () => {
  let component: ChatHeaderComponent
  let fixture: ComponentFixture<ChatHeaderComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatHeaderComponent,
        TranslateTestingModule.withTranslations({
          en: require('./src/assets/i18n/en.json'),
          de: require('./src/assets/i18n/de.json')
        }).withDefaultLanguage('en')
      ]
    }).compileComponents()
    fixture = TestBed.createComponent(ChatHeaderComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should display the title', async () => {
    component.title = 'Test Title'
    fixture.componentRef.setInput('title', 'Test Title')
    fixture.detectChanges()
    await fixture.whenStable()

    const titleEl = fixture.nativeElement.querySelector('.chat-title')
    expect(titleEl?.textContent?.trim()).toContain('Test Title')
  })

  it('should emit closed event when close button is clicked', () => {
    component.showClose = true
    fixture.detectChanges()
    jest.spyOn(component.closed, 'emit')

    fixture.nativeElement.querySelector('#chat_header_close_button button')?.click()
    fixture.detectChanges()

    expect(component.closed.emit).toHaveBeenCalled()
  })

  it('should emit backClicked event when back button is clicked', async () => {
    fixture.componentRef.setInput('showBack', true)
    fixture.componentRef.setInput('showClose', false)
    await fixture.whenStable()
    fixture.detectChanges()
    jest.spyOn(component.backClicked, 'emit')

    fixture.nativeElement.querySelector('#chat_header_back_button button')?.click()
    fixture.detectChanges()

    expect(component.backClicked.emit).toHaveBeenCalled()
  })

  it('should not show settings button by default (showSettings=false)', () => {
    const compiled = fixture.nativeElement as HTMLElement
    expect(compiled.querySelector('#chat_header_settings_button')).toBeFalsy()
  })

  it('should emit settingsClicked event when settings button is clicked', async () => {
    fixture.componentRef.setInput('showSettings', true)
    fixture.componentRef.setInput('showClose', false)
    await fixture.whenStable()
    fixture.detectChanges()
    jest.spyOn(component.settingsClicked, 'emit')

    fixture.nativeElement.querySelector('#chat_header_settings_button button')?.click()
    fixture.detectChanges()

    expect(component.settingsClicked.emit).toHaveBeenCalled()
  })

  it('should render a custom back button aria label when provided', () => {
    fixture.componentRef.setInput('showBack', true)
    fixture.componentRef.setInput('showClose', false)
    fixture.componentRef.setInput('backLabelKey', 'CHAT.HEADER.BACK_TO_CHAT')
    fixture.detectChanges()

    const button = fixture.nativeElement.querySelector('#chat_header_back_button button')

    expect(button?.getAttribute('aria-label')).toBe('Go to Chat')
  })
})
