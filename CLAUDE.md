# Ciph — CLAUDE.md

> Project context for AI assistants. Read before touching any code.

## What is Ciph?

Transparent HTTP encryption library. Encrypts request/response bodies between frontend and backend — plain text never visible in browser Network DevTools. Zero DX change for developers.

**NOT:** TLS replacement, auth/session solution, WebSocket/file upload encryption.

## Monorepo Structure

```
ciph/
├── packages/
│   ├── core/              → @ciph/core (zero-dep crypto primitives)
│   ├── client/            → @ciph/client (axios wrapper, frontend)
│   ├── react/             → @ciph/react (React HTTP client wrapper)
│   ├── hono/              → @ciph/hono (Hono middleware, backend)
│   ├── devtools-client/   → @ciph/devtools-client (floating panel, React)
│   └── devtools-server/   → @ciph/devtools-server (inspector UI at /ciph)
├── example/
│   ├── next/              → Next.js example
│   ├── react/             → React + Hono example
│   ├── svelte/            → Svelte example
│   └── vue/               → Vue example
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

**ECDH Asymmetric (v2.0.0)**

| Layer | Algorithm | Purpose |
|-------|-----------|---------|
| Key exchange | ECDH P-256 | Ephemeral client ↔ static server |
| Session key | HKDF-SHA256 | Derived from ECDH shared secret |
| Request key | HKDF-SHA256 | Session key + fingerprint salt |
| Encryption | AES-256-GCM | Encrypt/decrypt bodies |

**Key pairs:**
- Server: static `CIPH_PRIVATE_KEY` (never exposed), derived public key distributed
- Client: ephemeral per-session, regenerated on CIPH003, kept in memory

**Key derivation chain:**
```
client_privKey + server_pubKey
         ↓ ECDH
   raw_shared_secret
         ↓ HKDF(..., "ciph-v2-session")
    session_key (32 bytes)
         ↓ HKDF(..., fingerprint_hash, "ciph-v2-request")
     request_key (32 bytes)
```

**Ciphertext format:** `base64url(IV[12] + AuthTag[16] + Ciphertext[n])`

**Fingerprint:** SHA-256 of sorted JSON of `{ userAgent, screen, timezone, IP, ...customFields }`
- Encrypted with session_key → `X-Fingerprint` header
- Acts as per-device salt — same payload on different device = different ciphertext

**Headers:**
- `X-Client-PublicKey`: plaintext client ephemeral public key (base64url)
- `X-Fingerprint`: encrypted fingerprint components (base64url)

**Runtime engines:** Web Crypto API (browser/Bun/Deno), `node:crypto` (Node.js)

**Zero external dependencies** in @ciph/core.

---

## @ciph/core — Public API

```ts
// Encryption
encrypt(plaintext, key): Promise<EncryptResult>
decrypt(ciphertext, key): Promise<DecryptResult>

// Key generation
generateServerKeyPair(): Promise<CiphKeyPair>
generateClientKeyPair(): Promise<CiphKeyPair>

// ECDH + Key derivation
deriveSharedSecret(privateKey: string, peerPublicKey: string): Promise<string>
deriveSessionKey(rawShared: string): Promise<string>
deriveRequestKey(sessionKey: string, fingerprint: string): Promise<string>

// Fingerprint
generateFingerprint(components, options?): Promise<FingerprintResult>
validateFingerprint(stored, incoming): boolean

// Utilities
randomBytes(length): Uint8Array
toBase64url(bytes): string
fromBase64url(str): Uint8Array
```

**Key types:** `CiphError`, `CiphErrorCode`, `CiphKeyPair`, `CiphClientLog`, `CiphServerLog`, `CiphCoreConfig`, `FingerprintComponents`, `FingerprintResult`, `EncryptResult`, `DecryptResult`

---

## @ciph/client — Frontend HTTP Client

Wraps axios. Replaces `axios` instance in frontend code. Intercepts all requests/responses transparently.

**Setup (once):**
```ts
// lib/ciph.ts
export const ciph = createClient({
  baseURL: import.meta.env.VITE_API_URL,
  serverPublicKey: import.meta.env.CIPH_PUBLIC_KEY,
  // or: publicKeyEndpoint: "/ciph/public-key" (optional, fetches dynamically)
})
```

**Usage:** `ciph.get()`, `ciph.post()`, `ciph.put()`, `ciph.patch()`, `ciph.delete()` — identical to axios.

**Request interceptor flow:**
1. Check excludeRoutes → skip if match
2. Get/generate ephemeral client key pair (cached per session)
3. Get/fetch server public key (cached)
4. ECDH(client_privKey, server_pubKey) → raw_shared_secret
5. HKDF(raw_shared_secret) → session_key
6. Get/generate fingerprint (cached)
7. HKDF(session_key, fingerprint_hash) → request_key
8. Encrypt fingerprint → `X-Fingerprint` header (with session_key)
9. Encrypt body → with request_key
10. Send (Content-Type: text/plain, X-Client-PublicKey header)

**Response interceptor flow:**
1. 401 CIPH003 → invalidate fingerprint + client key pair, auto-retry once
2. Decrypt body with request_key
3. Emit `CiphClientLog` to devtools (dev only)
4. Return plain `CiphResponse<T>` to caller

**Cache (module-level, per-session):** Fingerprint, client key pair, server public key, session key. NOT in localStorage (XSS risk). Invalidated on CIPH003.

**Key config options:**
```ts
{
  baseURL: string
  serverPublicKey?: string                 // base64url — takes priority
  publicKeyEndpoint?: string               // default: baseURL + "/ciph/public-key"
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
app.use("*", ciph({ privateKey: process.env.CIPH_PRIVATE_KEY! }))
// Public key endpoint auto-registered: GET /ciph/public-key
```

**Phase 1 (pre-handler):**
1. Check excludeRoutes
2. Read `X-Client-PublicKey` → CIPH001 if missing
3. Parse client public key → CIPH002 if invalid
4. ECDH(server_privKey, client_pubKey) → raw_shared_secret → CIPH007 if fails
5. Derive session_key from raw_shared_secret
6. Read `X-Fingerprint` → CIPH001 if missing
7. Decrypt fingerprint with session_key → CIPH004 if fails
8. Validate IP + UA in fingerprint vs request → CIPH003 if mismatch
9. Derive request_key from session_key + fingerprint
10. Check payload size → CIPH005 if too large
11. Decrypt body (POST/PUT/PATCH) with request_key → CIPH004 if fails
12. Inject plain body into context
13. `next()`

**Phase 2 (post-handler):**
1. Intercept handler response
2. Encrypt body with request_key
3. Send ciphertext → CIPH006 if fails
4. Emit `CiphServerLog` (dev only)

**Excluded routes default:** `["/health", "/ciph/public-key", "/ciph", "/ciph/*"]`

**Key config options:**
```ts
{
  privateKey: string             // CIPH_PRIVATE_KEY env var (base64url)
  excludeRoutes?: string[]
  strictFingerprint?: boolean    // default: true — set false behind proxy/NAT
  maxPayloadSize?: number        // default: 10MB
  allowUnencrypted?: boolean     // default: false (no plaintext fallback in v2)
}
```

**Public key endpoint:** `GET /ciph/public-key` — auto-registered, always accessible, returns `{ publicKey: "base64url..." }`

**Per-route exclusion:** `ciphExclude()` middleware helper.

---

## Error Codes

| Code | HTTP | Trigger | Retry? |
|------|------|---------|--------|
| CIPH001 | 401 | Missing X-Client-PublicKey or X-Fingerprint header | No |
| CIPH002 | 401 | Invalid/unparseable client public key (malformed base64url) | No |
| CIPH003 | 401 | Fingerprint IP/UA mismatch (user changed network) | Yes — client auto-retries once |
| CIPH004 | 400 | Body or fingerprint decrypt failed (tampered/corrupt) | No |
| CIPH005 | 413 | Payload exceeds maxPayloadSize | No |
| CIPH006 | 500 | Response encrypt failed | No |
| CIPH007 | 401 | ECDH key derivation failed (malformed client pubkey) | No |

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
app.route("/ciph", ciphDevServer({ privateKey: process.env.CIPH_PRIVATE_KEY! }))
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

## Server Key Pair (ECDH v2)

**Backend (.env):**
```env
CIPH_PRIVATE_KEY=base64url-encoded-P256-private-key
```

**Frontend (.env):**
```env
CIPH_PUBLIC_KEY=base64url-encoded-P256-public-key
```

**Key generation:**
```bash
npx ciph generate-keys
# Outputs CIPH_PRIVATE_KEY + CIPH_PUBLIC_KEY
```

**Security:**
- Private key: backend only, never exposed, min 32 chars when base64url decoded
- Public key: safe to expose, distributed to frontend via env var or `/ciph/public-key` endpoint
- Store private key in Secret Manager (production), never in git

---

## Golden Rule

> Developer should not be able to tell if Ciph is installed or not — **except** when opening the Network tab and seeing ciphertext bodies.

---

## Milestones

| Version | Scope |
|---------|-------|
| v2.0.0 | **ECDH P-256 asymmetric**, `@ciph/core`, `@ciph/client`, `@ciph/react`, `@ciph/hono`, devtools, examples |
| v2.1.0+ | More adapters (Express, NestJS), key rotation enhancements, X25519 migration path |

Versioning: fixed (all packages share same version). Managed via Changesets.
