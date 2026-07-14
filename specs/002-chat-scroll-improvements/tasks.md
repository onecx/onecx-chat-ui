# Tasks: Improve chat auto-scroll and unread message hint

**Input**: Design documents from `/specs/002-chat-scroll-improvements/`  
**Prerequisites**: `spec.md`, `plan.md`

## Phase 1: Foundations

- [X] T001 Add scroll-position and unread-indicator state handling in `src/app/shared/components/chat/chat.component.ts`.

## Phase 2: User Story 1 - Smooth auto-scroll for active readers (Priority: P1)

**Goal**: Keep latest messages and AI loading progress visible when user is already near the bottom.

**Independent Test**: With viewport near bottom, append messages and verify smooth scroll and no unread indicator.

- [X] T002 Bind the actual scrollable viewport in `src/app/shared/components/chat/chat.component.html`.
- [X] T003 Replace forced `[scrollTop]` behavior with conditional smooth scroll logic in `chat.component.ts`.

## Phase 3: User Story 2 - Unread indicator for off-bottom reading (Priority: P1)

**Goal**: Show a new-message hint with unread count while user is reading older messages.

**Independent Test**: Scroll up, append messages, verify unread hint appears; click hint to scroll to latest and clear count.

- [X] T004 Add floating unread indicator action in `src/app/shared/components/chat/chat.component.html`.
- [X] T005 Add indicator styling/animation in `src/app/shared/components/chat/chat.component.css`.
- [X] T006 Add i18n action text in `src/assets/i18n/en.json` and `src/assets/i18n/de.json`.
- [X] T007 Extend `src/app/shared/components/chat/chat.component.spec.ts` with indicator and auto-scroll tests.
