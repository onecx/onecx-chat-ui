import { bootstrapModule } from '@onecx/angular-webcomponents'

import { environment } from 'src/environments/environment'
import { OneCXChatModule } from './app/onecx-chat.remote.module'

bootstrapModule(OneCXChatModule, 'microfrontend', environment.production)
