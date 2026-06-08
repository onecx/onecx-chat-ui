import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { routerNavigatedAction } from '@ngrx/router-store';
import { Store } from '@ngrx/store';
import { UserService } from '@onecx/angular-integration-interface';
import { catchError, combineLatestWith, filter, map, of, switchMap } from 'rxjs';
import { ChatInternalService } from 'src/app/shared/services/chat-internal.service';
import { parseChatNotification } from 'src/app/shared/utils/notification.utils';
import {
  Chat,
  ChatsService,
  ChatType,
  MessageType,
} from 'src/app/shared/generated';
import { ChatAssistantActions } from './chat-assistant.actions';
import { chatAssistantSelectors, selectChatTopic } from './chat-assistant.selectors';

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
        ChatAssistantActions.backButtonClicked,
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
      ofType(
        ChatAssistantActions.loadChats,
        ChatAssistantActions.refreshChatList
      ),
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

  handleChatNotifications$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.notificationReceived),
      filter(({ notification }) => !!notification && notification.body.applicationId === 'onecx-chat'),
      combineLatestWith(this.store.select(chatAssistantSelectors.selectCurrentChat)),
      map(([{ notification }, currentChat]) => {
        const parsed = parseChatNotification(notification);
        if (parsed?.type === 'update_chat') {
          if (currentChat?.id === parsed.chatId) {
            return ChatAssistantActions.refreshCurrentChat();
          }
          return ChatAssistantActions.refreshChatList({ reset: true });
        }
        return ChatAssistantActions.chatNotificationIgnored();
      }),
    );
  });


  loadAvailableMessages$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(
        ChatAssistantActions.chatSelected,
        ChatAssistantActions.messageSendingSuccessful,
        ChatAssistantActions.refreshCurrentChat,
      ),
      concatLatestFrom(() => [
        this.store.select(chatAssistantSelectors.selectCurrentChat),
      ]),
      filter(([, chat]) => chat?.id !== undefined && chat.id !== 'new'),
      switchMap(([, chat]) => {
        return this.chatInternalService.getChatMessages(chat!.id ?? '').pipe(
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
        return this.chatInternalService.deleteChat(chat!.id ?? '').pipe(
          map(() => {
            return ChatAssistantActions.chatDeletionSuccessful({
              chatId: chat!.id ?? '',
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

  saveSettings$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.saveSettingsClicked),
      concatLatestFrom(() => this.store.select(chatAssistantSelectors.selectCurrentChat)),
      filter(([, currentChat]) => !!currentChat),
      map(([action, currentChat]) => {
        const payload: Partial<Chat> = {
          ...currentChat,
          topic: action.chatName ?? currentChat!.topic ?? '',
        };
        return ChatAssistantActions.updateCurrentChat({ chat: payload });
      }),
    );
  });

  updateCurrentChat$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ChatAssistantActions.updateCurrentChat),
      concatLatestFrom(() => [this.store.select(chatAssistantSelectors.selectCurrentChat)]),
      filter(([, chat]) => chat?.id !== undefined && chat.id !== 'new'),
      switchMap(([action, chat]) => {
        const updatedChat = { ...chat, ...action.chat } as Chat;
        return this.chatInternalService.updateChat(chat!.id ?? '', action.chat).pipe(
          map(() => ChatAssistantActions.chatUpdateSuccessful({ chat: updatedChat })),
          catchError((error) =>
            of(
              ChatAssistantActions.chatUpdateFailed({
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
        this.store.select(chatAssistantSelectors.selectCurrentChat),
        this.store.select(selectChatTopic),
        this.store.select(chatAssistantSelectors.selectSelectedChatMode),
      ]),
      filter(([, user]) => user !== undefined),
      switchMap(([action, user, currentChat, chatTopic, selectedChatMode]) => {
        const messageExtract =
          action.message.length > CHAT_TOPIC_LENGTH
            ? action.message.substring(0, CHAT_TOPIC_LENGTH) + '...'
            : action.message;
        const chatType = currentChat?.type ?? selectedChatMode;
        return this.createChat(user as string, chatTopic, chatType as ChatType, messageExtract).pipe(
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

  createChat(
    userEmail: string,
    topic: string,
    chatType: ChatType = ChatType.AiChat,
    summary?: string,
  ) {
    return this.chatInternalService.createChat({
      type: chatType,
      topic: topic,
      participants: [userEmail],
      summary: summary,
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
            awaitResponse: false,
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