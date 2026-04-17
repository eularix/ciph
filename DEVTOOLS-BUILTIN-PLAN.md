# Ciph — Built-in Devtools + Response Format Migration

> Migration plan. Do not implement until this document is approved.

---

## Problems Being Solved

| # | Problem | Root Cause |
|---|---------|-----------|
| 1 | Devtools require manual setup (`new CiphDevtoolsServer`, `<CiphDevtools />`) | Devtools live in separate packages, user wires them |
| 2 | Response body arrives as raw `text/plain` ciphertext | Hono middleware sets `Content-Type: text/plain`, no wrapper |
| 3 | Devtools panels capture 0 logs | `@ciph/react` client NEVER emits to `__ciphClientEmitter__`; emitter setup is manual |

---

## Change 1 — Response Format

### Current
```
HTTP 200
Content-Type: text/plain
Body: AGFhYmJjY2...   ← raw base64url ciphertext
```

### After
```
HTTP 200
Content-Type: application/json
Body: { "status": "encrypted", "data": "AGFhYmJjY2..." }
```

### Why
- Standard JSON stays compatible with any HTTP client, proxy, load balancer
- `status: "encrypted"` is a machine-readable signal for the client to decrypt
- Easier to debug in network tab (you see valid JSON, not raw string)

### Files changed
- `packages/hono/src/index.ts` — wrap response in `{ status, data }` shape
- `packages/react/src/client.ts` — response interceptor checks for `{ status: "encrypted", data }` shape before decrypting

### Contract
```ts
// Encrypted wire format (both directions: response, and future encrypted body)
interface CiphWirePayload {
  status: "encrypted"
  data: string  // base64url ciphertext
}
```

---

## Change 2 — Fix Devtools Log Capture

### Root cause

`packages/react/src/client.ts` — request/response interceptors do all encryption work but **never emit** to `globalThis.__ciphClientEmitter__`. The emitter exists in `@ciph/devtools-client` but nothing feeds it.

### Fix in `@ciph/react`

Add emit calls in both interceptors:

```ts
// After successful request build (request interceptor):
emitClientLog({
  method, route, status: 0,
  request: { plainBody, encryptedBody, headers },
  response: { plainBody: null, encryptedBody: null },
  fingerprint: { value: fingerprintHash, cached: wasSessionCached, retried: false },
  excluded,
  error: null,
})

// After successful response decrypt (response interceptor):
emitClientLog({ ...req, response: { plainBody: decrypted, encryptedBody } })
```

Add `emitClientLog()` helper in client.ts:

```ts
function emitClientLog(log: CiphClientLog): void {
  const g = globalThis as { __ciphClientEmitter__?: { emit: (e: string, l: unknown) => void } }
  g.__ciphClientEmitter__?.emit('log', log)
}
```

### Fix in `@ciph/hono`

`globalThis.ciphServerEmitter` must exist before the middleware emits. Currently the user creates it in their own `index.ts`. This is fragile.

Fix: `ciph()` auto-initializes the emitter if not already present:

```ts
// In ciph() factory function, before returning middleware:
if (process.env.NODE_ENV !== 'production') {
  if (!globalThis.ciphServerEmitter) {
    const { EventEmitter } = await import('node:events')
    globalThis.ciphServerEmitter = new EventEmitter()
  }
}
```

---

## Change 3 — Built-in Devtools

### Goal

Zero-config devtools. User installs `@ciph/hono` or `@ciph/react` and gets devtools automatically in `development` mode. No separate package import needed.

### 3a — `@ciph/hono` built-in server inspector

Move `@ciph/devtools-server` functionality into `@ciph/hono` as an optional internal feature.

`ciph()` in dev mode:
1. Auto-initializes `globalThis.ciphServerEmitter` (see Change 2 fix above)
2. Auto-starts the HTTP+WebSocket inspector server on a configurable port (default `4321`)
3. Inspector UI served at `http://localhost:4321/`
4. All fully tree-shaken and no-op in `production`

Config:

```ts
ciph({
  privateKey: process.env.CIPH_PRIVATE_KEY!,
  devtools: {
    enabled: true,     // default: process.env.NODE_ENV !== 'production'
    port: 4321,        // default: 4321
  }
})
```

Package changes:
- `@ciph/hono/package.json` → add `ws` as optional dependency (already used by devtools-server)
- `packages/hono/src/devtools.ts` → extracted devtools server logic (copied from devtools-server, stripped to essentials)
- `packages/hono/src/index.ts` → `ciph()` lazily calls `startDevtools()` in dev mode

### 3b — `@ciph/react` built-in floating panel

Move `@ciph/devtools-client` floating panel into `@ciph/react`.

`CiphProvider` in dev mode:
1. Auto-initializes `globalThis.__ciphClientEmitter__`
2. Automatically renders `<CiphDevtools />` floating panel (no extra JSX needed)
3. Passes `inspectorUrl="/ciph-inspector"` so "↗ Full Inspector" opens correctly
4. Fully tree-shaken in `production` (`process.env.NODE_ENV` guard)

Config:

```tsx
<CiphProvider
  baseURL="..."
  serverPublicKey="..."
  devtools={{ enabled: true, inspectorUrl: '/ciph-inspector' }}   // optional, all defaults work
>
  {children}
</CiphProvider>
```

`CiphProvider` props change:

```ts
interface CiphProviderProps extends CiphClientConfig {
  children: React.ReactNode
  devtools?: {
    enabled?: boolean           // default: process.env.NODE_ENV !== 'production'
    inspectorUrl?: string       // default: '/ciph-inspector'
    maxLogs?: number            // default: 500
    defaultOpen?: boolean       // default: false
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  } | false                     // false = disable entirely
}
```

Package changes:
- `packages/react/src/context.tsx` → `CiphProvider` renders `<CiphDevtools />` automatically, sets up `__ciphClientEmitter__`
- `packages/react/src/devtools/` → inline React devtools panel (copy from devtools-client, stripped to essentials)
- `packages/react/package.json` → `react` remains peer dep (already is)

---

## What Happens to `@ciph/devtools-server` and `@ciph/devtools-client`

| Package | After migration |
|---------|----------------|
| `@ciph/devtools-server` | Kept as standalone (for non-Hono adapters like Express, NestJS). Internal logic now shared via `@ciph/core` event types. |
| `@ciph/devtools-client` | Kept as standalone (for non-React frontends). `BroadcastChannel` relay stays. |

Both packages remain published and functional. Built-in devtools in `@ciph/hono` / `@ciph/react` are the **recommended path** for those specific stacks.

---

## Dependency Changes

```
Before:
  @ciph/hono         → @ciph/core
  @ciph/devtools-server → @ciph/core, ws
  user app           → @ciph/hono, @ciph/devtools-server (manual wiring)

After:
  @ciph/hono         → @ciph/core, ws (optional dev dep)
  user app           → @ciph/hono only
```

```
Before:
  @ciph/react        → @ciph/core, axios
  @ciph/devtools-client → @ciph/core, react
  user app           → @ciph/react, @ciph/devtools-client (manual wiring)

After:
  @ciph/react        → @ciph/core, axios, react (peer)
  user app           → @ciph/react only
```

---

## Migration Path for Existing Users

```ts
// Before
import { ciph } from '@ciph/hono'
import { CiphDevtoolsServer } from '@ciph/devtools-server'
const devtools = new CiphDevtoolsServer({ port: 4321 })
await devtools.start()
app.use('/*', ciph({ privateKey: '...' }))

// After
import { ciph } from '@ciph/hono'
app.use('/*', ciph({ privateKey: '...' }))
// devtools auto-start at http://localhost:4321 in dev mode
```

```tsx
// Before
import { CiphProvider } from '@ciph/react'
import { CiphDevtools } from '@ciph/devtools-client'
<CiphProvider ...>
  <App />
  <CiphDevtools />
</CiphProvider>

// After
import { CiphProvider } from '@ciph/react'
<CiphProvider ...>
  <App />
  {/* devtools panel auto-rendered in dev mode */}
</CiphProvider>
```

---

## Implementation Order

1. **Change 2** (fix log capture) — prerequisite for devtools to be useful at all
2. **Change 1** (response format) — independent, do first to unblock JSON response
3. **Change 3a** (hono built-in devtools)
4. **Change 3b** (react built-in devtools)
5. Update both examples to remove manual devtools wiring
6. Rebuild all packages + test

---

## Files Touch Map

| File | Change |
|------|--------|
| `packages/core/src/types.ts` | Add `CiphWirePayload` interface |
| `packages/hono/src/index.ts` | Wrap response in `CiphWirePayload`; auto-init emitter; auto-start devtools |
| `packages/hono/src/devtools.ts` | New file — inline devtools server (HTTP + WS + HTML) |
| `packages/react/src/client.ts` | Detect `CiphWirePayload` shape; emit `CiphClientLog` after each request |
| `packages/react/src/context.tsx` | Auto-init `__ciphClientEmitter__`; auto-render devtools panel |
| `packages/react/src/devtools/` | New dir — inline React floating panel + inspector page |
| `example/hono/src/index.ts` | Remove manual devtools setup |
| `example/react/src/main.tsx` | Remove `<CiphDevtools />` import |
