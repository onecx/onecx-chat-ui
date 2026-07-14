# Chat Scroll Improvements Design

## Context

Issue: https://github.com/onecx/tasks/issues/20

The current chat view binds `scrollTop` directly in the template, which forces bottom scrolling without user-state awareness and does not provide a "new messages" indicator when the user is reading older content.

## Approaches Considered

### 1. Keep template binding and add indicator only

- **Pros:** Smallest change.
- **Cons:** Cannot reliably distinguish intentional user scroll-up from automatic scrolling; behavior remains jumpy and does not support smooth control.

### 2. Move scrolling to component logic (recommended)

- **Pros:** Enables explicit "at bottom" tracking, smooth auto-scroll, and unread counter behavior with minimal surface-area change.
- **Cons:** Adds component state and DOM interaction logic that must be tested.

### 3. Introduce dedicated scroll service/directive

- **Pros:** Potential long-term reuse.
- **Cons:** Over-engineered for this issue, broader refactor risk, and higher test cost.

## Recommended Design

### Behavior

1. Track whether the user is near the bottom of chat history.
2. On new incoming message changes:
   - If user is at bottom, smooth-scroll to latest message and clear indicator.
   - If user is not at bottom, keep current position and increment unread count.
3. Show a floating "new messages" indicator button when unread count is positive.
4. Clicking the indicator scrolls smoothly to bottom and clears unread state.
5. If the user manually scrolls back to bottom, clear unread state.
6. AI loading/progress messages follow the same flow, making progress visible when user is at bottom.

### Component Changes

- Replace template `[scrollTop]` binding with imperative `scrollTo` logic.
- Add state in `ChatComponent`:
  - `unreadMessagesCount`
  - `showNewMessagesIndicator`
  - `isAtBottom`
  - previous-message snapshot to detect deltas
- Add `ngOnChanges` handling for `chatMessages` changes and schedule post-render handling.
- Add scroll listener on the history container.

### UI Changes

- Add a floating button near the bottom-right of chat history:
  - Down arrow icon
  - Unread counter badge
  - Animated border to attract attention
- Keep responsive positioning within the chat container.

### Testing

- Add unit tests for:
  - Auto-scroll behavior when user is at bottom.
  - Indicator/unread behavior when user is not at bottom.
  - Clearing unread state when scrolling to bottom.
  - Indicator click triggering smooth scroll and reset.

## Scope Notes

- No reducer/effect changes required; this is a presentation-layer behavior change in `ChatComponent`.
- Existing message flow and API behavior remain unchanged.
