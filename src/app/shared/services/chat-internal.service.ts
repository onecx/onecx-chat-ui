import { Location } from '@angular/common'
import { Injectable } from '@angular/core'

import { environment } from 'src/environments/environment'
import { ChatsService, Configuration, AgentService } from 'src/app/shared/generated'

@Injectable({ providedIn: 'root' })
export class ChatInternalService {
  constructor(
    private readonly chatService: ChatsService,
    private readonly agentService: AgentService
  ) {}

  overwriteBaseURL(baseUrl: string) {
    const configuration = new Configuration({
      basePath: Location.joinWithSlash(baseUrl, environment.apiPrefix)
    })

    this.chatService.configuration = configuration
    this.agentService.configuration = configuration
  }

  getService() {
    return this.chatService
  }
}
