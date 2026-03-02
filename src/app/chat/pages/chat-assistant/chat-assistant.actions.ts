import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Chat, ChatType, Message } from 'src/app/shared/generated';

export const ChatAssistantActions = createActionGroup({
  source: 'ChatAssistant',
  events: {
    'chat initialized': emptyProps(),
    'chat panel opened': emptyProps(),
    'chat panel closed': emptyProps(),
    'chats loaded': props<{
      chats: Chat[];
    }>(),
    'chats loading failed': props<{
      error: string | null;
    }>(),
    'message sent': props<{
      message: string;
    }>(),
    'message sent for new chat': props<{
      chat: Chat;
      message: string;
    }>(),
    'message sending successful': props<{
      message: Message;
    }>(),
    'message sending failed': props<{
      message: string;
      error: string | null;
    }>(),
    'create new chat for message': props<{
      message: string;
    }>(),
    'chat created': emptyProps(),
    'chat creation successful': props<{
      chat: Chat;
    }>(),
    'chat creation failed': props<{
      error: string | null;
    }>(),
    'delete chat clicked': props<{
      chat: Chat;
    }>(),
    'chat deletion successful': props<{
      chatId: string;
    }>(),
    'chat deletion failed': props<{
      error: string | null;
    }>(),
    'chat selected': props<{
      chat: Chat;
    }>(),
    'update current chat topic': props<{
      topic: string;
    }>(),
    'messages loaded': props<{
      messages: Message[];
    }>(),
    'messages loading failed': props<{
      error: string | null;
    }>(),
    'chat mode selected': props<{ mode: string }>(),
    'new chat clicked': props<{ mode: ChatType }>(),
    'back button clicked': emptyProps(),
    'search query changed': props<{ query: string }>(),
    'voice chat enabled': emptyProps(),
    'voice chat disabled': emptyProps(),
    'voice user transcript received': props<{
      text: string;
      isFinal: boolean;
    }>(),
    'voice bot transcript received': props<{
      text: string;
      spoken: boolean;
    }>(),
  },
});