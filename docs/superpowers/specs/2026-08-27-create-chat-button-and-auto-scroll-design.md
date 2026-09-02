# Create Chat Button and Auto-Scroll Design

## Goal

Correct the create-chat button semantics and hover appearance, and complete chat auto-scroll without disrupting a user who is reading older messages.

## Button Behavior

The floating plus button creates a new AI chat immediately. Its accessible label and tooltip must describe that action as "Create new chat", not "Select chat type".

The button must have an explicit theme-aware foreground and background in its default, hover, and keyboard-focus states. Hover and focus must remain visibly opaque and preserve sufficient contrast.

## Scroll Behavior

`ChatComponent` owns integration between the message view, `ChatScrollService`, and `NewMessageIndicatorComponent`.

The element with vertical overflow is the registered scroll container. When the displayed message list changes:

- If the user was at or near the bottom before the change, scroll to the latest content after Angular renders it.
- If the user had scrolled up, preserve their position and increase the unread message count.
- Show the new-message indicator only while the user is away from the bottom and unread messages exist.
- Clicking the indicator scrolls to the latest content and clears the unread count.
- Manually returning to the bottom clears the unread count.
- Replacing the current conversation resets unread state and positions the new conversation at its latest message.

The near-bottom threshold remains owned by `ChatScrollService` and defaults to 24 pixels.

## Scope

Reuse the existing service and indicator introduced on the feature branch. Do not change chat creation actions, public component inputs or outputs, or the testing framework. No API or breaking changes are required.

## Testing

Jest component tests will prove that a message arriving while pinned triggers scrolling, a message arriving while scrolled up preserves position and shows unread state, and the indicator clears unread state and scrolls down. Existing service tests continue to cover threshold and scrolling mechanics. The chat-list component test will assert the create action's tooltip and accessible label key; stylesheet validation will be covered by lint/build checks.
