import { Location } from '@angular/common';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ChatsService, Configuration } from '../generated';

@Injectable({ providedIn: 'root' })
export class ChatInternalService {
  constructor(private readonly chatService: ChatsService) {}

  overwriteBaseURL(baseUrl: string) {
    this.chatService.configuration = new Configuration({
      basePath: Location.joinWithSlash(baseUrl, environment.apiPrefix),
    });
  }

  getService() {
    return this.chatService;
  }
}
