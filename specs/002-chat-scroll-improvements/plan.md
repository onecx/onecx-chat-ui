# Implementation Plan: Improve chat auto-scroll and unread message hint

**Branch**: `[002-chat-scroll-improvements]` | **Date**: 2026-07-14 | **Spec**: `/specs/002-chat-scroll-improvements/spec.md`

## Summary

Implement scroll-state awareness in the shared chat component so new messages auto-scroll only when the user is near the bottom, add a floating unread indicator with count and quick-jump action for off-bottom reading, and preserve current message sending/retry behavior.

## Technical Context

**Language/Version**: TypeScript with Angular 19 standalone components  
**Primary Dependencies**: Angular, PrimeNG button/tooltip/progress components, NgRx-driven chat state  
**Storage**: N/A  
**Testing**: Jest component tests  
**Target Platform**: Web browser chat panel  
**Project Type**: Frontend micro-frontend UI

## Constitution Check

- **Micro-frontend first**: Pass — scope limited to chat UI component and translations.
- **Shell/MFE contract compliance**: Pass — no routing or remote contract changes.
- **Permission-driven access control**: Pass — no permission logic changes.
- **i18n mandatory**: Pass — new user-facing tooltip text added to `en.json` and `de.json`.
- **Theming via design tokens**: Pass — indicator styling uses existing CSS variables.
- **No new `any` types**: Pass — no new `any` introduced in source implementation.
- **Unit test coverage**: Pass — chat component test coverage expanded for new behavior.

## File Changes

- Update `src/app/shared/components/chat/chat.component.ts` with scroll tracking, unread indicator state, and smooth-scroll actions.
- Update `src/app/shared/components/chat/chat.component.html` to bind viewport scroll events and render unread indicator UI.
- Update `src/app/shared/components/chat/chat.component.css` with floating indicator and animated border styles.
- Update `src/assets/i18n/en.json` and `src/assets/i18n/de.json` with unread-jump action text.
- Update `src/app/shared/components/chat/chat.component.spec.ts` with tests for unread indicator and auto-scroll behavior.

## Implementation Notes

- Use a bottom-distance threshold so tiny offsets still count as "near bottom".
- Avoid forced auto-scroll while users are reading older messages.
- Keep unread indicator logic local to the component for low coupling.
