# @ciph/svelte — Architecture Overview

## Package Structure

```
packages/svelte/
├── src/
│   ├── client.ts              → ciphClient() factory + Svelte stores
│   ├── server.ts              → ciphHooks() + SvelteKit hooks
│   ├── devtools/
│   │   ├── CiphDevtoolsPanel.svelte  → Floating devtools UI (Svelte)
│   │   ├── emitter.ts                → Re-export @ciph/core emitters
│   │   └── index.ts                  → DevTools config & buffer
│   └── index.ts               → Public exports
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Design Principles

1. **Zero DX Change** — Developers use standard SvelteKit patterns, encryption is transparent
2. **Svelte Idiomatic** — Uses Svelte stores for reactivity, not custom events or callbacks
3. **Server-Side Standard** — Uses SvelteKit `handle` hook, not custom middleware registration
4. **Type-Safe** — Full TypeScript support, strict mode, no `any`
5. **Production-Ready** — DevTools auto-disabled in production, circular buffer management

## Client-Side Flow

```
Component
    ↓
ciphClient.post(/api/endpoint, data)
    ↓
Request Interceptor
├─ Check excludeRoutes → skip if excluded
├─ Generate/cache fingerprint
├─ Derive ECDH session key
├─ Derive request key (session key + fingerprint)
├─ Encrypt body → AES-256-GCM
├─ Set headers:
│  ├─ X-Fingerprint: <encrypted-fingerprint>
│  ├─ X-Client-PublicKey: <client-ecdh-public>
│  └─ Content-Type: text/plain
└─ Send encrypted request
    ↓
HTTP → Server
    ↓
Response (encrypted text)
    ↓
Response Interceptor
├─ On 401 CIPH003 → Auto-retry with fresh fingerprint
├─ Decrypt body with same request key
├─ Parse JSON
├─ Emit log to devtools (dev only)
└─ Return CiphResponse<T>
    ↓
Component receives plaintext data
```

## Server-Side Flow

**Note:** The server implementation uses SvelteKit's `handle` hook, which is a standard pattern for middleware. This differs slightly from traditional middleware registration but follows SvelteKit conventions.

```
Request
    ↓
SvelteKit Router
    ↓
ciphHooks() → handle function
│
├─ Phase 1: Pre-handler decryption
│  ├─ Check excludeRoutes → pass through if excluded
│  ├─ Read X-Fingerprint, X-Client-PublicKey headers
│  ├─ Validate headers (CIPH001 if missing)
│  ├─ Derive ECDH session key from client public key
│  ├─ Validate fingerprint (CIPH002-003 if failed)
│  ├─ Decrypt request body (if POST/PUT/PATCH)
│  ├─ Inject plaintext body into event.request
│  └─ → resolve(event) [call handler]
│
├─ Handler runs (your route)
│  └─ receives plaintext request body
│
└─ Phase 2: Post-handler encryption
   ├─ Get response body
   ├─ Encrypt with same request key
   ├─ Return encrypted response (text/plain)
   └─ Emit log to devtools (dev only)
    ↓
Response (encrypted)
    ↓
Client Response Interceptor
```

## Stores

The client exposes three reactive stores for component integration:

### fingerprintStore
- **Type:** `Readable<string | null>`
- **Updated:** On first request, or after CIPH003 retry
- **Use:** Display device info, debug fingerprinting issues

### errorStore
- **Type:** `Readable<CiphError | null>`
- **Updated:** When encryption, decryption, or network error occurs
- **Use:** Error ui, logging, user notifications

### isEncryptingStore
- **Type:** `Readable<boolean>`
- **Updated:** During request/response processing
- **Use:** Loading indicators, disable buttons

## Key Comparison: Client vs Server

### Client (@ciph/svelte)
- **Transport:** HTTP (axios)
- **Integration:** Svelte stores
- **Reactivity:** Automatic (Svelte reactivity)
- **State:** Module-level cache (fingerprint, session key, key pair)
- **Lifecycle:** Per-tab (BroadcastChannel optional for sync)

### Server (@ciph/svelte)
- **Transport:** SvelteKit RequestEvent
- **Integration:** `handle()` hook
- **Middleware Philosophy:** Phase-based (pre-handler, post-handler)
- **State:** Per-request (RequestState map)
- **DevTools:** SSE stream (optional, for future extension)

## Cryptography

### Asymmetric Key Exchange (ECDH)
- **Curve:** P-256 (secp256r1)
- **Client:** Generates ephemeral key pair per session
- **Server:** Static key pair (CIPH_PRIVATE_KEY env var)
- **Shared Secret:** 256 bits (32 bytes) via ECDH derivation

### Symmetric Encryption (Request/Response)
- **Algorithm:** AES-256-GCM
- **Key Derivation:**
  ```
  session_key = HKDF-SHA256(ecdh_bits, label="ciph-v2-session")
  request_key = HKDF-SHA256(session_key, salt=fingerprint_hash, label="ciph-v2-request")
  ```
- **Ciphertext Format:** `base64url(IV[12] + AuthTag[16] + Ciphertext[n])`

## State Management

### Client (Module-level cache)
```typescript
let cachedFingerprint: string | null = null    // Persists per tab
let cachedSessionKey: string | null = null     // Persists per tab
let cachedKeyPair: CiphKeyPair | null = null   // Persists per tab
```

**Invalidation:** Fresh key pair + fingerprint on CIPH003 retry; session key persists.

### Server (Per-request state)
```typescript
const requestStates = new WeakMap<RequestEvent, RequestState>()
```

**Cleanup:** Automatic via WeakMap garbage collection after request completes.

## DevTools Integration

### Client DevTools (CiphDevtoolsPanel.svelte)
- Floating, resizable panel
- Subscribes to `ciphClientEmitter` from @ciph/core
- Displays: Method, route, status, encrypted flag, timestamp
- Details: Plain body, encrypted body (truncated), error info
- Keyboard shortcut: `Ctrl+Shift+C` (configurable)
- Max logs: 100 (configurable)
- **Production guard:** Component returns `null` + tree-shaken by bundler

### Server DevTools (via hooks)
- Emits labels to `ciphServerEmitter` (optional, for future SSE stream)
- Log buffer (500 max, configurable)
- Integration point for `/ciph` inspector UI (not included in this package)

## Error Handling Strategy

### Client
1. **Encryption fails** → Fallback to plain (if enabled) or throw
2. **Fingerprint mismatch (401 CIPH003)** → Auto-retry with fresh fingerprint
3. **Decryption fails** → Log error, store in errorStore
4. **Network error** → Propagate as Axios error

### Server
1. **Missing headers** → 401 CIPH001
2. **Fingerprint decrypt fails** → 401 CIPH002
3. **Fingerprint validation fails** → 401 CIPH003
4. **Body decrypt fails** → 400 CIPH004
5. **Payload too large** → 413 CIPH005
6. **Response encrypt fails** → 500 CIPH006

Never leak stack traces in production.

## Performance Considerations

- **Key Caching:** Session key cached per tab lifetime (no regeneration on every request)
- **Fingerprint Caching:** Generated once, persists until CIPH003 retry
- **Store Subscriptions:** Svelte reactivity auto-unsubscribes, no manual cleanup needed
- **DevTools Overhead:** Zero in production (tree-shaken)
- **Payload Size:** Max 10 MB (configurable)

## Testing Considerations

- Mock `axios` for client tests
- Mock `@ciph/core` crypto functions for deterministic tests
- Use `_testOverrides` in config for test-specific behavior
- DevTools disabled in test environment by default
