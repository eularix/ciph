# DevTools Integration — @ciph/client

## Overview

`@ciph/client` terintegrasi dengan `@ciph/devtools-client` melalui event emitter internal. Tidak ada dependency langsung ke devtools package — komunikasi lewat emitter yang di-export dari `@ciph/core`.

## Cara Kerja

```
@ciph/client
    │
    │  (setelah setiap request selesai)
    ▼
ciphClientEmitter.emit("log", CiphClientLog)
    │
    ▼
@ciph/devtools-client
    │  (subscribe ke emitter ini)
    ▼
Floating Panel — tampilkan plain data yang sudah di-decrypt
```

## Event Shape

Lihat `CiphClientLog` di `packages/core/TYPES.md` untuk definisi lengkap.

Field paling penting untuk devtools:

| Field | Isi |
|-------|-----|
| `request.plainBody` | Body asli sebelum di-encrypt (yang dikirim developer) |
| `request.encryptedBody` | Body dalam bentuk ciphertext (yang melintas di network) |
| `response.plainBody` | Response asli setelah di-decrypt (yang diterima developer) |
| `response.encryptedBody` | Response ciphertext (yang terlihat di Network tab browser) |
| `fingerprint.cached` | Apakah fingerprint dari cache atau baru di-generate |
| `fingerprint.mismatchRetried` | Apakah terjadi retry CIPH003 |
| `excluded` | Route ini di-skip enkripsi |

## Production Guard

Emitter hanya aktif di development:

```ts
// Di dalam @ciph/client — tidak ada emisi di production
if (process.env.NODE_ENV !== "production") {
  ciphClientEmitter.emit("log", log)
}
```

Di production build, blok ini di-tree-shake oleh bundler — tidak ada overhead sama sekali.

## Setup Devtools (di App.tsx)

```tsx
import { CiphDevtools } from "@ciph/devtools-client"

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      {/* Otomatis tidak muncul di production */}
      <CiphDevtools />
    </>
  )
}
```

Tidak perlu passing instance `ciph` ke `CiphDevtools` — mereka berkomunikasi via shared emitter dari `@ciph/core`.
