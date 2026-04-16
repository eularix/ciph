# API Reference — @ciph/hono

## `ciph(config)`

Middleware utama. Dipasang dengan `app.use()`.

```ts
import { Hono } from "hono"
import { ciph } from "@ciph/hono"

const app = new Hono()

app.use("*", ciph({
  secret: process.env.CIPH_SECRET!,
}))

// Semua route di bawah ini otomatis terproteksi
app.get("/materials-list", async (c) => {
  const materials = await db.selectFrom("materials").selectAll().execute()
  return c.json({ data: materials }) // plain object, Ciph encrypt otomatis
})
```

### Config Options

```ts
interface CiphHonoConfig {
  /**
   * Shared secret. Harus sama dengan CIPH_SECRET di frontend.
   * Wajib. Ambil dari env var.
   */
  secret: string

  /**
   * Route yang di-skip enkripsi. Exact string atau glob pattern.
   * Default: ["/health", "/ciph", "/ciph/*"]
   */
  excludeRoutes?: string[]

  /**
   * Jika false, IP di fingerprint tidak divalidasi.
   * Berguna untuk development di belakang proxy / NAT.
   * Default: true
   */
  strictFingerprint?: boolean

  /**
   * Ukuran maksimum payload (dalam bytes) yang diterima.
   * Default: 10_485_760 (10 MB)
   */
  maxPayloadSize?: number

  /**
   * Jika true, request tanpa X-Fingerprint header diizinkan (tidak terenkripsi).
   * Default: false. Hanya untuk migration / testing.
   */
  allowUnencrypted?: boolean
}
```

---

## `ciphExclude()` — Per-Route Exclusion

Untuk mengecualikan route spesifik tanpa menambah `excludeRoutes` di config global:

```ts
import { ciph, ciphExclude } from "@ciph/hono"

app.use("*", ciph({ secret: process.env.CIPH_SECRET! }))

// Route ini tidak akan di-encrypt/decrypt
app.get("/health", ciphExclude(), (c) => {
  return c.json({ status: "ok" })
})
```

---

## Response Helper (Opsional)

Handler tetap pakai `c.json()` seperti biasa. Middleware intercept sebelum kirim.
Tidak ada helper khusus yang perlu dipanggil.

```ts
// ✅ Cara ini sudah benar — middleware yang handle encrypt
app.post("/employees", async (c) => {
  const body = await c.req.json() // sudah plain, sudah di-decrypt middleware
  const employee = await db.insertInto("employees").values(body).returningAll().executeTakeFirst()
  return c.json({ data: employee }, 201)
})
```

---

## Error Responses

Semua error Ciph dikirim dalam format:

```json
{
  "code": "CIPH003",
  "message": "Fingerprint mismatch: IP address changed"
}
```

| Error   | HTTP | Kapan                                         |
|---------|------|-----------------------------------------------|
| CIPH001 | 401  | Header `X-Fingerprint` tidak ada             |
| CIPH002 | 401  | Fingerprint gagal di-decrypt                 |
| CIPH003 | 401  | IP atau UA tidak cocok dengan fingerprint    |
| CIPH004 | 400  | Request body gagal di-decrypt                |
| CIPH005 | 413  | Payload terlalu besar                        |
| CIPH006 | 500  | Response gagal di-encrypt                    |

Referensi lengkap: `packages/core/ERROR_CODES.md`.
