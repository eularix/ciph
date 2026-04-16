# API Reference — @ciph/devtools-client

## `<CiphDevtools />`

The only public export. A React component that renders the floating button and panel.

### Basic Setup

```tsx
// src/App.tsx
import { CiphDevtools } from "@ciph/devtools-client"

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <CiphDevtools />
    </>
  )
}
```

No additional configuration needed. The component automatically:
- Subscribes to `@ciph/client` log events
- Renders nothing in production (`NODE_ENV === "production"`)
- Cleans up subscriptions on unmount

---

### Props

```ts
interface CiphDevtoolsProps {
  /**
   * Initial position of the floating button.
   * User can drag it to any position after render.
   * Default: "bottom-right"
   */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"

  /**
   * Whether the panel starts open on first render.
   * Default: false
   */
  defaultOpen?: boolean

  /**
   * Maximum number of log entries stored in memory.
   * Oldest entries are dropped when limit is reached (circular buffer).
   * Default: 100
   */
  maxLogs?: number

  /**
   * Keyboard shortcut to toggle the panel.
   * Default: "ctrl+shift+c"
   * Set to null to disable shortcut.
   */
  shortcut?: string | null

  /**
   * Force disable the devtools even in development.
   * Useful for E2E tests where the panel interferes with UI.
   * Default: false
   */
  disabled?: boolean
}
```

---

### Full Example with Props

```tsx
<CiphDevtools
  position="bottom-right"
  defaultOpen={false}
  maxLogs={200}
  shortcut="ctrl+shift+c"
/>
```

---

## Production Guard

The component is safe to leave in the codebase permanently. It will **never render or add any bundle overhead** in production:

```ts
// Internal guard inside @ciph/devtools-client
if (process.env.NODE_ENV === "production") {
  // Component renders null — no DOM, no event subscriptions, no memory usage
  return null
}
```

Bundlers (Vite, webpack, esbuild) will tree-shake the entire component body when `NODE_ENV=production`, resulting in **zero bytes** added to the production bundle.

To verify, inspect your production bundle — the string `"CiphDevtools"` should not appear.
