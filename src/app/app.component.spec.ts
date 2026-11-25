import { provideHttpClientTesting } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { provideTranslateTestingService } from '@onecx/angular-testing'

import { AppComponent } from './app.component'

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, AngularAcceleratorModule],
      providers: [
        provideRouter([]),
        provideHttpClientTesting(),
        provideTranslateTestingService({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        })
      ]
    }).compileComponents()

    const mutationObserverMock = jest.fn(function MutationObserver(callback) {
      this.observe = jest.fn()
      this.disconnect = jest.fn()
      this.trigger = (mockedMutationsList: any) => {
        callback(mockedMutationsList, this)
      }
      return this
    })
    global.MutationObserver = mutationObserverMock
    global.origin = ''
  })

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent)
    const app = fixture.componentInstance
    expect(app).toBeTruthy()
  })
})
