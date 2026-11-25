import { ComponentFixture, TestBed } from '@angular/core/testing'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { provideTranslateTestingService } from '@onecx/angular-testing'

import { Chat, ChatType } from 'src/app/shared/generated'
import { ChatListComponent } from './chat-list.component'

describe('ChatListComponent', () => {
  let component: ChatListComponent
  let fixture: ComponentFixture<ChatListComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatListComponent, AngularAcceleratorModule],
      providers: [
        provideTranslateTestingService({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        })
      ]
    }).compileComponents()

    fixture = TestBed.createComponent(ChatListComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  describe('onChange', () => {
    it('should emit chatSelected when onChange is called', () => {
      const testChat: Chat = {
        id: '1',
        topic: 'Test Chat',
        type: ChatType.AiChat,
        participants: []
      }

      jest.spyOn(component.chatSelected, 'emit')

      component.onChange({ value: testChat })

      expect(component.chatSelected.emit).toHaveBeenCalledWith(testChat)
    })

    it('should emit chatSelected with different chat types', () => {
      const humanChat: Chat = {
        id: '2',
        topic: 'Human Chat',
        type: ChatType.HumanDirectChat,
        participants: []
      }

      jest.spyOn(component.chatSelected, 'emit')

      component.onChange({ value: humanChat })

      expect(component.chatSelected.emit).toHaveBeenCalledWith(humanChat)
    })

    it('should handle chat with undefined properties', () => {
      const partialChat: Chat = {
        id: '3',
        topic: 'Partial Chat',
        type: ChatType.AiChat,
        participants: undefined
      }

      jest.spyOn(component.chatSelected, 'emit')

      component.onChange({ value: partialChat })

      expect(component.chatSelected.emit).toHaveBeenCalledWith(partialChat)
    })
  })
})
