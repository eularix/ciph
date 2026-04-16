# @ciph/devtools-client — Overview

> A floating developer panel for inspecting decrypted Ciph request/response data in the browser.

## Purpose

When Ciph is active, the browser Network tab only shows ciphertext — making it impossible to debug API payloads the normal way. `@ciph/devtools-client` solves this by providing a draggable floating panel that shows all plain (decrypted) request and response data in real time.

## How It Works

`@ciph/devtools-client` subscribes to the internal event emitter exposed by `@ciph/client`. After every request completes, `@ciph/client` emits a `CiphClientLog` event containing both the plain and encrypted versions of the payload. The devtools panel captures these events and renders them in a readable UI.

```
@ciph/client  →  ciphClientEmitter.emit("log", CiphClientLog)
                                    ↓
                         @ciph/devtools-client
                         subscribes & renders
                                    ↓
                      Floating panel in the browser
                      shows plain request/response
```

## Key Characteristics

- **Dev-only** — completely tree-shaken in production builds; zero bytes added to prod bundle
- **Zero configuration** — drop `<CiphDevtools />` in `App.tsx` and it works
- **No prop drilling** — communicates with `@ciph/client` via shared emitter from `@ciph/core`; no need to pass the `ciph` instance
- **Draggable** — floating button can be repositioned anywhere on screen
- **Keyboard shortcut** — toggle panel without clicking (`Ctrl+Shift+C` default)

## What This Package Does NOT Do

- Does not intercept or modify any network requests
- Does not store logs persistently (cleared on page refresh)
- Does not expose any data outside the browser tab
- Does not work in production (`NODE_ENV === "production"`)
- Does not sync with `@ciph/devtools-server` (they are independent)

## Runtime

| Runtime  | Support |
|----------|---------|
| Browser  | ✅      |
| Node.js  | ❌ (browser-only) |

## Dependencies

| Package                | Role                                    |
|------------------------|-----------------------------------------|
| `@ciph/core`           | `CiphClientLog` type + shared emitter   |
| `react` (≥ 18)         | Peer dependency — UI rendering          |
| `react-dom` (≥ 18)     | Peer dependency                         |
