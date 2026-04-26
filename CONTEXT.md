# Ciph — Global Project Context

> Read this file FIRST before reading any package-specific MD.
> This is the single source of truth for project structure, conventions, and decisions.

## What is Ciph?

Ciph is a transparent HTTP encryption library for frontend–backend communication.

Core value proposition:
- Plain text is never visible in browser Network DevTools
- Developer experience is unchanged (no manual encrypt/decrypt in app code)
- Works as invisible middleware on both client and server
- Cross-framework: React, Vue, Svelte + Hono, Express, NestJS, Go

Ciph is:
- An application-layer encryption layer on top of HTTPS
- A DX tool (DevTools panels for readable logs)
- Not a replacement for TLS/HTTPS
- Not an auth/session solution
- Not a WebSocket or file upload/download solution

## Monorepo Structure

```text
ciph/
├── packages/
│   ├── core/              → @ciph/core (crypto primitives)
│   ├── client/            → @ciph/client (axios wrapper)
│   ├── react/             → @ciph/react (React HTTP client)
│   ├── hono/              → @ciph/hono (Hono middleware)
│   ├── devtools-client/   → @ciph/devtools-client (floating panel)
│   └── devtools-server/   → @ciph/devtools-server (backend inspector)
├── example/
│   ├── next/              → Next.js example
│   ├── react/             → React + Hono example
│   ├── svelte/            → Svelte example
│   └── vue/               → Vue example
├── docs/
├── pnpm-workspace.yaml
├── turbo.json
└── CONTEXT.md
```

## Package Dependency Graph

```text
@ciph/devtools-client
        │
        ▼ (subscribes to events)
   @ciph/client ◀─────────────────┐
   @ciph/react                    │
        │                         │
        ▼ depends on              │
   @ciph/core ◀──────  @ciph/hono │
                            │     │
                            ▼     │
                 @ciph/devtools-server
```

Rules:
- No circular dependencies.
- @ciph/core must not depend on any other package in this monorepo.
- @ciph/react is framework-specific wrapper around @ciph/client.

## Naming & Registry

All JavaScript/TypeScript packages are published under the `@ciph` scope:

| Package               | npm Name              |
|-----------------------|-----------------------|
| Core crypto           | `@ciph/core`          |
| HTTP client wrapper   | `@ciph/client`        |
| React HTTP client     | `@ciph/react`         |
| Hono middleware       | `@ciph/hono`          |
| Devtools (frontend)   | `@ciph/devtools-client` |
| Devtools (backend)    | `@ciph/devtools-server` |

All share the same version number (fixed versioning, v2.0.0+) and are managed via Changesets.

## Tooling & Conventions

- Package manager: pnpm workspaces
- Monorepo runner: Turborepo
- Language: TypeScript 5, strict mode everywhere
- Tests: Vitest
- Bundler: tsup (ESM + CJS + d.ts)
- Native addon (future): napi-rs for @ciph/core-native

TypeScript base config (conceptual):

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Rules:
- No `any`.
- No `@ts-ignore` tanpa komentar kenapa diperlukan.

## Build Output

Setiap package build ke:

```text
packages/<name>/dist/
  ├── index.js      (ESM)
  ├── index.cjs     (CJS)
  └── index.d.ts    (types)
```

## Server Key Pair Convention (ECDH v2)

**Backend .env:**
```env
CIPH_PRIVATE_KEY=base64url-encoded-P256-private-key
```

**Frontend .env:**
```env
CIPH_PUBLIC_KEY=base64url-encoded-P256-public-key
```

**Rules:**
- Private key: backend only, never exposed, min 32 chars when base64url decoded
- Public key: safe to expose, distributed to frontend via env var or `/ciph/public-key` endpoint
- Store private key in Secret Manager (production), never in git
- Generate via: `npx ciph generate-keys`

## Key Concepts (Quick Reference)

| Term            | Description |
|-----------------|-------------|
| `CIPH_PRIVATE_KEY` | Server private key (P-256), never exposed |
| `CIPH_PUBLIC_KEY` | Server public key (P-256), safe to expose to frontend |
| `client ephemeral keypair` | Generated per-session, kept in memory, regenerated on CIPH003 |
| `raw_shared_secret` | Output of ECDH(client_privKey, server_pubKey) |
| `session_key` | HKDF(raw_shared_secret, "", "ciph-v2-session") → 32 bytes |
| `fingerprint` | SHA-256 of device components (UA, screen, timezone, IP, ...) |
| `request_key` | HKDF(session_key, fingerprint_hash, "ciph-v2-request") → 32 bytes |
| `X-Client-PublicKey` | Header: plaintext client ephemeral public key (base64url) |
| `X-Fingerprint` | Header: encrypted fingerprint (base64url, encrypted with session_key) |
| `ciphertext` | `base64url(IV[12] + AuthTag[16] + EncryptedData[n])` |

## DevTools Global Rules

- Devtools hanya aktif di development (`NODE_ENV !== 'production'`).
- Di production, paket devtools harus tree-shaken (tidak ada kode yang terbundle).
- `/ciph` adalah route fixed untuk backend inspector (tidak dikonfigurasi ke path lain).
- Devtools tidak boleh pernah menulis plain-data ke log di production.

## Internal Event Bus (High Level)

- `@ciph/client` meng-emit event `CiphClientLog` ke devtools-client.
- `@ciph/hono` meng-emit event `CiphServerLog` ke devtools-server.
- Bentuk struktur log didefinisikan di `packages/core/TYPES.md`.

## Error Handling Philosophy

- All errors use `CiphError` with code (CIPH001–CIPH007).
- HTTP error body always `{ code, message }` (no stack traces).
- Client auto-retries ONLY for fingerprint mismatch (CIPH003) once (invalidates ephemeral keypair + fingerprint).
- All other errors thrown directly to caller.
- CIPH007: ECDH key derivation failure (malformed client pubkey) — no retry.

## Milestones

- v2.0.0 — **ECDH P-256 asymmetric**, all packages (`@ciph/core`, `@ciph/client`, `@ciph/react`, `@ciph/hono`, devtools, examples)
- v2.1.0+ — More adapters (Express, NestJS), key rotation, X25519 migration path

## Golden Rule Untuk Implementasi

> Developer seharusnya tidak bisa membedakan apakah Ciph terpasang atau tidak, **kecuali** saat membuka Network tab dan melihat bahwa body request/response sudah berupa ciphertext.
