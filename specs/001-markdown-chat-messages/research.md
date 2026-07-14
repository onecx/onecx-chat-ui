# Research: Markdown chat message rendering

## Decision 1: Use `marked` as the markdown engine

- **Why**: The issue explicitly requests `marked`, and it provides a straightforward synchronous `parse` API for converting markdown text to HTML.
- **Impact**: `marked` can be added as a single runtime dependency with built-in TypeScript support, so no `@types/marked` package is required.

## Decision 2: Convert markdown in a standalone Angular pipe

- **Why**: A standalone pipe keeps markdown transformation logic out of the chat component class and lets the template remain concise.
- **Impact**: The pipe can be imported directly into the standalone `ChatComponent` and reused elsewhere later if needed.

## Decision 3: Sanitize generated HTML before DOM binding

- **Why**: `marked` converts markdown to HTML but does not provide Angular-specific DOM safety guarantees.
- **Impact**: The pipe should pass the parsed HTML through Angular's `DomSanitizer.sanitize(SecurityContext.HTML, ...)` before the template binds it with `[innerHTML]`.

## Decision 4: Keep markdown support limited to basic rendering

- **Why**: The issue explicitly excludes special rendering cases such as mermaid diagrams.
- **Impact**: No custom renderer, token walker, or plugin configuration is added; the feature uses the default `marked` output only.
