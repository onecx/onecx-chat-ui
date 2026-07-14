# Feature Specification: Improve chat auto-scroll and unread message hint

**Feature Branch**: `[002-chat-scroll-improvements]`  
**Created**: 2026-07-14  
**Status**: Approved  
**Input**: User description: "Automatic Scrolldown in Agent Chats for progress message + New Message Hint"

## Clarifications

- No clarification questions were required because the issue defines when auto-scroll should happen, when unread indication should appear, and the expected interaction to return to the latest message.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep active readers at the latest message (Priority: P1)

As a chat user currently reading at the bottom of the conversation, I want new messages (including AI loading/progress messages) to smoothly scroll into view so I can follow the conversation without manual scrolling.

**Why this priority**: This is the primary usability problem from the issue and affects every new message in active chats.

**Independent Test**: With the viewport at the bottom, send a message in AI and human chats and verify that the newest message/progress indicator is smoothly visible.

**Acceptance Scenarios**:

1. **Given** the user is near the bottom of the chat, **When** a new message arrives, **Then** the chat scrolls smoothly to the latest message.
2. **Given** an AI chat where a loading/progress message appears, **When** the user is near the bottom, **Then** the loading indicator is visible immediately without manual scrolling.

---

### User Story 2 - Preserve reading position with unread hint (Priority: P1)

As a chat user who has scrolled up, I want an unread-message hint with quick jump action so I can continue reading older content and still return to new messages on demand.

**Why this priority**: The issue explicitly requires an indicator when the user is no longer at the bottom.

**Independent Test**: Scroll up, trigger incoming messages, verify hint appears with unread count, then click it and verify smooth scroll to latest and hint removal.

**Acceptance Scenarios**:

1. **Given** the user has scrolled up, **When** one or more new messages arrive, **Then** a bottom indicator with unread count appears.
2. **Given** the unread indicator is visible, **When** the user clicks it, **Then** the chat scrolls smoothly to the latest message and the indicator disappears.
3. **Given** the user manually scrolls to the bottom, **When** the viewport reaches the latest message, **Then** the indicator disappears.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The chat UI MUST smoothly auto-scroll to the newest message when the user is currently near the bottom of the message list.
- **FR-002**: AI loading/progress messages MUST follow the same scroll behavior so they are visible immediately when the user is near the bottom.
- **FR-003**: When the user is not near the bottom and new messages arrive, the chat UI MUST show a bottom unread-message indicator.
- **FR-004**: The unread indicator MUST display the number of unseen new messages since the user left the bottom.
- **FR-005**: Clicking the unread indicator MUST smoothly scroll to the latest message and clear the unread indicator/count.
- **FR-006**: Manually scrolling back to the bottom MUST clear the unread indicator/count.
- **FR-007**: Existing message rendering, retry behavior, and form interactions MUST remain unchanged.

### Key Entities

- **Chat viewport**: Scrollable container displaying chat messages and receiving scroll position events.
- **Unread indicator**: Floating control that shows unread count and provides an action to jump to latest messages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New messages are visible without manual scrolling when the user is at/near the bottom.
- **SC-002**: Unread indicator appears only when the user is away from the bottom and new messages arrive.
- **SC-003**: Unread count increments with additional incoming messages while away from bottom.
- **SC-004**: Clicking the indicator or scrolling to bottom clears the indicator and unread count.
