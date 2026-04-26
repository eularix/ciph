# Ciph v2 — ECDH Asymmetric Migration Plan

> Major architecture change: replace shared `CIPH_SECRET` with ECDH key exchange.
> Target: v0.4.0

---

## Problem with Current Symmetric Design

- `CIPH_SECRET` lives in **both** frontend and backend
- Frontend env vars are accessible to anyone who inspects the built JS bundle
- Attacker who reads `CIPH_SECRET` can decrypt all traffic
- No forward secrecy — one leaked secret compromises all past/future traffic

---

## New Design: ECDH Hybrid Encryption

### Algorithm Stack

| Layer | Algorithm | Purpose |
|-------|-----------|---------|
| Key exchange | ECDH P-256 | Derive shared secret between client + server |
| Key derivation (session) | HKDF-SHA256 | Derive session key from ECDH output |
| Key derivation (request) | HKDF-SHA256 | Bind session key to device fingerprint |
| Encryption | AES-256-GCM | Encrypt/decrypt bodies (unchanged) |
| Fingerprint hash | SHA-256 | Device binding (unchanged) |

### Why P-256 (not X25519)

- P-256 (`ECDH` with named curve `P-256`) has full Web Crypto API support across all targets
- X25519 support in Web Crypto is not yet universal in older Node.js versions
- P-256 is NIST-approved, widely audited
- Can upgrade to X25519 in v0.5+ once Web Crypto standardization stabilizes

---

## Key Architecture

### Server Key Pair (static, long-lived)

```
Server generates once:
  privKey  →  stored in CIPH_PRIVATE_KEY env var (base64url, never exposed)
  pubKey   →  distributed to clients (CIPH_PUBLIC_KEY or fetched)
```

### Client Key Pair (ephemeral, per-session)

```
Client generates on first request:
  client_privKey  →  kept in memory (module-level, same lifecycle as fingerprint cache)
  client_pubKey   →  sent to server in X-Client-PublicKey header (plaintext — it's public)
```

---

## Key Derivation Flow

### Step 1 — ECDH Shared Secret

```
client side:  raw_shared = ECDH(client_privKey,  server_pubKey)
server side:  raw_shared = ECDH(server_privKey,  client_pubKey)
                           ↑ same output both sides (ECDH property)
```

### Step 2 — Session Key

```
session_key = HKDF(
  ikm  = raw_shared,
  salt = "",
  info = "ciph-v2-session",
  len  = 32 bytes
)
```

### Step 3 — Request Key (fingerprint-bound)

```
request_key = HKDF(
  ikm  = session_key,
  salt = fingerprint_hash,   ← SHA-256 hex of device components
  info = "ciph-v2-request",
  len  = 32 bytes
)
```

Same payload from different device → different fingerprint → different request_key → ciphertext invalid on replay.

---

## New Headers

| Header | Content | Who sends |
|--------|---------|-----------|
| `X-Client-PublicKey` | `base64url(client_ephemeral_pubKey)` | Client → Server |
| `X-Fingerprint` | `base64url(AES-GCM-Encrypt(JSON(fingerprintComponents), session_key))` | Client → Server |

**`X-Client-PublicKey` is plaintext** — ephemeral public keys are safe to expose.
**`X-Fingerprint` encrypted with session_key** — server decrypts to validate IP + UA.

### Removed Headers

`X-Fingerprint` format changes (was encrypted with raw CIPH_SECRET, now with session_key).

---

## Full Request Flow (v2)

```
CLIENT
  1. Generate ephemeral key pair (P-256) — cached per session
  2. fingerprint = SHA-256(sorted device components)
  3. raw_shared = ECDH(client_privKey, server_pubKey)
  4. session_key = HKDF(raw_shared, "", "ciph-v2-session")
  5. request_key = HKDF(session_key, fingerprint, "ciph-v2-request")
  6. encrypted_fp = AES-GCM-Encrypt(JSON(fp_components), session_key)
  7. encrypted_body = AES-GCM-Encrypt(JSON(body), request_key)

  Headers sent:
    X-Client-PublicKey: base64url(client_pubKey)
    X-Fingerprint:      base64url(encrypted_fp)
    Content-Type:       text/plain

SERVER
  1. Read X-Client-PublicKey → client_pubKey
  2. raw_shared = ECDH(server_privKey, client_pubKey)
  3. session_key = HKDF(raw_shared, "", "ciph-v2-session")
  4. Decrypt X-Fingerprint with session_key → fp_components
  5. Validate IP + UA in fp_components vs current request
  6. fingerprint = SHA-256(sorted fp_components)
  7. request_key = HKDF(session_key, fingerprint, "ciph-v2-request")
  8. Decrypt body with request_key → plain body
  9. Run handler
 10. Encrypt response body with request_key
 11. Send encrypted response
```

---

## Server Public Key Distribution

Two options (implement both):

### Option A — Env Var (Simple, Recommended for Most Apps)

```env
# Frontend
CIPH_PUBLIC_KEY=<base64url encoded P-256 public key>

# Backend
CIPH_PRIVATE_KEY=<base64url encoded P-256 private key>
```

### Option B — Fetch on Init (Better for Key Rotation)

```ts
// @ciph/client fetches server public key on first request
GET /ciph/public-key
→ { publicKey: "base64url..." }
```

- Endpoint served by `@ciph/hono` (always unprotected, no auth)
- Client caches public key in memory (module-level)
- On rotation: server serves new pubkey → client picks up on next session

Both options can coexist: env var takes priority, fetch is fallback.

---

## Error Codes — New / Changed

| Code | HTTP | Trigger |
|------|------|---------|
| CIPH001 | 401 | Missing `X-Client-PublicKey` header |
| CIPH002 | 401 | Invalid/unparseable client public key |
| CIPH003 | 401 | Fingerprint mismatch (IP or UA changed) — same as v1 |
| CIPH004 | 400 | Body decrypt failed — same as v1 |
| CIPH005 | 413 | Payload too large — same as v1 |
| CIPH006 | 500 | Response encrypt failed — same as v1 |
| **CIPH007** | **401** | **ECDH key derivation failed (malformed client pubkey)** |

---

## Package Changes

### @ciph/core

**New functions:**

```ts
// Key generation
generateServerKeyPair(): Promise<{ privateKey: string, publicKey: string }>
generateClientKeyPair(): Promise<{ privateKey: string, publicKey: string }>

// ECDH
deriveSharedSecret(privateKey: string, peerPublicKey: string): Promise<string>

// Updated key derivation
deriveSessionKey(rawShared: string): Promise<string>
deriveRequestKey(sessionKey: string, fingerprint: string): Promise<string>
```

**Changed functions:**

```ts
// v1
deriveKey(secret: string, fingerprint: string): Promise<string>

// v2 — still exported for backward compat during migration
deriveKeyV1(secret: string, fingerprint: string): Promise<string>
```

**New types:**

```ts
export interface CiphKeyPair {
  privateKey: string  // base64url
  publicKey: string   // base64url
}

export interface CiphECDHContext {
  sessionKey: string
  requestKey: string
  fingerprint: string
}
```

**Remove (v2 only):**

- `encryptFingerprint(fingerprint, secret)` — replaced by encrypting with session_key
- `decryptFingerprint(encrypted, secret)` — same

**No external dependencies added** — P-256 ECDH available in Web Crypto + node:crypto.

---

### @ciph/client

**Config changes:**

```ts
interface CiphClientConfig {
  baseURL: string

  // v2: provide server public key (one of these)
  serverPublicKey?: string          // base64url — takes priority
  publicKeyEndpoint?: string        // URL to fetch pubkey, default: baseURL + "/ciph/public-key"

  // v1: REMOVE — no longer needed on frontend
  // secret: string  ← REMOVED

  // unchanged
  excludeRoutes?: string[]
  fingerprintOptions?: FingerprintOptions
  onFingerprintMismatch?: "retry" | "throw" | "ignore"
  fallbackToPlain?: boolean
  headers?: Record<string, string>
}
```

**Session cache (module-level):**

```ts
// v1 cache
let _fingerprint: string | null = null
let _secret: string             // was static from config

// v2 cache
let _fingerprint: string | null = null
let _clientKeyPair: CiphKeyPair | null = null   // ephemeral per-session
let _serverPublicKey: string | null = null      // fetched once
let _sessionKey: string | null = null           // derived once per key pair
```

**Invalidation on CIPH003:**
- Invalidate `_fingerprint`, `_clientKeyPair`, `_sessionKey` (regenerate all)
- `_serverPublicKey` not invalidated (server key doesn't change on mismatch)

---

### @ciph/hono

**Config changes:**

```ts
interface CiphHonoConfig {
  // v2: private key only — never exposed
  privateKey: string              // CIPH_PRIVATE_KEY env var

  // v1: REMOVE
  // secret: string  ← REMOVED

  // unchanged
  excludeRoutes?: string[]
  strictFingerprint?: boolean
  maxPayloadSize?: number
  allowUnencrypted?: boolean
}
```

**New endpoint added automatically:**

```
GET /ciph-public-key
→ 200 { publicKey: "<base64url>" }
```

No auth, always accessible. Used by `@ciph/client` Option B key distribution.

---

### @ciph/devtools-client & @ciph/devtools-server

**Mostly unchanged.** Log structures gain one new field:

```ts
// CiphClientLog — add
ecdh: {
  clientPublicKey: string    // truncated for display
  sessionKeyDerived: boolean
}

// CiphServerLog — add  
ecdh: {
  clientPublicKey: string    // truncated for display
  sharedSecretDerived: boolean
}
```

---

## Migration Strategy (v1 → v2)

### Phase 1 — Dual-mode support (v0.3.x)

- `@ciph/hono` accepts both `secret` (v1) and `privateKey` (v2)
- `@ciph/client` accepts both `secret` (v1) and `serverPublicKey`/`publicKeyEndpoint` (v2)
- Header `X-Ciph-Version: 1` or `X-Ciph-Version: 2` to route logic
- Deprecation warnings on v1 config

### Phase 2 — v2 default (v0.4.0)

- v2 is default
- v1 still works with deprecation warning
- Key generation CLI helper: `npx ciph generate-keys`

### Phase 3 — v1 removed (v1.0.0)

- Remove all v1 code paths
- Remove `CIPH_SECRET` references everywhere

---

## Key Generation CLI

New utility (part of `@ciph/core` or standalone `@ciph/cli`):

```bash
npx ciph generate-keys

# Output:
# Add to backend .env:
# CIPH_PRIVATE_KEY=<base64url>
#
# Add to frontend .env:
# CIPH_PUBLIC_KEY=<base64url>
```

---

## Security Improvements Over v1

| Property | v1 (Symmetric) | v2 (ECDH) |
|----------|---------------|-----------|
| Frontend holds secret | Yes (CIPH_SECRET) | No (only server pubkey — safe to expose) |
| Backend holds secret | Yes | Yes (private key) |
| Forward secrecy | No | Yes (ephemeral client key pair) |
| Replay across devices | Prevented by fingerprint | Prevented by fingerprint + unique ECDH secret |
| Key rotation | Must rotate both FE + BE | Rotate server key pair, clients auto-adapt |
| Bundle compromise | Attacker gets CIPH_SECRET | Attacker gets server pubkey (useless alone) |

---

## Implementation Order

1. `@ciph/core` — add ECDH primitives, new key derivation functions
2. `@ciph/core` — tests (Vitest): key gen, ECDH, HKDF chain, encrypt/decrypt roundtrip
3. `@ciph/hono` — v2 middleware, `/ciph-public-key` endpoint, dual-mode support
4. `@ciph/client` — v2 interceptors, ephemeral key pair management, pubkey fetch
5. `@ciph/devtools-client` / `@ciph/devtools-server` — add ECDH fields to log display
6. `examples/` — update all examples to v2 config
7. CLI key generation helper
8. Docs update

---

## Open Questions

1. **Key rotation UX** — when server rotates key pair, in-flight sessions using old session_key will fail. Need graceful handling (CIPH007 → client refetches pubkey + retries)?
2. **X25519 upgrade path** — P-256 now, migrate to X25519 in v0.5+ when Web Crypto support solidifies?
3. **Certificate pinning analog** — should client validate server pubkey fingerprint to prevent MITM on pubkey fetch endpoint?
4. **Multi-backend** — if multiple backend instances, all must share same private key (or use a key service). Document this constraint clearly.
