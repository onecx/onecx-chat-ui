import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Chat, Message } from 'src/app/shared/generated';

export const ChatDetailsActions = createActionGroup({
  source: 'ChatDetails',
  events: {
    'navigated to details page': props<{
      id: string | undefined;
    }>(),
    'chat details received': props<{
      details: Chat;
    }>(),
    'chat reloaded details received': props<{
      details: Chat;
    }>(),
    'chat details loading failed': props<{ error: string | null }>(),
    'delete button clicked': emptyProps(),
    'navigate back button clicked': emptyProps(),
    'back navigation started': emptyProps(),
    'back navigation failed': emptyProps(),
    'navigation to search started': emptyProps(),
    'navigation to search not started': emptyProps(),
    'delete chat canceled': emptyProps(),
    'delete chat succeeded': emptyProps(),
    'delete chat failed': props<{ error: string | null }>(),
    'messages loaded': props<{
      messages: Message[];
    }>(),
    'messages loading failed': props<{
      error: string | null;
    }>(),
  },
});
