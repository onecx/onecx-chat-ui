import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ChatInternalService } from './chat-internal.service';
import { ChatsService, Configuration } from '../generated';
import { environment } from '../../../environments/environment';

describe('ChatInternalService', () => {
  let service: ChatInternalService;
  let mockChatsInternal: jest.Mocked<ChatsService>;

  beforeEach(() => {
    const chatsInternalSpy = {
      configuration: new Configuration()
    };

    TestBed.configureTestingModule({
      providers: [
        ChatInternalService,
        { provide: ChatsService, useValue: chatsInternalSpy }
      ]
    });

    service = TestBed.inject(ChatInternalService);
    mockChatsInternal = TestBed.inject(ChatsService) as jest.Mocked<ChatsService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('overwriteBaseURL', () => {
    it('should update configuration with new base path', () => {
      const testBaseUrl = 'https://test-api.example.com';
      const expectedBasePath = Location.joinWithSlash(testBaseUrl, environment.apiPrefix);

      service.overwriteBaseURL(testBaseUrl);

      expect(mockChatsInternal.configuration.basePath).toBe(expectedBasePath);
      expect(mockChatsInternal.configuration).toBeInstanceOf(Configuration);
    });

    it('should handle base URL with trailing slash', () => {
      const testBaseUrl = 'https://test-api.example.com/';
      const expectedBasePath = Location.joinWithSlash(testBaseUrl, environment.apiPrefix);

      service.overwriteBaseURL(testBaseUrl);

      expect(mockChatsInternal.configuration.basePath).toBe(expectedBasePath);
    });

    it('should handle base URL without protocol', () => {
      const testBaseUrl = 'test-api.example.com';
      const expectedBasePath = Location.joinWithSlash(testBaseUrl, environment.apiPrefix);

      service.overwriteBaseURL(testBaseUrl);

      expect(mockChatsInternal.configuration.basePath).toBe(expectedBasePath);
    });

    it('should handle empty base URL', () => {
      const testBaseUrl = '';
      const expectedBasePath = Location.joinWithSlash(testBaseUrl, environment.apiPrefix);

      service.overwriteBaseURL(testBaseUrl);

      expect(mockChatsInternal.configuration.basePath).toBe(expectedBasePath);
    });

    it('should use environment.apiPrefix correctly', () => {
      const testBaseUrl = 'https://api.example.com';
      const expectedBasePath = `${testBaseUrl}/${environment.apiPrefix}`;

      service.overwriteBaseURL(testBaseUrl);

      expect(mockChatsInternal.configuration.basePath).toBe(expectedBasePath);
    });
  });

  describe('getService', () => {
    it('should return the injected ChatsInternal service', () => {
      const result = service.getService();

      expect(result).toBe(mockChatsInternal);
    });

    it('should return same instance on multiple calls', () => {
      const result1 = service.getService();
      const result2 = service.getService();

      expect(result1).toBe(result2);
      expect(result1).toBe(mockChatsInternal);
    });
  });

  describe('integration with Location.joinWithSlash', () => {
    it('should properly join URL paths using Location utility', () => {
      const baseUrl = 'https://api.example.com';
      
      service.overwriteBaseURL(baseUrl);

      // Verify that Location.joinWithSlash is used correctly
      const expectedPath = `${baseUrl}/${environment.apiPrefix}`;
      expect(mockChatsInternal.configuration.basePath).toBe(expectedPath);
    });

    it('should handle paths with multiple segments', () => {
      const baseUrl = 'https://api.example.com/v1';
      
      service.overwriteBaseURL(baseUrl);

      const expectedPath = `${baseUrl}/${environment.apiPrefix}`;
      expect(mockChatsInternal.configuration.basePath).toBe(expectedPath);
    });
  });
});
