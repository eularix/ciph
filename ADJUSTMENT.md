# Ciph — Adjustment Plan

> Tracked deviations and intentional changes from the original CONTEXT.md plan.

---

## ADJ-001 — Rename `@ciph/client` → `@ciph/react`

### Decision

`packages/client/` is renamed to `packages/react/` and published as `@ciph/react`.  
The package becomes React-specific instead of a generic framework-agnostic HTTP wrapper.

### Rationale

- Current `@ciph/client` has zero React code — but its primary consumer is React apps
- Making it React-specific allows adding first-class hooks and `CiphProvider` context
- Future framework adapters (`@ciph/vue`, `@ciph/svelte`) can be separate packages with the same pattern
- Keeps the API idiomatic per ecosystem rather than a lowest-common-denominator wrapper

---

### New Package Identity

| | Before | After |
|-|--------|-------|
| npm name | `@ciph/client` | `@ciph/react` |
| directory | `packages/client/` | `packages/react/` |
| peer deps | `axios` | `axios`, `react ≥ 18`, `react-dom ≥ 18` |
| entry point | `createClient()` | `CiphProvider` + hooks + `createClient()` |

---

### New Public API

#### `<CiphProvider>` — Root Provider

Replaces `createClient()` as the primary setup method. Wraps the app and provides the ciph client via React context.

```tsx
// main.tsx or App.tsx
import { CiphProvider } from "@ciph/react"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <CiphProvider
    baseURL={import.meta.env.VITE_API_URL}
    secret={import.meta.env.VITE_CIPH_SECRET}
  >
    <App />
  </CiphProvider>
)
```

Props mirror `CiphClientConfig`:

```ts
interface CiphProviderProps {
  baseURL: string
  secret: string
  excludeRoutes?: string[]
  fingerprintOptions?: FingerprintOptions
  onFingerprintMismatch?: "retry" | "throw" | "ignore"
  fallbackToPlain?: boolean
  headers?: Record<string, string>
  children: React.ReactNode
}
```

---

#### `useCiph()` — Access Client Instance

Returns the ciph client from context. Use in service layer or components.

```ts
import { useCiph } from "@ciph/react"

function useEmployees() {
  const ciph = useCiph()
  return useQuery({
    queryKey: ["employees"],
    queryFn: () => ciph.get("/employees").then(r => r.data),
  })
}
```

Throws if called outside `<CiphProvider>`.

---

#### `createClient()` — Escape Hatch (Still Exported)

For use outside React component tree (e.g., server actions, test utils, non-React environments in the same project).

```ts
import { createClient } from "@ciph/react"

// Still works — same API as before
export const ciph = createClient({
  baseURL: "https://api.example.com",
  secret: process.env.CIPH_SECRET!,
})
```

`createClient` is the same implementation as current `@ciph/client`. `CiphProvider` uses it internally.

---

#### `useCiphQuery()` and `useCiphMutation()` — Optional TanStack Query Wrappers

Only available if `@tanstack/react-query` is installed (optional peer dep). Tree-shaken if not used.

```ts
// GET with automatic encryption
const { data } = useCiphQuery({
  path: "/employees",
  queryKey: ["employees"],
})

// POST/PATCH/DELETE with encryption
const mutation = useCiphMutation({
  path: "/employees",
  method: "POST",
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
})
```

If TanStack Query not installed, these throw a clear error:
```
CiphError: useCiphQuery requires @tanstack/react-query to be installed
```

---

### Updated Peer Dependencies

```json
{
  "peerDependencies": {
    "@ciph/core": "workspace:*",
    "axios": "^1.0.0",
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "@tanstack/react-query": {
      "optional": true
    }
  }
}
```

---

### Updated Monorepo Structure

```text
ciph/
├── packages/
│   ├── core/              → @ciph/core
│   ├── react/             → @ciph/react          ← was packages/client/
│   ├── hono/              → @ciph/hono
│   ├── devtools-client/   → @ciph/devtools-client
│   └── devtools-server/   → @ciph/devtools-server
```

---

### Updated Package Dependency Graph

```text
@ciph/devtools-client
        │
        ▼ subscribes to events
   @ciph/react ──────────────────────────────────┐
        │                                        │
        ▼ depends on                             │
   @ciph/core  ◀──────────────── @ciph/hono      │
                                      │          │
                                      ▼          │
                          @ciph/devtools-server ◀─┘
```

---

### Impact on CONTEXT.md

| Section | Old | New |
|---------|-----|-----|
| Package registry table | `@ciph/client` — HTTP client wrapper | `@ciph/react` — React client wrapper |
| Monorepo structure | `packages/client/` | `packages/react/` |
| Dependency graph | `@ciph/client` | `@ciph/react` |

Update `CONTEXT.md` and `CLAUDE.md` when this ADJ is implemented.

---

### Future Adapters (Same Pattern)

| Package | Framework | Status |
|---------|-----------|--------|
| `@ciph/react` | React ≥ 18 | This ADJ |
| `@ciph/vue` | Vue 3 | Future |
| `@ciph/svelte` | Svelte 5 | Future |
| `@ciph/vanilla` | No framework (plain `createClient`) | Could extract from `@ciph/react` |

---

### Migration for Existing Users

```ts
// Before (if anyone used @ciph/client during internal dev)
import { createClient } from "@ciph/client"
const ciph = createClient({ baseURL, secret })

// After — option 1: provider (recommended)
import { CiphProvider, useCiph } from "@ciph/react"

// After — option 2: still works, same function
import { createClient } from "@ciph/react"
const ciph = createClient({ baseURL, secret })
```

---
