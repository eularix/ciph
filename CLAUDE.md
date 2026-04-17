# Ciph — CLAUDE.md

> Project context for AI assistants. Read before touching any code.

## What is Ciph?

Transparent HTTP encryption library. Encrypts request/response bodies between frontend and backend — plain text never visible in browser Network DevTools. Zero DX change for developers.

**NOT:** TLS replacement, auth/session solution, WebSocket/file upload encryption (v1).

## Monorepo Structure

```
ciph/
├── packages/
│   ├── core/              → @ciph/core (zero-dep crypto primitives)
│   ├── client/            → @ciph/client (axios wrapper, frontend)
│   ├── hono/              → @ciph/hono (Hono middleware, backend)
│   ├── devtools-client/   → @ciph/devtools-client (floating panel, React)
│   └── devtools-server/   → @ciph/devtools-server (inspector UI at /ciph)
├── modules/
│   └── ciph-go/           → Go module (future)
├── examples/
│   ├── react-hono/
│   ├── vue-express/
│   └── svelte-hono/
├── docs/
├── pnpm-workspace.yaml
├── turbo.json
└── CONTEXT.md             ← canonical project truth
```

## Package Dependency Rules

```
@ciph/devtools-client
        │ subscribes to events
        ▼
   @ciph/client ──────────────────────────────┐
        │ depends on                           │
        ▼                                      │
   @ciph/core  ◀─────────── @ciph/hono         │
                                  │            │
                                  ▼            │
                     @ciph/devtools-server ◀───┘
```

- **@ciph/core must NOT depend on any other @ciph package**
- No circular dependencies

## Tooling

| Tool | Purpose |
|------|---------|
| pnpm workspaces | Package manager |
| Turborepo | Monorepo runner |
| TypeScript 5, strict | Language |
| Vitest | Tests |
| tsup | Bundler (ESM + CJS + d.ts) |
| napi-rs | Future native addon |

**TypeScript rules:** No `any`. No `@ts-ignore` without explanation. `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`.

## Build Output (per package)

```
packages/<name>/dist/
  ├── index.js      (ESM)
  ├── index.cjs     (CJS)
  └── index.d.ts    (types)
```

---

## Cryptography (from @ciph/core)

**Algorithm:** AES-256-GCM

**Ciphertext format:** `base64url(IV[12] + AuthTag[16] + Ciphertext[n])`

**Key derivation:** `HKDF-SHA256(secret=CIPH_SECRET, ikm=fingerprint, info="ciph-v1") → 32 bytes`

**Fingerprint:** SHA-256 of sorted JSON of `{ userAgent, screen, timezone, ...customFields }`
- Generated client-side, encrypted with raw `CIPH_SECRET` for `X-Fingerprint` header
- Acts as per-device salt — same payload on different device = different ciphertext

**Runtime engines:** Web Crypto API (browser/Bun/Deno), `node:crypto` (Node.js)

**Zero external dependencies** in @ciph/core.

---

## @ciph/core — Public API

```ts
encrypt(plaintext, key): Promise<EncryptResult>
decrypt(ciphertext, key): Promise<DecryptResult>
deriveKey(secret, fingerprint): Promise<string>
generateFingerprint(components, options?): Promise<FingerprintResult>
encryptFingerprint(fingerprint, secret): Promise<string>
decryptFingerprint(encrypted, secret): Promise<string>
validateFingerprint(stored, incoming): boolean
randomBytes(length): Uint8Array
toBase64url(bytes): string
fromBase64url(str): Uint8Array
```

**Key types:** `CiphError`, `CiphErrorCode`, `CiphClientLog`, `CiphServerLog`, `CiphCoreConfig`, `FingerprintComponents`, `FingerprintResult`, `EncryptResult`, `DecryptResult`

---

## @ciph/client — Frontend HTTP Client

Wraps axios. Replaces `axios` instance in frontend code. Intercepts all requests/responses transparently.

**Setup (once):**
```ts
// lib/ciph.ts
export const ciph = createClient({
  baseURL: import.meta.env.VITE_API_URL,
  secret: import.meta.env.VITE_CIPH_SECRET,
})
```

**Usage:** `ciph.get()`, `ciph.post()`, `ciph.put()`, `ciph.patch()`, `ciph.delete()` — identical to axios.

**Request interceptor flow:**
1. Check excludeRoutes → skip if match
2. Get/generate fingerprint (cached in module-level variable, not localStorage)
3. Encrypt fingerprint → `X-Fingerprint` header
4. Derive AES key via HKDF
5. Encrypt body
6. Send (Content-Type: text/plain)

**Response interceptor flow:**
1. 401 CIPH003 → auto-retry once with fresh fingerprint
2. Decrypt body with derived key
3. Emit `CiphClientLog` to devtools (dev only)
4. Return plain `CiphResponse<T>` to caller

**Fingerprint cache:** Module-level variable, lives for tab lifetime. NOT in localStorage (XSS risk). Invalidated on CIPH003.

**Key config options:**
```ts
{
  baseURL: string
  secret: string                           // min 32 chars
  excludeRoutes?: string[]                 // default: ["/health"]
  onFingerprintMismatch?: "retry" | "throw" | "ignore"  // default: "retry"
  fallbackToPlain?: boolean                // default: false, never use in prod
  fingerprintOptions?: { includeScreen?, includeTimezone?, customFields? }
}
```

---

## @ciph/hono — Backend Middleware

Single middleware, applied once at root. Handles Phase 1 (pre-handler: decrypt request) and Phase 2 (post-handler: encrypt response).

**Setup:**
```ts
app.use("*", ciph({ secret: process.env.CIPH_SECRET! }))
```

**Phase 1 (pre-handler):**
1. Check excludeRoutes
2. Read `X-Fingerprint` → CIPH001 if missing
3. Decrypt fingerprint → CIPH002 if fails
4. Validate IP + UA vs request → CIPH003 if mismatch
5. Check payload size → CIPH005 if too large
6. Decrypt body (POST/PUT/PATCH) → CIPH004 if fails
7. Inject plain body into context
8. `next()`

**Phase 2 (post-handler):**
1. Intercept handler response
2. Encrypt body with same derived key
3. Send ciphertext → CIPH006 if fails
4. Emit `CiphServerLog` (dev only)

**Excluded routes default:** `["/health", "/ciph", "/ciph/*"]`

**Key config options:**
```ts
{
  secret: string
  excludeRoutes?: string[]
  strictFingerprint?: boolean    // default: true — set false behind proxy/NAT
  maxPayloadSize?: number        // default: 10MB
  allowUnencrypted?: boolean     // default: false, for migration only
}
```

**Per-route exclusion:** `ciphExclude()` middleware helper.

---

## Error Codes

| Code | HTTP | Trigger | Retry? |
|------|------|---------|--------|
| CIPH001 | 401 | Missing X-Fingerprint header | No |
| CIPH002 | 401 | Fingerprint decrypt failed (wrong secret) | No — config error |
| CIPH003 | 401 | Fingerprint IP/UA mismatch (user changed network) | Yes — client auto-retries once |
| CIPH004 | 400 | Body decrypt failed (tampered/corrupt) | No |
| CIPH005 | 413 | Payload exceeds maxPayloadSize | No |
| CIPH006 | 500 | Response encrypt failed | No |

**Error response shape:**
```json
{ "code": "CIPH003", "message": "Fingerprint mismatch: IP address changed" }
```

**Never leak stack traces in HTTP responses.**

---

## @ciph/devtools-client — Browser Floating Panel (React)

Dev-only floating panel showing decrypted request/response data. Subscribes to `ciphClientEmitter` from `@ciph/core`.

**Setup (App.tsx):**
```tsx
import { CiphDevtools } from "@ciph/devtools-client"
// Inside App component:
<CiphDevtools />
```

No props required. No need to pass ciph instance.

**Panel features:**
- Draggable, resizable (700×400px default)
- Log list: METHOD / ROUTE / STATUS / TIME / ENC columns
- Row click → detail panel: plain body, encrypted body (truncated + copy), headers, fingerprint info
- `Ctrl+Shift+C` toggle shortcut (configurable)
- Circular buffer, 100 logs default, newest first

**Props:**
```ts
{
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  defaultOpen?: boolean
  maxLogs?: number          // default: 100
  shortcut?: string | null  // default: "ctrl+shift+c"
  disabled?: boolean
}
```

**Production guard:** Returns `null` + tree-shaken by bundler. Zero bytes in prod bundle.

---

## @ciph/devtools-server — Backend Inspector UI

Dev-only. Serves vanilla HTML/CSS/JS inspector at `/ciph`. Receives logs via SSE from `/ciph/stream`.

**Setup:**
```ts
// Always after ciph middleware
app.route("/ciph", ciphDevServer({ secret: process.env.CIPH_SECRET! }))
```

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | /ciph | Inspector UI (vanilla HTML) |
| GET | /ciph/stream | SSE stream of CiphServerLog |
| GET | /ciph/logs | All buffered logs as JSON |
| DELETE | /ciph/logs | Clear buffer |
| GET | /ciph/health | `{ status: "ok" }` |

**SSE format:** `event: ciph-log\ndata: <JSON>\n\n`. Keepalive comment every 30s. Max 10 concurrent connections.

**Buffer:** Circular, 500 logs default, in-memory only, ephemeral.

**Production guard (3 layers):**
1. `@ciph/hono` stops emitting events
2. Buffer never initialized
3. All `/ciph/*` routes return 404

**Recommendation:** Add as `devDependency`, conditionally import in dev only.

---

## DevTools Communication Architecture

```
@ciph/client  →  ciphClientEmitter.emit("log", CiphClientLog)
                         ↓
              @ciph/devtools-client subscribes
                         ↓
              Floating panel in browser

@ciph/hono  →  ciphServerEmitter.emit("log", CiphServerLog)
                         ↓
              @ciph/devtools-server subscribes → SSE buffer
                         ↓
              Browser at /ciph via SSE
```

Both emitters exported from `@ciph/core`. No direct dependency between devtools packages and main packages (beyond the emitter).

---

## Shared Secret (`CIPH_SECRET`)

- Env var name: `CIPH_SECRET`
- Must be **identical** on frontend and backend
- **Minimum 32 characters**
- Store in Secret Manager in production, never in git
- Frontend: `VITE_CIPH_SECRET` (Vite), or equivalent
- Backend: `process.env.CIPH_SECRET`

---

## Golden Rule

> Developer should not be able to tell if Ciph is installed or not — **except** when opening the Network tab and seeing ciphertext bodies.

---

## Milestones

| Version | Scope |
|---------|-------|
| v0.1.0 | `@ciph/core`, `@ciph/client`, `@ciph/hono` |
| v0.2.0 | `@ciph/devtools-client`, `@ciph/devtools-server` |
| v0.3.0+ | More adapters (Express, NestJS, Svelte), `@ciph/core-native` (Rust/napi-rs) |

Versioning: fixed (all packages share same version). Managed via Changesets.
