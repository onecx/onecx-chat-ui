import { ChatDetailsComponent } from './pages/chat-details/chat-details.component'
import { ChatAssistantComponent } from './pages/chat-assistant/chat-assistant.component'
import { ChatSearchComponent } from './pages/chat-search/chat-search.component'
import { routes } from './chat.routes'

describe('chat routes', () => {
  it('should define exactly 3 routes', () => {
    expect(routes.length).toBe(3)
  })

  describe('details route', () => {
    const route = routes[0]

    it('should map "details/:id" path to ChatDetailsComponent', () => {
      expect(route.path).toBe('details/:id')
      expect(route.pathMatch).toBe('full')
      expect(route.component).toBe(ChatDetailsComponent)
    })
  })

  describe('root route', () => {
    const route = routes[1]

    it('should map empty path to ChatSearchComponent', () => {
      expect(route.path).toBe('')
      expect(route.pathMatch).toBe('full')
      expect(route.component).toBe(ChatSearchComponent)
    })
  })

  describe('chat-assistant route', () => {
    const route = routes[2]

    it('should map "chat-assistant" path to ChatAssistantComponent', () => {
      expect(route.path).toBe('chat-assistant')
      expect(route.pathMatch).toBe('full')
      expect(route.component).toBe(ChatAssistantComponent)
    })
  })
})