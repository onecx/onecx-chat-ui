import { parseChatNotification } from './notification.utils';
import { createNotification } from 'src/app/shared/utils/notification.test.utils';

describe('notification', () => {
  it('should return null when meta does not contain type', () => {
    const notification = createNotification('onecx-chat', [
      { key: 'chatId', value: '123' }
    ]);

    expect(parseChatNotification(notification)).toBeNull();
  });

  it('should return null when meta does not contain chatId', () => {
    const notification = createNotification('onecx-chat', [
      { key: 'type', value: 'update_chat' }
    ])
    expect(parseChatNotification(notification)).toBeNull();
  });

  it('should parse update_chat notification when both type and chatId are present', () => {
    const notification = createNotification('onecx-chat', [
      { key: 'type', value: 'update_chat' },
      { key: 'chatId', value: '123' }
    ]);

    expect(parseChatNotification(notification)).toEqual({
      type: 'update_chat',
      chatId: '123'
    });
  });

  it('should return null when type is not update_chat', () => {
    const notification = createNotification('onecx-chat', [
      { key: 'type', value: 'other_type' },
      { key: 'chatId', value: '123' }
    ]);

    expect(parseChatNotification(notification)).toBeNull();
  });
});