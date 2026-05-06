import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { provideMockActions } from '@ngrx/effects/testing';
import { routerNavigatedAction, RouterNavigatedPayload } from '@ngrx/router-store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable, of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { PortalMessageService } from '@onecx/angular-integration-interface';
import { DialogState, PortalDialogService } from '@onecx/angular-accelerator';
import { ChatsService, ChatType, MessageType } from '../../../shared/generated';
import { ChatDetailsActions } from './chat-details.actions';
import { ChatDetailsEffects } from './chat-details.effects';
import { chatDetailsSelectors } from './chat-details.selectors';
import { selectBackNavigationPossible } from 'src/app/shared/selectors/onecx.selectors';
import { selectUrl } from 'src/app/shared/selectors/router.selectors';

jest.mock('@onecx/ngrx-accelerator', () => ({
  ...jest.requireActual('@onecx/ngrx-accelerator'),
  filterForNavigatedTo: jest.fn().mockReturnValue((source: Observable<any>) => source),
}));

describe('ChatDetailsEffects', () => {
  let effects: ChatDetailsEffects;
  let actions$: Observable<any>;
  let store: MockStore;
  let chatService: { getChatById: jest.Mock; getChatMessages: jest.Mock; deleteChat: jest.Mock };
  let messageService: jest.Mocked<PortalMessageService>;
  let portalDialogService: jest.Mocked<PortalDialogService>;
  let router: jest.Mocked<Router>;

  const mockChat = {
    id: 'chat-1',
    topic: 'Test Chat',
    type: ChatType.AiChat,
  };

  const mockMessages = [
    { id: 'msg1', text: 'Hello', type: MessageType.Human, creationDate: '2023-01-01T10:00:00Z' },
    { id: 'msg2', text: 'Hi', type: MessageType.Assistant, creationDate: '2023-01-01T10:01:00Z' },
  ];

  const initialState = {
    chat: {
      details: {
        details: mockChat,
        detailsLoadingIndicator: false,
        detailsLoaded: true,
        messages: undefined,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const chatServiceSpy = {
      getChatById: jest.fn(),
      getChatMessages: jest.fn(),
      deleteChat: jest.fn(),
    };

    const messageServiceSpy = {
      success: jest.fn(),
      error: jest.fn(),
    };

    const portalDialogServiceSpy = {
      openDialog: jest.fn(),
    };

    const routerSpy = {
      navigate: jest.fn(),
      parseUrl: jest.fn().mockReturnValue({
        queryParams: {},
        fragment: null,
        toString: jest.fn().mockReturnValue('/app/chat/chat-1'),
      }),
    };
    
    TestBed.configureTestingModule({
      providers: [
        ChatDetailsEffects,
        provideMockActions(() => actions$),
        provideMockStore({ initialState }),
        { provide: ChatsService, useValue: chatServiceSpy },
        { provide: PortalMessageService, useValue: messageServiceSpy },
        { provide: PortalDialogService, useValue: portalDialogServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    effects = TestBed.inject(ChatDetailsEffects);
    actions$ = TestBed.inject(Actions);
    store = TestBed.inject(MockStore);
    chatService = TestBed.inject(ChatsService) as any;
    messageService = TestBed.inject(PortalMessageService) as jest.Mocked<PortalMessageService>;
    portalDialogService = TestBed.inject(PortalDialogService) as jest.Mocked<PortalDialogService>;
    router = TestBed.inject(Router) as jest.Mocked<Router>;
  });

  describe('navigatedToDetailsPage$', () => {
    it('should dispatch navigatedToDetailsPage with id from route params', (done) => {
      const selectSpy = jest.spyOn(store, 'select').mockReturnValue(of('chat-1') as any);

      actions$ = of(routerNavigatedAction({
        payload: {
          routerState: { url: '/chat-details', root: {} as any },
          event: {} as RouterNavigatedPayload['event'],
        },
      }));

      effects.navigatedToDetailsPage$.subscribe((result) => {
        expect(result).toEqual(ChatDetailsActions.navigatedToDetailsPage({ id: 'chat-1' }));
        selectSpy.mockRestore();
        done();
      });
    });
  });

  describe('loadChatById$', () => {
    it('should use empty string when id is undefined (covers id ?? "")', (done) => {
      chatService.getChatById.mockReturnValue(of(mockChat));

      actions$ = of(ChatDetailsActions.navigatedToDetailsPage({ id: undefined }));

      effects.loadChatById$.subscribe(() => {
        expect(chatService.getChatById).toHaveBeenCalledWith('');
        done();
      });
    });

    it('should dispatch chatDetailsLoadingFailed on error', (done) => {
      const error = 'Load error';
      chatService.getChatById.mockReturnValue(throwError(() => error));

      actions$ = of(ChatDetailsActions.navigatedToDetailsPage({ id: 'chat-1' }));

      effects.loadChatById$.subscribe((result) => {
        expect(result).toEqual(ChatDetailsActions.chatDetailsLoadingFailed({ error }));
        done();
      });
    });
  });

  describe('loadAvailableMessages$', () => {
    it('should not emit when chat is undefined (covers chat?.id in filter)', (done) => {
      actions$ = of(ChatDetailsActions.chatDetailsReceived({
        details: undefined as any,
      }));

      effects.loadAvailableMessages$.pipe(take(1)).subscribe({
        next: () => fail('Should not emit'),
        complete: () => {
          expect(chatService.getChatMessages).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should call getChatMessages with empty string when chat.id is null (covers chat?.id ?? "")', (done) => {
      chatService.getChatMessages.mockReturnValue(of(mockMessages));

      actions$ = of(ChatDetailsActions.chatDetailsReceived({
        details: { ...mockChat, id: null as any },
      }));

      effects.loadAvailableMessages$.subscribe(() => {
        expect(chatService.getChatMessages).toHaveBeenCalledWith('');
        done();
      });
    });

    it('should dispatch messagesLoadingFailed on error', (done) => {
      const error = 'Messages error';
      chatService.getChatMessages.mockReturnValue(throwError(() => error));

      actions$ = of(ChatDetailsActions.chatDetailsReceived({ details: mockChat }));

      effects.loadAvailableMessages$.subscribe((result) => {
        expect(result).toEqual(ChatDetailsActions.messagesLoadingFailed({ error }));
        done();
      });
    });
  });

  describe('deleteButtonClicked$', () => {
    it('should dispatch deleteChatSucceeded and show success message on confirm', (done) => {
      const dialogResult: DialogState<unknown> = { button: 'primary', result: undefined };
      store.overrideSelector(chatDetailsSelectors.selectDetails, mockChat);
      store.refreshState();
      portalDialogService.openDialog.mockReturnValue(of(dialogResult));
      chatService.deleteChat.mockReturnValue(of(void 0 as any));

      actions$ = of(ChatDetailsActions.deleteButtonClicked());

      effects.deleteButtonClicked$.subscribe((result) => {
        expect(chatService.deleteChat).toHaveBeenCalledWith('chat-1');
        expect(messageService.success).toHaveBeenCalledWith({ summaryKey: 'CHAT_DETAILS.DELETE.SUCCESS' });
        expect(result).toEqual(ChatDetailsActions.deleteChatSucceeded());
        done();
      });
    });

    it('should dispatch deleteChatCanceled when dialog result is null', (done) => {
      store.overrideSelector(chatDetailsSelectors.selectDetails, mockChat);
      store.refreshState();
      portalDialogService.openDialog.mockReturnValue(of(null as any));

      actions$ = of(ChatDetailsActions.deleteButtonClicked());

      effects.deleteButtonClicked$.subscribe((result) => {
        expect(chatService.deleteChat).not.toHaveBeenCalled();
        expect(result).toEqual(ChatDetailsActions.deleteChatCanceled());
        done();
      });
    });


    it('should throw error when itemToDelete is undefined (covers itemToDelete?.id)', (done) => {
      const dialogResult: DialogState<unknown> = { button: 'primary', result: undefined };
      store.overrideSelector(chatDetailsSelectors.selectDetails, undefined);
      store.refreshState();
      portalDialogService.openDialog.mockReturnValue(of(dialogResult));

      actions$ = of(ChatDetailsActions.deleteButtonClicked());

      effects.deleteButtonClicked$.subscribe({
        error: (err) => {
          expect(err.message).toBe('Item to delete not found!');
          done();
        },
      });
    });

    it('should dispatch deleteChatFailed and show error message on delete error', (done) => {
      const dialogResult: DialogState<unknown> = { button: 'primary', result: undefined };
      const error = 'Delete error';
      store.overrideSelector(chatDetailsSelectors.selectDetails, mockChat);
      store.refreshState();
      portalDialogService.openDialog.mockReturnValue(of(dialogResult));
      chatService.deleteChat.mockReturnValue(throwError(() => error));

      actions$ = of(ChatDetailsActions.deleteButtonClicked());

      effects.deleteButtonClicked$.subscribe((result) => {
        expect(messageService.error).toHaveBeenCalledWith({ summaryKey: 'CHAT_DETAILS.DELETE.ERROR' });
        expect(result).toEqual(ChatDetailsActions.deleteChatFailed({ error }));
        done();
      });
    });
  });

  describe('deleteChatSucceeded$', () => {
    it('should navigate to parent URL after delete succeeded', (done) => {
      store.overrideSelector(selectUrl, '/app/chat/chat-1/details');
      store.refreshState();

      const mockUrlTree = {
        queryParams: {},
        fragment: null as string | null,
        toString: jest.fn().mockReturnValue('/app/chat/chat-1/details'),
      };
      router.parseUrl.mockReturnValue(mockUrlTree as any);

      actions$ = of(ChatDetailsActions.deleteChatSucceeded());

      effects.deleteChatSucceeded$.pipe(take(1)).subscribe({
        complete: () => {
          expect(router.parseUrl).toHaveBeenCalledWith('/app/chat/chat-1/details');
          expect(mockUrlTree.queryParams).toEqual({});
          expect(mockUrlTree.fragment).toBeNull();
          expect(router.navigate).toHaveBeenCalledWith(['/app/chat']);
          done();
        },
      });
    });
  });

  describe('displayError$', () => {
    it('should call messageService.error when chatDetailsLoadingFailed action is dispatched', (done) => {
      actions$ = of(ChatDetailsActions.chatDetailsLoadingFailed({ error: 'some error' }));

      effects.displayError$.pipe(take(1)).subscribe({
        complete: () => {
          expect(messageService.error).toHaveBeenCalledWith({
            summaryKey: 'CHAT_DETAILS.ERROR_MESSAGES.DETAILS_LOADING_FAILED',
          });
          done();
        },
      });
    });
  });

  describe('navigateBack$', () => {
    it('should dispatch backNavigationStarted and call globalThis.history.back() when navigation possible', (done) => {
      store.overrideSelector(selectBackNavigationPossible, true);
      store.refreshState();

      const historySpy = jest.spyOn(globalThis.history, 'back').mockImplementation(() => {
        // empty implementation
      });

      actions$ = of(ChatDetailsActions.navigateBackButtonClicked());

      effects.navigateBack$.subscribe((result) => {
        expect(historySpy).toHaveBeenCalled();
        expect(result).toEqual(ChatDetailsActions.backNavigationStarted());
        historySpy.mockRestore();
        done();
      });
    });

    it('should dispatch backNavigationFailed when navigation not possible', (done) => {
      store.overrideSelector(selectBackNavigationPossible, false);
      store.refreshState();

      actions$ = of(ChatDetailsActions.navigateBackButtonClicked());

      effects.navigateBack$.subscribe((result) => {
        expect(result).toEqual(ChatDetailsActions.backNavigationFailed());
        done();
      });
    });
  });
});
