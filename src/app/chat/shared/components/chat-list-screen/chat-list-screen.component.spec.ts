import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatListScreenComponent } from './chat-list-screen.component';
import { ChatHeaderComponent } from '../chat-header/chat-header.component';
import { ChatOptionButtonComponent } from '../chat-option-button/chat-option-button.component';
import { By } from '@angular/platform-browser';
import { AppStateService } from '@onecx/portal-integration-angular';
import { of, firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TranslateTestingModule } from 'ngx-translate-testing';
import { TranslateService } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { provideMockStore } from '@ngrx/store/testing';
import { selectFilteredChats, chatAssistantSelectors } from 'src/app/chat/pages/chat-assistant/chat-assistant.selectors';
import { Store } from '@ngrx/store';
import { ChatAssistantActions } from 'src/app/chat/pages/chat-assistant/chat-assistant.actions';
import { ChatType } from 'src/app/shared/generated';

describe('ChatListScreenComponent', () => {
  let component: ChatListScreenComponent;
  let fixture: ComponentFixture<ChatListScreenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatListScreenComponent,
        ChatHeaderComponent,
        ChatOptionButtonComponent,
        ButtonModule,
        TranslateTestingModule.withTranslations(
          'en',
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
          require('../../../../../assets/i18n/en.json'),
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        ).withTranslations('de', require('../../../../../assets/i18n/de.json')),
      ],
      providers: [
        DatePipe,
        {
          provide: AppStateService,
          useValue: {
            currentMfe$: of({ remoteBaseUrl: 'http://localhost/workspace' }),
          },
        },
        provideMockStore({
          selectors: [
            { selector: selectFilteredChats, value: [] },
            { selector: chatAssistantSelectors.selectSearchQuery, value: '' },
          ],
        }),
      ],
    }).compileComponents();

    // Mock MutationObserver
    const mutationObserverMock = jest.fn(function MutationObserver(callback) {
      this.observe = jest.fn();
      this.disconnect = jest.fn();
      this.trigger = (mockedMutationsList: any) => {
        callback(mockedMutationsList, this);
      };
      return this;
    });
    global.MutationObserver = mutationObserverMock as any;

    fixture = TestBed.createComponent(ChatListScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const translateService = TestBed.inject(TranslateService);
    translateService.use('en');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

    it('should emit selectMode when AI Companion type is selected', () => {
      jest.spyOn(component.selectMode, 'emit');

      component.onChatModeChange(ChatType.AiChat);

      expect(component.selectMode.emit).toHaveBeenCalledWith(ChatType.AiChat);
    });

    it('should emit selectMode when Direct Chat type is selected', () => {
      jest.spyOn(component.selectMode, 'emit');

      component.onChatModeChange(ChatType.HumanDirectChat);

      expect(component.selectMode.emit).toHaveBeenCalledWith(ChatType.HumanDirectChat);
    });

    it('should emit selectMode when Group Chat type is selected', () => {
      jest.spyOn(component.selectMode, 'emit');

      component.onChatModeChange(ChatType.HumanGroupChat);
      
      expect(component.selectMode.emit).toHaveBeenCalledWith(ChatType.HumanGroupChat);
    });

  it('should emit selectMode with "close" when header close is clicked', () => {
    jest.spyOn(component.selectMode, 'emit');
    const header = fixture.debugElement.query(
      By.directive(ChatHeaderComponent),
    );
    header.triggerEventHandler('closed', null);
    expect(component.selectMode.emit).toHaveBeenCalledWith('close');
  });

  it('should initialize items array in ngOnInit', () => {
    component.ngOnInit();
    expect(component.items).toBeDefined();
    expect(component.items?.length).toBe(1);
    expect(component.items?.[0].label).toBe('Delete');
  });

  it('should emit deleteChat when Delete context menu item is clicked', () => {
    jest.spyOn(component.deleteChat, 'emit');
    const testChat = { id: 'chat1', topic: 'Test Chat' } as any;
    component.selectedChat = testChat;
    component.ngOnInit();

    component.onContextMenu(new MouseEvent('contextmenu'), testChat);
    component.items?.[0].command!({
      originalEvent: new MouseEvent('click'),
      item: component.items[0],
    });

    expect(component.deleteChat.emit).toHaveBeenCalledWith(testChat);
  });

  it('should reset selectedChat on onHide', () => {
    component.selectedChat = { id: 'chat1', topic: 'Test Chat' } as any;

    component.onHide();

    expect(component.selectedChat).toBeNull();
  });

  it('should display chat list when chats are provided', () => {
    fixture.componentRef.setInput('chats', [
      { id: 'chat1', topic: 'Chat 1' } as any,
      { id: 'chat2', topic: 'Chat 2' } as any,
    ]);
    fixture.detectChanges();

    expect(component.chats().length).toBe(2);
  });

  it('should emit chatSelected when a chat item is clicked', () => {
    jest.spyOn(component.chatSelected, 'emit');
    const testChat = { id: 'chat1', topic: 'Test Chat' } as any;

    component.chatSelected.emit(testChat);

    expect(component.chatSelected.emit).toHaveBeenCalledWith(testChat);
  });

  it('formattedTimes$ maps modificationDate to shortTime for recent messages', async () => {
    const now = new Date();
    const iso = now.toISOString();
    fixture.componentRef.setInput('chats', [{ id: 'c1', modificationDate: iso } as any]);
    fixture.detectChanges();

    const datePipe = TestBed.inject(DatePipe);
    const expected = datePipe.transform(now, 'shortTime') || '';

    const map = await firstValueFrom(component.formattedTimes$);
    expect(map[iso]).toBe(expected);
  });

  describe('formatLastMessageTime', () => {
    let datePipe: DatePipe;

    beforeEach(() => {
      datePipe = TestBed.inject(DatePipe);
    });

    it('should return shortTime format for messages less than 1 day old', (done) => {
      const now = new Date();
      const oneHourAgoDate = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourAgo = oneHourAgoDate.toISOString();
      const expected = datePipe.transform(oneHourAgoDate, 'shortTime') || '';

      component.formatLastMessageTime(oneHourAgo).subscribe(result => {
        expect(result).toBe(expected);
        done();
      });
    });

    it('should return "Yesterday" for messages from yesterday', (done) => {
      const now = new Date();
      const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterday = yesterdayDate.toISOString();

      component.formatLastMessageTime(yesterday).subscribe(result => {
        expect(result).toBe('Yesterday');
        done();
      });
    });

    it('should return day name for messages from 2-7 days ago', (done) => {
      const now = new Date();
      const threeDaysAgoDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = threeDaysAgoDate.toISOString();
      const dayName = datePipe.transform(threeDaysAgoDate, 'EEEE') || '';

      component.formatLastMessageTime(threeDaysAgo).subscribe(result => {
        expect(result).toBe(dayName);
        done();
      });
    });

    it('should return empty string when datePipe.transform returns empty for time format', (done) => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

      jest.spyOn(component['datePipe'], 'transform').mockReturnValue(null);
      component.formatLastMessageTime(oneHourAgo).subscribe(result => {
        expect(result).toBe('');
        done();
      });
    });

    it('should return empty string when datePipe.transform returns empty for day name', (done) => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

      jest.spyOn(component['datePipe'], 'transform').mockReturnValue(null);
      component.formatLastMessageTime(twoDaysAgo).subscribe(result => {
        expect(result).toBe('');
        done();
      });
    });

    it('should return empty string when datePipe.transform returns empty for date format', (done) => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

      jest.spyOn(component['datePipe'], 'transform').mockReturnValue(null);
      component.formatLastMessageTime(tenDaysAgo).subscribe(result => {
        expect(result).toBe('');
        done();
      });
    });
  });

    describe('onSearchQueryChange', () => {
    it('should dispatch ChatAssistantActions.searchQueryChanged with the query', () => {
      const testQuery = 'test search';
      const store = TestBed.inject(Store);
      jest.spyOn(store, 'dispatch');

      component.onSearchQueryChange(testQuery);

      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.searchQueryChanged({ query: testQuery }),
      );
    });

    it('should handle empty query string', () => {
      const store = TestBed.inject(Store);
      jest.spyOn(store, 'dispatch');

      component.onSearchQueryChange('');

      expect(component.searchQueryValue).toBe('');
      expect(store.dispatch).toHaveBeenCalledWith(
        ChatAssistantActions.searchQueryChanged({ query: '' }),
      );
    });
  });

  describe('onChatModeChange', () => {
    it('should emit selectMode when mode changes', () => {
      jest.spyOn(component.selectMode, 'emit');

      component.onChatModeChange(ChatType.HumanDirectChat);

      expect(component.selectMode.emit).toHaveBeenCalledWith(ChatType.HumanDirectChat);
    });
  });
});
