import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { routerNavigatedAction } from '@ngrx/router-store';
import { Store } from '@ngrx/store';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import { ChatInternalService } from 'src/app/shared/services/chat-internal.service';
import {
  ChatsInternal,
  ChatType,
  MessageType,
  ParticipantType,
} from '../../../shared/generated';
import { ChatAssistantActions } from './chat-assistant.actions';
import { chatAssistantSelectors } from './chat-assistant.selectors';
import { ChatUser } from './chat-assistant.state';

const CHAT_TOPIC_LENGTH = 30;

@Injectable()
export class ChatAssistantEffects {
  constructor(
    private actions$: Actions,
    private _remoteChatInternalService: ChatInternalService,
    private _chatInternalService: ChatsInternal,
    private router: Router,
    private store: Store,
  ) { }

  get chatInternalService() {
    return (
      this._remoteChatInternalService.getService() ?? this._chatInternalService
    );
  }

  chatInitialized = createEffect(() => {
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

  loadAvailableChats$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(
        ChatAssistantActions.chatInitialized,
        ChatAssistantActions.chatPanelOpened,
        ChatAssistantActions.chatCreationSuccessful,
        ChatAssistantActions.messageSentForNewChat,
        ChatAssistantActions.chatDeletionSuccessful,
        ChatAssistantActions.chatDeletionFailed,
      ),
      switchMap(() => {
        return this.chatInternalService.getChats().pipe(
          map((response) => {
            return ChatAssistantActions.chatsLoaded({
              chats: response.stream ?? [],
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
        return this.createChat(user as ChatUser, topic).pipe(
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
      ]),
      filter(([, user]) => user !== undefined),
      switchMap(([action, user, topic]) => {
        const messageExtract =
          action.message.length > CHAT_TOPIC_LENGTH
            ? action.message.substring(0, CHAT_TOPIC_LENGTH) + '...'
            : action.message;
        const chatTopic = `${topic}: ${messageExtract}`;
        return this.createChat(user as ChatUser, chatTopic).pipe(
          map((chat) =>
            ChatAssistantActions.messageSentForNewChat({
              chat,
              message: action.message,
            }),
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

  createChat = (user: ChatUser, topic: string) => {
    return this.chatInternalService.createChat({
      type: ChatType.AiChat,
      topic: topic,
      participants: [
        {
          type: ParticipantType.Human,
          userId: user.userId,
          userName: user.userName,
          email: user.email,
        },
      ],
    });
  };

  sendMessage$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(
        ChatAssistantActions.messageSent,
        ChatAssistantActions.messageSentForNewChat,
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