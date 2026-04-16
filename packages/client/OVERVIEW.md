# @ciph/client — Overview

> HTTP client wrapper dengan built-in transparent encryption berbasis `@ciph/core`.

## Purpose

`@ciph/client` adalah pengganti axios instance di frontend. Developer cukup mengganti import axios biasa dengan `createClient` dari `@ciph/client`, dan semua request/response otomatis terenkripsi tanpa mengubah satu baris logic aplikasi.

## Prinsip Utama

- **Zero-change DX** — API identik dengan axios: `.get()`, `.post()`, `.put()`, `.patch()`, `.delete()`
- **Setup sekali** — `createClient` dipanggil satu kali di `lib/ciph.ts`, dipakai di seluruh app
- **Transparent** — developer tidak tahu kapan enkripsi terjadi; semua ditangani interceptor
- **Fingerprint caching** — fingerprint di-generate sekali per session, di-cache di memory, hanya di-regenerate saat mismatch

## Yang @ciph/client Lakukan

1. Generate & cache device fingerprint
2. Encrypt request body sebelum dikirim
3. Inject header `X-Fingerprint`
4. Decrypt response body setelah diterima
5. Auto-retry sekali jika terjadi `CIPH003` (fingerprint mismatch)
6. Emit `CiphClientLog` event ke `@ciph/devtools-client` (dev only)

## Yang @ciph/client TIDAK Lakukan

- Tidak mengurus auth token / Bearer header — itu tanggung jawab caller
- Tidak mengenkripsi request dengan method `GET` yang tidak punya body (tapi tetap inject `X-Fingerprint`)
- Tidak meng-encrypt file upload / FormData (v1)
- Tidak membuat connection pool atau caching response

## Runtime

| Runtime | Support |
|---------|---------|
| Browser | ✅ (Web Crypto API via @ciph/core) |
| Node.js | ✅ (node:crypto via @ciph/core) |
| Bun     | ✅ |

## Dependencies

| Package       | Keterangan                      |
|---------------|---------------------------------|
| `@ciph/core`  | Semua primitive crypto          |
| `axios`       | HTTP engine (peer dependency)   |
