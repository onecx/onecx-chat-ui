# Tasks: Enable markdown formatting for chat messages

**Input**: Design documents from `/specs/001-markdown-chat-messages/`
**Prerequisites**: plan.md, spec.md, research.md

## Phase 1: Setup

- [x] T001 Add `marked` to project dependencies in `package.json` and `package-lock.json` via `npm install marked --save`.

## Phase 2: Foundational

- [x] T002 Create `src/app/shared/pipes/markdown.pipe.ts` to parse markdown and sanitize HTML output.
- [x] T003 Create `src/app/shared/pipes/markdown.pipe.spec.ts` to cover null-safe and sanitized rendering behavior.

## Phase 3: User Story 1 - Render markdown in chat messages (Priority: P1)

**Goal**: Show formatted markdown for both human and AI/system chat messages without changing existing chat interactions.

**Independent Test**: Render chat messages containing markdown from different sender types and confirm formatted HTML appears with existing alignment and retry/loading states intact.

- [x] T004 Update `src/app/shared/components/chat/chat.component.ts` to import the standalone `MarkdownPipe`.
- [x] T005 Update `src/app/shared/components/chat/chat.component.html` to bind rendered message content with `[innerHTML]="message.text | markdown"`.
- [x] T006 Update `src/app/shared/components/chat/chat.component.css` to style markdown content for paragraphs, lists, links, and code blocks.

## Dependencies & Execution Order

- T001 precedes pipe implementation because the parser dependency must exist first.
- T002 and T003 establish reusable markdown rendering behavior.
- T004, T005, and T006 apply the rendering pipeline to the shared chat UI.
