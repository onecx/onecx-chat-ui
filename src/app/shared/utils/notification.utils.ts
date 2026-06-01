import { Notification } from '@onecx/integration-interface';

export interface UpdateChatNotification {
  type: 'update_chat';
  chatId: string;
}

export interface KeyValue {
  key: string;
  value: string;
}

export function parseChatNotification(notification: Notification): UpdateChatNotification | null {
  // Metadata is inside body.contentMeta
  const meta = notification.body.contentMeta as KeyValue[];
  const type = meta.find((m: KeyValue) => m.key === 'type')?.value;
  const chatId = meta.find((m: KeyValue) => m.key === 'chatId')?.value;

  if (!type || !chatId) {
    return null;
  }

  if (type === 'update_chat') {
    return { type, chatId };
  }
  return null;
}