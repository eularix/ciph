# @ciph/hono — Overview

> Hono middleware untuk transparent server-side encryption/decryption berbasis `@ciph/core`.

## Purpose

`@ciph/hono` adalah middleware yang dipasang sekali di Hono app. Setelah terpasang, semua request body otomatis di-decrypt sebelum masuk ke handler, dan semua response body otomatis di-encrypt sebelum dikirim ke client — tanpa mengubah satu baris kode di handler.

## Prinsip Utama

- **Zero-change DX** — handler tetap tulis `c.json({ data })` seperti biasa
- **Setup sekali** — `app.use("*", ciph({ secret }))` di root app
- **Fingerprint validation** — validasi IP & UA setiap request
- **Exclude routes** — route tertentu bisa di-skip enkripsi
- **Emit server log** — kirim `CiphServerLog` ke devtools-server (dev only)

## Yang @ciph/hono Lakukan

1. Baca header `X-Fingerprint`
2. Decrypt fingerprint dengan SECRET
3. Validasi IP & UA fingerprint vs request saat ini
4. Derive AES key dari SECRET + fingerprint
5. Decrypt request body, inject ke `c.req` sebagai plain object
6. Lanjutkan ke handler (next)
7. Intercept response, encrypt body sebelum dikirim
8. Emit `CiphServerLog` ke devtools-server (dev only)

## Yang @ciph/hono TIDAK Lakukan

- Tidak mengurus auth/session (pakai Better Auth terpisah)
- Tidak mengenkripsi SSE / WebSocket (v1)
- Tidak mengenkripsi file response / stream binary (v1)
- Tidak memblokir route yang tidak ter-encrypt (bisa dikonfigurasi)

## Runtime

| Runtime | Support |
|---------|---------|
| Node.js | ✅      |
| Bun     | ✅      |
| Deno    | ✅      |

## Dependencies

| Package      | Keterangan               |
|--------------|--------------------------|
| `@ciph/core` | Semua primitive crypto   |
| `hono`       | Peer dependency          |

---

## DevTools Inspector

Dev-only browser UI untuk inspect encrypted requests/responses real-time.

### Quick Start

```typescript
import { autoInitEmitter, initDevtools, getCiphInspectorApp } from "@ciph/hono"

if (process.env.NODE_ENV !== "production") {
  autoInitEmitter()
  initDevtools() // In-memory mode (default)
  app.route("/ciph-devtools", getCiphInspectorApp())
}

// Open http://localhost:<port>/ciph-devtools
```

### Logging Modes

**Temporary (default)** — In-memory circular buffer (500 logs)
- Fast, zero I/O
- Logs lost on app restart

**Persistent** — Disk JSONL file + in-memory buffer
- Audit trail of all requests
- Survive app restart
- Great for testing & debugging

```typescript
initDevtools({
  temporary: false,
  logFilePath: ".ciph-logs.jsonl"
})
```

See [DEVTOOLS-LOGGING.md](./DEVTOOLS-LOGGING.md) for full documentation.
