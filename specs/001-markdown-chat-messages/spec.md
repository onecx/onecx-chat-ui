# Feature Specification: Enable markdown formatting for chat messages

**Feature Branch**: `[001-markdown-chat-messages]`
**Created**: 2026-07-10
**Status**: Approved
**Input**: User description: "Enable markdown formatting for all chat messages so humans and AIs can send markdown that renders as formatted HTML using marked, limited to basic markdown without special renderers such as mermaid diagrams."

## Clarifications

- No clarification questions were required because the issue already defines the renderer (`marked`), the scope (all chat messages), and the explicit exclusions (no special renderers such as mermaid).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read formatted markdown in chat history (Priority: P1)

As a chat participant, I want markdown in chat messages to render as formatted HTML so that emphasis, lists, links, and code snippets are readable in the conversation.

**Why this priority**: This is the core value requested by the issue and applies directly to every message shown in the chat transcript.

**Independent Test**: Open a chat containing markdown from either a human or AI sender and verify the message renders formatted content instead of raw markdown tokens.

**Acceptance Scenarios**:

1. **Given** a human message containing markdown emphasis, lists, or links, **When** the message is rendered in chat, **Then** the content is displayed as formatted HTML.
2. **Given** an AI message containing markdown headings, code spans, or code blocks, **When** the message is rendered in chat, **Then** the content is displayed as formatted HTML.
3. **Given** a message without markdown syntax, **When** it is rendered in chat, **Then** the plain text content still displays correctly.

---

### Edge Cases

- What happens when a message text is `null`, `undefined`, or empty? The renderer must return empty output without throwing.
- How does the system handle unsupported markdown extensions such as mermaid diagrams? The renderer must leave them to the default `marked` output and not add custom rendering behavior.
- How does the system handle unsafe HTML embedded in markdown? Rendered output must still pass through Angular sanitization before binding to the DOM.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The chat UI MUST render markdown for every displayed chat message, regardless of whether the sender is a human or AI/system participant.
- **FR-002**: The implementation MUST use the `marked` library to convert markdown source into HTML.
- **FR-003**: The rendered output MUST support basic markdown syntax provided by `marked` without adding custom renderers or special-case extensions.
- **FR-004**: The chat UI MUST safely bind rendered HTML so that unsupported or unsafe HTML does not break the page.
- **FR-005**: Messages with empty, `null`, or `undefined` text MUST render as empty content without runtime errors.
- **FR-006**: Existing chat layout, alignment, and retry/loading behaviors MUST remain unchanged aside from markdown presentation.

### Key Entities

- **ChatMessage**: Existing view model representing a rendered chat entry with message text, sender type, timestamps, and retry/loading state.
- **Markdown rendering pipeline**: A UI transformation that converts a message's text into sanitized HTML before it is displayed in the chat template.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Markdown syntax such as emphasis, lists, links, inline code, and fenced code blocks displays as HTML for both human and AI/system messages.
- **SC-002**: Empty or missing message text renders without a visible error or console exception.
- **SC-003**: No custom renderer is introduced for mermaid diagrams or other non-basic markdown extensions.
- **SC-004**: Chat message alignment and loading/retry UI continue to behave the same after the rendering change.

## Assumptions

- Existing chat message text continues to arrive as plain strings in `ChatMessage.text`.
- Angular's sanitization pipeline remains the mechanism for safe HTML insertion in the browser.
- The repository can accept one additional third-party dependency because the issue explicitly requests `marked`.
- No API, NgRx state shape, or permission changes are required for this UI-only enhancement.
