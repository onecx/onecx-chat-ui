# Create Chat Button and Auto-Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the create-chat button semantics and hover state, then complete conditional chat auto-scroll with an unread-message indicator.

**Architecture:** Keep the existing chat creation action unchanged. Integrate the existing component-scoped `ChatScrollService` and `NewMessageIndicatorComponent` inside `ChatComponent`; use `chatId` to identify conversation replacement and Angular lifecycle hooks to separate pre-render scroll-state decisions from post-render scrolling.

**Tech Stack:** Angular 19 standalone components, PrimeNG 19, RxJS 7, SCSS, Jest 29 with jest-preset-angular.

## Global Constraints

- Preserve the Jest test framework confirmed by `package.json`.
- Preserve existing import grouping and ordering conventions.
- Do not change chat creation actions or existing output payloads.
- Use English for comments and documentation.
- No public API or breaking change is required.

---

### Task 1: Correct Create Button Semantics and Appearance

**Files:**

- Modify: `src/app/chat/shared/components/chat-list-screen/chat-list-screen.component.html`
- Modify: `src/app/chat/shared/components/chat-list-screen/chat-list-screen.component.scss`
- Modify: `src/app/chat/shared/components/chat-list-screen/chat-list-screen.component.spec.ts`
- Modify: `src/assets/i18n/en.json`
- Modify: `src/assets/i18n/de.json`

**Interfaces:**

- Consumes: `ChatListScreenComponent.onCreateButtonClick(): void` and `ChatType.AiChat`.
- Produces: translation key `CHAT.LIST.CREATE_CHAT_BUTTON` used for both the FAB tooltip and accessible label.

- [ ] **Step 1: Write the failing semantics test**

Add a component test that locates `#chat_list_chat_type_button`, reads its PrimeNG tooltip directive and button accessible-label input, and expects both translated values to equal `Create New Chat` in the default English locale. Keep the existing test proving that clicking emits `{ mode: ChatType.AiChat }`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx nx test onecx-chat-ui --runInBand --testPathPattern=chat-list-screen.component.spec.ts
```

Expected: the new assertion fails because the template still resolves `CHAT.LIST.CHAT_TYPE_BUTTON` to `Select chat type`.

- [ ] **Step 3: Implement the semantic and style fix**

Add these translations:

```json
"CREATE_CHAT_BUTTON": "Create New Chat"
```

```json
"CREATE_CHAT_BUTTON": "Neuen Chat erstellen"
```

Bind the FAB `ariaLabel` and `pTooltip` to `CHAT.LIST.CREATE_CHAT_BUTTON`. In `.chat-create-fab-button.p-button`, define explicit foreground, border, and background colors from PrimeNG primary button variables with existing OneCX-compatible fallbacks. Add `:hover` and `:focus-visible` rules that use the corresponding primary hover variables and retain an opaque background; include a visible focus outline.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: all chat-list-screen component tests pass.

### Task 2: Integrate Conditional Auto-Scroll

**Files:**

- Modify: `src/app/chat/pages/chat-assistant/chat-assistant.component.html`
- Modify: `src/app/shared/components/chat/chat.component.ts`
- Modify: `src/app/shared/components/chat/chat.component.html`
- Modify: `src/app/shared/components/chat/chat.component.scss`
- Modify: `src/app/shared/components/chat/chat.component.spec.ts`
- Modify: `src/assets/i18n/en.json`
- Modify: `src/assets/i18n/de.json`

**Interfaces:**

- Consumes: `ChatScrollService.init(container)`, `isAtBottom$`, `scrollToBottom()`, and `resetToBottom()`; `NewMessageIndicatorComponent` inputs and output.
- Produces: `@Input() chatId: string | undefined`, `unreadCount: number`, and `scrollToLatest(): void` on `ChatComponent`.

- [ ] **Step 1: Write failing auto-scroll tests**

Extend `chat.component.spec.ts` with deterministic element dimensions and `fixture.componentRef.setInput(...)`. Cover these independent behaviors:

```typescript
it('scrolls after a message is appended while at the bottom', () => {
  // Set the overflow container at the bottom, append one message, detect changes,
  // and expect ChatScrollService.scrollToBottom() to run.
})

it('preserves position and counts unread messages when a message arrives while scrolled up', () => {
  // Set distanceToBottom above 24px, append one message, detect changes,
  // and expect no programmatic scroll plus unreadCount === 1.
})

it('scrolls and clears unread messages when the indicator is clicked', () => {
  // Establish unreadCount through the scrolled-up case, call scrollToLatest(),
  // and expect scrollToBottom(), resetToBottom(), and unreadCount === 0.
})

it('resets unread messages and scrolls when chatId changes', () => {
  // Establish unread state, set a different chatId and message list,
  // then expect unreadCount === 0 and a post-render scroll.
})
```

Also assert that the indicator renders only when `unreadCount > 0` and the user is not at the bottom.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx nx test onecx-chat-ui --runInBand --testPathPattern=chat.component.spec.ts
```

Expected: compilation or assertions fail because `chatId`, unread state, lifecycle integration, and indicator rendering do not exist.

- [ ] **Step 3: Implement the minimal lifecycle integration**

Make `ChatComponent` implement `AfterViewInit`, `AfterViewChecked`, and `OnChanges`. Scope `ChatScrollService` in the component `providers`, subscribe to `isAtBottom$` for local state, and register the real `.chat-history-container` referenced by `#scrollContainer`.

In `ngOnChanges`, use `SimpleChanges` to apply these decisions before render:

- A `chatId` change clears unread state and schedules a post-render scroll.
- A growing `chatMessages` array schedules a scroll when the previous state was near the bottom.
- A growing `chatMessages` array increments unread state when the user was away from the bottom.
- Initial messages schedule a post-render scroll.

In `ngAfterViewChecked`, consume a boolean pending-scroll flag exactly once, call `scrollToBottom()`, call `resetToBottom()`, and clear unread state. In the `isAtBottom$` subscription, clear unread state when it becomes true and call `ChangeDetectorRef.markForCheck()` for OnPush rendering. `scrollToLatest()` performs the same scroll/reset/clear behavior for indicator clicks.

Move `#scrollContainer` from the inner message column to `.chat-history-container` and remove the unconditional `[scrollTop]` binding. Render:

```html
@if (!isAtBottom && unreadCount > 0) {
<app-new-message-indicator [unreadCount]="unreadCount" (scrollClick)="scrollToLatest()" />
}
```

Position the indicator above the composer using a relatively positioned history container and an absolutely positioned indicator host. Pass `[chatId]="vm.currentChat.id"` from `chat-assistant.component.html`.

Add `CHAT.ACTIONS.SCROLL_TO_LATEST` translations:

```json
"SCROLL_TO_LATEST": "Scroll to latest messages"
```

```json
"SCROLL_TO_LATEST": "Zu den neuesten Nachrichten scrollen"
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: all chat component tests pass.

### Task 3: Verify the Integrated Change

**Files:**

- Verify all modified source, test, translation, and documentation files.

**Interfaces:**

- Consumes: both completed tasks.
- Produces: a lint-clean, type-safe, regression-tested feature branch.

- [ ] **Step 1: Run both focused suites together**

```bash
npx nx test onecx-chat-ui --runInBand --testPathPattern='(chat-list-screen|chat)\.component\.spec\.ts'
```

Expected: both suites pass.

- [ ] **Step 2: Run project lint**

```bash
npx nx lint onecx-chat-ui
```

Expected: lint passes without new warnings or errors.

- [ ] **Step 3: Run the production build**

```bash
npx nx build onecx-chat-ui --configuration=production
```

Expected: compilation succeeds. Existing bundle-budget warnings may remain, but no new compile or style-budget error is introduced.

- [ ] **Step 4: Review the final diff**

```bash
git diff --check
git diff -- src docs/superpowers
```

Expected: no whitespace errors, unrelated edits, generated coverage artifacts, or changes to the existing `package-lock.json` modification.
