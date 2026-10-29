export const environment = {
  production: true,
  apiPrefix: 'bff',
  chatMessageProcessingMode: 'async',
  DEFAULT_LOGO_PATH: '/assets/images/logo.png',
  // Voice chat talks to the voice service (onecx-pipecat) over a WebSocket
  voiceAiEnabled: true,
  // WebSocket URL of the voice service; empty means /ws/voice on the current host
  voiceWsUrl: ''
}
