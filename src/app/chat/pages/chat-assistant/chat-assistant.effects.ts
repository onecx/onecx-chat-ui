import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { routerNavigatedAction } from '@ngrx/router-store';
import { Store } from '@ngrx/store';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import { UserService } from '@onecx/angular-integration-interface';
import { ChatInternalService } from 'src/app/shared/services/chat-internal.service';
import {
  ChatsService,
  ChatType,
  MessageType,
} from '../../../shared/generated';
import { ChatAssistantActions } from './chat-assistant.actions';
import { chatAssistantSelectors } from './chat-assistant.selectors';

const PAGE_SIZE = 20;
const CHAT_TOPIC_LENGTH = 30;

@Injectable()
export class ChatAssistantEffects {
  constructor(
    private readonly actions$: Actions,
    private readonly _remoteChatInternalService: ChatInternalService,
    private readonly _chatInternalService: ChatsService,
    private readonly router: Router,
    private readonly store: Store,
    private readonly userService: UserService,
  ) { }

  get chatInternalService() {
    return (
      this._remoteChatInternalService.getService() ?? this._chatInternalService
    );
  }

  loadUserProfile$ = createEffect(() => {
    return this.userService.profile$.pipe(
      filter((profile) => !!profile?.person?.email),
      map(({ person }) => {
        const user = person.email as string;
        return ChatAssistantActions.userProfileLoaded({ user });
      }),
    );
  });

  initChatOnNavigation$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(routerNavigatedAction),
      concatLatestFrom(() => [
        this.store.select(chatAssistantSelectors.selectChatInitialized),
      ]),
      filter(([action, chatInitialized]) => !chatInitialized),
      switchMap(() => {
        return of(ChatAssistantActions.chatInitialized());
      }),
    );
  });

  triggerLoadChats$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(
        ChatAssistantActions.chatInitialized,
        ChatAssistantActions.chatCreationSuccessful,
        ChatAssistantActions.searchQueryChanged,
      ),
      switchMap(() => of(ChatAssistantActions.loadChats({ reset: true })))
    );
  });

  triggerLoadNextPage$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.fetchNextChatsPage),
      switchMap(() => of(ChatAssistantActions.loadChats({ reset: false })))
    );
  });

  loadChats$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.loadChats),
      concatLatestFrom(() => [
        this.store.select(chatAssistantSelectors.selectChats),
        this.store.select(chatAssistantSelectors.selectTotalAvailableChats),
        this.store.select(chatAssistantSelectors.selectSearchQuery),
      ]),
      filter(([action, chats, totalAvailableChats]) =>
        action.reset ||
        totalAvailableChats == undefined ||
        chats.length < totalAvailableChats
      ),
      switchMap(([action, chats, , searchQuery]) => {
        const pageNumber = action.reset ? 0 : Math.floor(chats.length / PAGE_SIZE);
        const append = !action.reset;
        const topic = searchQuery?.trim() ? `%${searchQuery.trim()}%` : undefined;
        return this.chatInternalService.searchChats({
          topic,
          pageNumber,
          pageSize: PAGE_SIZE,
        }).pipe(
          map((response) => {
            return ChatAssistantActions.chatsLoaded({
              chats: response.stream ?? [],
              totalElements: response.totalElements ?? 0,
              append,
            });
          }),
          catchError((error) =>
            of(
              ChatAssistantActions.chatsLoadingFailed({
                error,
              }),
            ),
          ),
        );
      }),
    );
  });

  loadAvailableMessages$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(
        ChatAssistantActions.chatSelected,
        ChatAssistantActions.messageSendingSuccessful,
      ),
      concatLatestFrom(() => [
        this.store.select(chatAssistantSelectors.selectCurrentChat),
      ]),
      filter(([, chat]) => chat?.id !== undefined && chat.id !== 'new'),
      switchMap(([, chat]) => {
        return this.chatInternalService.getChatMessages(chat?.id ?? '').pipe(
          map((response) => {
            return ChatAssistantActions.messagesLoaded({
              messages: response,
            });
          }),
          catchError((error) =>
            of(
              ChatAssistantActions.messagesLoadingFailed({
                error,
              }),
            ),
          ),
        );
      }),
    );
  });

  deleteChat$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.deleteChatClicked),
      filter(({ chat }) => chat?.id !== undefined && chat.id !== 'new'),
      switchMap(({ chat }) => {
        return this.chatInternalService.deleteChat(chat?.id ?? '').pipe(
          map(() => {
            return ChatAssistantActions.chatDeletionSuccessful({
              chatId: chat?.id ?? '',
            });
          }),
          catchError((error) =>
            of(
              ChatAssistantActions.chatDeletionFailed({
                error,
              }),
            ),
          ),
        );
      }),
    );
  });

  updateChatTopic$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.updateCurrentChatTopic),
      concatLatestFrom(() => [
        this.store.select(chatAssistantSelectors.selectCurrentChat),
      ]),
      filter(([, chat]) => chat?.id !== undefined && chat.id !== 'new'),
      switchMap(([action, chat]) => {
        return this.chatInternalService
          .updateChat(chat?.id ?? '', {
            topic: action.topic,
          })
          .pipe(
            map((updatedChat) => {
              return ChatAssistantActions.chatCreationSuccessful({
                chat: updatedChat,
              });
            }),
            catchError((error) =>
              of(
                ChatAssistantActions.chatCreationFailed({
                  error,
                }),
              ),
            ),
          );
      }),
    );
  });

  createChat$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.chatCreated),
      concatLatestFrom(() => [
        this.store.select(chatAssistantSelectors.selectUser),
        this.store.select(chatAssistantSelectors.selectTopic),
      ]),
      filter(([, user]) => user !== undefined),
      switchMap(([, user, topic]) => {
        return this.createChat(user as string, topic).pipe(
          map((chat) => {
            return ChatAssistantActions.chatCreationSuccessful({
              chat,
            });
          }),
          catchError((error) =>
            of(
              ChatAssistantActions.chatCreationFailed({
                error,
              }),
            ),
          ),
        );
      }),
    );
  });

  createChatAndSendMessage$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.createNewChatForMessage),
      concatLatestFrom(() => [
        this.store.select(chatAssistantSelectors.selectUser),
        this.store.select(chatAssistantSelectors.selectTopic),
        this.store.select(chatAssistantSelectors.selectCurrentChat),
      ]),
      filter(([, user]) => user !== undefined),
      switchMap(([action, user, topic, currentChat]) => {
        const messageExtract =
          action.message.length > CHAT_TOPIC_LENGTH
            ? action.message.substring(0, CHAT_TOPIC_LENGTH) + '...'
            : action.message;
        const chatTopic = `${topic}: ${messageExtract}`;
        const chatType = currentChat?.type ?? ChatType.AiChat;
        return this.createChat(user as string, chatTopic, chatType).pipe(
          switchMap((chat) =>
            of(
              ChatAssistantActions.chatCreationSuccessful({ chat }),
              ChatAssistantActions.messageSent({ message: action.message }),
            )
          ),
          catchError((error) =>
            of(
              ChatAssistantActions.chatCreationFailed({
                error,
              }),
            ),
          ),
        );
      }),
    );
  });

  createChat = (userEmail: string, topic: string, chatType: ChatType = ChatType.AiChat) => {
    return this.chatInternalService.createChat({
      type: chatType,
      topic: topic,
      participants: [userEmail],
    });
  };

  sendMessage$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(
        ChatAssistantActions.messageSent,
      ),
      concatLatestFrom(() => [
        this.store.select(chatAssistantSelectors.selectCurrentChat),
      ]),
      switchMap(([action, chat]) => {
        if (!chat?.id || chat.id === 'new') {
          return of(
            ChatAssistantActions.createNewChatForMessage({
              message: action.message,
            }),
          );
        }
        return this.chatInternalService
          .createChatMessage(chat.id, {
            type: MessageType.Human,
            text: action.message,
          })
          .pipe(
            map((message) =>
              ChatAssistantActions.messageSendingSuccessful({
                message,
              }),
            ),
            catchError((error) =>
              of(
                ChatAssistantActions.messageSendingFailed({
                  message: action.message,
                  error,
                }),
              ),
            ),
          );
      }),
    );
  });
}