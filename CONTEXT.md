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
- Not a WebSocket or file upload/download solution in v1

## Monorepo Structure (Target)

```text
ciph/
├── packages/
│   ├── core/              → @ciph/core
│   ├── client/            → @ciph/client (HTTP client wrapper)
│   ├── hono/              → @ciph/hono (Hono middleware)
│   ├── devtools-client/   → @ciph/devtools-client (floating panel)
│   └── devtools-server/   → @ciph/devtools-server (backend inspector)
├── modules/
│   └── ciph-go/           → Go module (future)
├── examples/
│   ├── react-hono/
│   ├── vue-express/
│   └── svelte-hono/
├── docs/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── CONTEXT.md
```

## Package Dependency Graph

```text
@ciph/devtools-client
        │
        ▼ (subscribes to events)
   @ciph/client ──────────────────────────────────┐
        │                                         │
        ▼ depends on                              │
   @ciph/core  ◀───────────────  @ciph/hono       │
        ▲                               │         │
        │ (optional perf upgrade)       ▼         │
  @ciph/core-native          @ciph/devtools-server (future)
```

Rules:
- No circular dependencies.
- @ciph/core must not depend on any other package in this monorepo.

## Naming & Registry

All JavaScript/TypeScript packages are published under the `@ciph` scope:

| Package               | npm Name              |
|-----------------------|-----------------------|
| Core crypto           | `@ciph/core`          |
| HTTP client wrapper   | `@ciph/client`        |
| Hono middleware       | `@ciph/hono`          |
| Devtools (frontend)   | `@ciph/devtools-client` |
| Devtools (backend)    | `@ciph/devtools-server` |

All share the same version number (fixed versioning) and are managed via Changesets.

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

## Shared Secret Convention

- Nama env var: `CIPH_SECRET`
- Harus identik di frontend dan backend
- Minimal 32 karakter
- Disimpan di Secret Manager (production), bukan di git

```env
CIPH_SECRET=your-32-char-minimum-secret-here
```

## Key Concepts (Quick Reference)

| Term            | Penjelasan                                       |
|-----------------|--------------------------------------------------|
| `CIPH_SECRET`   | Raw secret dari `.env`, bukan AES key langsung   |
| `fingerprint`   | SHA-256 dari komponen device (UA, screen, tz, IP) |
| `derived key`   | HKDF(`CIPH_SECRET`, fingerprint) → 32-byte key   |
| `X-Fingerprint` | Header HTTP berisi fingerprint terenkripsi       |
| `ciphertext`    | `base64url(IV + AuthTag + EncryptedData)`        |

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

- Semua error pakai `CiphError` dengan `code` (CIPH001–CIPH006).
- HTTP error body selalu `{ code, message }` (tanpa stack trace).
- Client otomatis retry **hanya** untuk fingerprint mismatch (CIPH003) sekali.
- Error lain langsung dilempar ke caller.

## Milestones (Ringkas)

- v0.1.0 — `@ciph/core`, `@ciph/client`, `@ciph/hono`
- v0.2.0 — `@ciph/devtools-client`, `@ciph/devtools-server`
- v0.3.0+ — adapter lain & native core

## Golden Rule Untuk Implementasi

> Developer seharusnya tidak bisa membedakan apakah Ciph terpasang atau tidak, **kecuali** saat membuka Network tab dan melihat bahwa body request/response sudah berupa ciphertext.
