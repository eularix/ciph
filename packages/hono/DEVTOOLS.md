# DevTools Integration — @ciph/devtools-server

## Overview

`@ciph/hono` terintegrasi dengan `@ciph/devtools-server` melalui event emitter dari `@ciph/core`. Tidak ada dependency langsung ke devtools package.

## Cara Kerja

```
@ciph/hono (setelah tiap request selesai)
    │
    │  ciphServerEmitter.emit("log", CiphServerLog)
    ▼
@ciph/devtools-server
    │  subscribe ke emitter, simpan di circular buffer
    ▼
Browser buka /ciph
    │  GET /ciph/stream (SSE)
    ▼
Inspector UI — tampilkan plain request/response
```

## Production Guard

```ts
// Di dalam @ciph/hono
if (process.env.NODE_ENV !== "production") {
  ciphServerEmitter.emit("log", log)
}
```

Di production `NODE_ENV=production`:
- Tidak ada event yang di-emit
- Tidak ada plain data yang disimpan di memory
- Route `/ciph` dari devtools-server return 404

## Setup Devtools-Server (Opsional)

```ts
import { ciphDevServer } from "@ciph/devtools-server"

// Pasang setelah middleware ciph utama
app.route("/ciph", ciphDevServer({
  secret: process.env.CIPH_SECRET!,
}))
```

Buka `http://localhost:3000/ciph` untuk melihat inspector UI.

Detail lengkap ada di `packages/devtools-server/`.
