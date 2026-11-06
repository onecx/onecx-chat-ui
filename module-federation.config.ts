import { ModuleFederationConfig } from '@nx/module-federation'
import { getOneCXSharedRecommendations } from '@onecx/accelerator'

const config: ModuleFederationConfig = {
  name: 'onecx-chat-ui',
  exposes: {
    './OneCXChatModule': './src/main.ts',
    './OneCXChatPanelComponent': 'src/app/remotes/chat-panel/chat-panel.component.main.ts',
    './OneCXChatToggleComponent': 'src/app/remotes/chat-toggle/chat-toggle.component.main.ts'
  },
  shared: (libraryName, sharedConfig) => {
    const config = getOneCXSharedRecommendations(libraryName, sharedConfig)
    return config
  }
}

export default config
