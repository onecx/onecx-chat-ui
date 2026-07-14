# Implementation Plan: Enable markdown formatting for chat messages

**Branch**: `[001-markdown-chat-messages]` | **Date**: 2026-07-10 | **Spec**: `/specs/001-markdown-chat-messages/spec.md`

**Input**: Feature specification from `/specs/001-markdown-chat-messages/spec.md`

## Summary

Render chat message text as markdown-generated HTML by adding the `marked` dependency, introducing a standalone Angular markdown pipe, sanitizing generated HTML with Angular's `DomSanitizer`, and updating the shared chat component template/styles so both human and AI/system messages display formatted markdown.

## Technical Context

**Language/Version**: TypeScript with Angular 19 standalone components
**Primary Dependencies**: Angular 19, PrimeNG, NgRx, `marked`
**Storage**: N/A
**Testing**: Jest via Nx Angular test setup
**Target Platform**: Web browsers supported by the Angular 19 application
**Project Type**: Frontend web application / micro-frontend UI
**Performance Goals**: Render markdown inline with existing chat message updates without perceptible UI delay for standard message sizes
**Constraints**: Keep current chat behaviors intact, avoid custom markdown extensions, do not introduce raw unsafe HTML into the DOM, do not change API/state contracts
**Scale/Scope**: Shared chat component and one new pipe in `src/app/shared/`

## Constitution Check

- **Micro-frontend first**: Pass — change is isolated to the existing shared chat UI within the current MFE.
- **Shell/MFE contract compliance**: Pass — no module federation, remote entry, or shell contract changes.
- **Permission-driven access control**: Pass — no routes or sensitive actions are added.
- **i18n mandatory**: Pass — no new user-facing strings are introduced.
- **Theming via design tokens**: Pass — markdown styles use existing theme variables instead of new hard-coded colors.
- **No new `any` types**: Pass — implementation uses concrete Angular/TypeScript types.
- **Unit test coverage**: Pass by implementation plan — add a unit test for the new markdown pipe.
- **Breaking changes**: None expected.

## Research Decisions

1. Use `marked` directly because the issue explicitly requests it and current versions ship TypeScript types.
2. Implement markdown conversion in a standalone Angular pipe so the chat component template stays declarative and reusable.
3. Sanitize `marked` output through Angular `DomSanitizer` before binding with `[innerHTML]`.
4. Keep markdown styling local to `chat.component.css` so existing message alignment/layout remains unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/001-markdown-chat-messages/
├── spec.md
├── plan.md
├── research.md
├── tasks.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
└── app/
    └── shared/
        ├── components/
        │   └── chat/
        │       ├── chat.component.css
        │       ├── chat.component.html
        │       ├── chat.component.spec.ts
        │       └── chat.component.ts
        └── pipes/
            ├── markdown.pipe.spec.ts
            └── markdown.pipe.ts
```

**Structure Decision**: Keep the implementation within the existing shared chat component and add a new shared standalone pipe for markdown conversion.

## File Changes

- Update `package.json` to add `marked` to dependencies.
- Update `package-lock.json` through `npm install marked --save`.
- Create `src/app/shared/pipes/markdown.pipe.ts` for markdown-to-sanitized-HTML conversion.
- Create `src/app/shared/pipes/markdown.pipe.spec.ts` for unit coverage of null-safe, sanitized rendering.
- Modify `src/app/shared/components/chat/chat.component.ts` to import `MarkdownPipe` in the standalone component imports.
- Modify `src/app/shared/components/chat/chat.component.html` to render message text with `[innerHTML]` and the markdown pipe.
- Modify `src/app/shared/components/chat/chat.component.css` to style rendered markdown blocks.

## Implementation Notes

- Do not add special handling for mermaid diagrams or custom markdown extensions.
- Preserve all existing loading, retry, timestamp, and alignment logic.
- Rely on Angular sanitization instead of bypassing trust for generated HTML.
