# Chat Scroll Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement smooth, state-aware auto-scroll behavior in chat and show a new-message indicator when the user is away from the bottom.

**Architecture:** Move scrolling from template binding to `ChatComponent` state + lifecycle logic. Track bottom proximity and message deltas to decide auto-scroll vs unread indicator updates. Render a floating indicator button in the chat UI and keep behavior scoped to presentation logic.

**Tech Stack:** Angular 19 standalone component, TypeScript, PrimeNG, Jest (Nx test runner)

## Global Constraints

- Keep implementation scoped to `onecx-chat-ui` and related chat UI files only.
- Reuse existing chat message flow from reducers/effects; do not change backend/API contracts.
- Preserve responsive behavior and use smooth scrolling for automated movement.
- Maintain existing localization and component patterns.

---

### Task 1: Add failing tests for auto-scroll and new-message indicator behavior

**Files:**
- Modify: `src/app/shared/components/chat/chat.component.spec.ts`
- Test: `src/app/shared/components/chat/chat.component.spec.ts`

**Interfaces:**
- Consumes: `ChatComponent.ngOnChanges(changes: SimpleChanges)`, `ChatComponent.onHistoryScroll()`, `ChatComponent.scrollToLatestMessages()`
- Produces: Regression coverage for unread-indicator visibility and scroll behavior decisions.

- [ ] **Step 1: Write failing tests for unread-indicator behavior when user is away from bottom**

```ts
it('shows new message indicator when messages change and user is away from bottom', () => {
  // arrange mock history container with away-from-bottom scroll metrics
  // trigger ngOnChanges with changed chatMessages input
  // run queued timers
  // expect showNewMessagesIndicator true and unreadMessagesCount incremented
});
```

- [ ] **Step 2: Run targeted test to verify failure**

Run: `npx nx test onecx-chat-ui --runInBand --testPathPattern=chat.component.spec.ts`
Expected: FAIL in new indicator/scroll tests because logic does not exist yet.

- [ ] **Step 3: Write failing test for auto-scroll when user is at bottom**

```ts
it('auto-scrolls to bottom when new messages arrive and user is at bottom', () => {
  // arrange history container near bottom
  // trigger ngOnChanges with changed messages
  // expect scrollTo called with smooth behavior and indicator hidden
});
```

- [ ] **Step 4: Run targeted test to verify failure**

Run: `npx nx test onecx-chat-ui --runInBand --testPathPattern=chat.component.spec.ts`
Expected: FAIL for missing auto-scroll implementation.

- [ ] **Step 5: Commit test-only changes**

```bash
git add src/app/shared/components/chat/chat.component.spec.ts
git commit -m "test: add chat scroll indicator behavior coverage"
```

### Task 2: Implement chat scroll-state logic and indicator UI

**Files:**
- Modify: `src/app/shared/components/chat/chat.component.ts`
- Modify: `src/app/shared/components/chat/chat.component.html`
- Modify: `src/app/shared/components/chat/chat.component.css`
- Test: `src/app/shared/components/chat/chat.component.spec.ts`

**Interfaces:**
- Consumes: `@Input() chatMessages: ChatMessage[]`
- Produces:
  - `onHistoryScroll(): void`
  - `scrollToLatestMessages(): void`
  - `showNewMessagesIndicator: boolean`
  - `unreadMessagesCount: number`

- [ ] **Step 1: Implement minimal state + lifecycle handling in `chat.component.ts`**

```ts
isAtBottom = true;
showNewMessagesIndicator = false;
unreadMessagesCount = 0;

ngOnChanges(changes: SimpleChanges): void {
  // detect chatMessages change
  // if at bottom -> smooth scroll + clear unread
  // else -> increment unread + show indicator
}
```

- [ ] **Step 2: Add scroll-container listener and indicator markup in `chat.component.html`**

```html
<div #historyContainer class="chat-history-container ..." (scroll)="onHistoryScroll()">
  ...
</div>
@if (showNewMessagesIndicator) {
  <button type="button" class="new-messages-indicator" (click)="scrollToLatestMessages()">
    <i class="pi pi-arrow-down"></i>
    <span>{{ unreadMessagesCount }}</span>
  </button>
}
```

- [ ] **Step 3: Style indicator with animated border in `chat.component.css`**

```css
.new-messages-indicator {
  position: absolute;
  right: 1rem;
  bottom: 5rem;
  /* animated modern border + badge styles */
}
```

- [ ] **Step 4: Update tests to pass against final behavior**

Run: `npx nx test onecx-chat-ui --runInBand --testPathPattern=chat.component.spec.ts`
Expected: PASS for component scroll and indicator tests.

- [ ] **Step 5: Commit implementation**

```bash
git add src/app/shared/components/chat/chat.component.ts \
        src/app/shared/components/chat/chat.component.html \
        src/app/shared/components/chat/chat.component.css \
        src/app/shared/components/chat/chat.component.spec.ts
git commit -m "feat: add smooth chat auto-scroll and new message indicator"
```

### Task 3: Validate project quality gates for changed behavior

**Files:**
- Modify: none
- Test: existing lint/test/build targets

**Interfaces:**
- Consumes: Nx targets in `package.json` / `project.json`
- Produces: Verified lint, test, and build outputs for branch readiness.

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: PASS with no new lint violations.

- [ ] **Step 2: Run tests**

Run: `npm run test -- --runInBand`
Expected: PASS for all existing and updated tests.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS and successful app bundle generation.

- [ ] **Step 4: Commit only if verification required file adjustments**

```bash
git add <any-files-changed-by-required-verification>
git commit -m "chore: align chat scroll changes with project quality gates"
```
