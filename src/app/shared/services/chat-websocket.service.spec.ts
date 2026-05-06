import { WebSocketService } from './chat-websocket.service';
import { MessageType, WebsocketHelper } from 'src/app/shared/generated/model/models';

describe('WebSocketService', () => {
  let service: WebSocketService;
  let mockWebSocket: any;
  const testUserName = 'testUser';
    
  beforeEach(() => {
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: 1,
    };

    global.WebSocket = jest.fn(() => mockWebSocket) as any;
    service = new WebSocketService(testUserName);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create service instance with correct initialization', () => {
      expect(service).toBeDefined();
      expect(service.URL).toBe('ws://localhost:8088/chats/socket/');
      expect(service.receivedMessage$).toBeDefined();
      expect(global.WebSocket).toHaveBeenCalledWith(
        `ws://localhost:8088/chats/socket/${testUserName}`
      );
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );

      const defaultValue = service.receivedMessage.getValue();
      expect(defaultValue.chatId).toBe('');
      expect(defaultValue.messageDTO.type).toBe(MessageType.System);
    });
  });

  describe('receiveStatus', () => {
    it('should update receivedMessage and emit through observable', (done) => {
      const testData: WebsocketHelper = {
        chatId: 'chat123',
        messageDTO: { type: MessageType.Human },
      };

      service.receivedMessage$.subscribe((value) => {
      if (value.chatId === 'chat123') {
        expect(value).toEqual(testData);
        done();
      }
      });

      service.receiveStatus(testData);
    });
  });

  describe('message event handling', () => {
    it('should parse incoming message data and call receiveStatus', () => {
      const receiveStatusSpy = jest.spyOn(service, 'receiveStatus');
      const messageCallback = mockWebSocket.addEventListener.mock.calls[0][1];

      const messageData = {
        chatId: 'chat789',
        messageDTO: { type: MessageType.Human, text: 'Hello' },
        extraField: 'ignored',
      };

      messageCallback({ data: JSON.stringify(messageData) });

      expect(receiveStatusSpy).toHaveBeenCalledWith({
        chatId: 'chat789',
        messageDTO: { type: MessageType.Human, text: 'Hello' },
      });
    });
  });

  describe('diconnectSocket', () => {
    it('should close websocket connection', () => {
      service.diconnectSocket();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });
});
