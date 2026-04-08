export interface UpdateChatNotification {
    type: 'update_chat';
    chatId: string;
}

import { Notification } from '@onecx/integration-interface';

export function parseChatNotification(notification: Notification): UpdateChatNotification | null {
    // Metadata is inside body.contentMeta
    const meta = notification.body.contentMeta;
    const type = meta.find((m: any) => m.key === 'type')?.value;
    const chatId = meta.find((m: any) => m.key === 'chatId')?.value;

    if (!type || !chatId) {
        return null;
    }

    if (type === 'update_chat') {
        return { type, chatId } as UpdateChatNotification;
    }
    return null;
}