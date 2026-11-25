import { Location } from '@angular/common'
import { Injectable, inject } from '@angular/core'

import { environment } from 'src/environments/environment'
import { ChatsService, Configuration, AgentService } from 'src/app/shared/generated'

@Injectable({ providedIn: 'root' })
export class ChatInternalService {
  private readonly chatService = inject(ChatsService)
  private readonly agentService = inject(AgentService)

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
