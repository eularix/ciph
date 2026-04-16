# Error Handling — @ciph/hono

## Format Error Response

Semua error Ciph dikirim sebagai JSON dengan HTTP status yang sesuai:

```json
{
  "code": "CIPH003",
  "message": "Fingerprint mismatch: IP address changed"
}
```

Tidak ada stack trace yang leak ke response.

## Error per Kode

### CIPH001 — Missing X-Fingerprint Header

```
Kondisi : Request tiba tanpa header X-Fingerprint
Response: 401 { code: "CIPH001", message: "Missing X-Fingerprint header" }
Log     : warning level — bisa jadi misconfigured client atau direct curl call
Aksi    : Tidak decrypt body, return langsung
```

### CIPH002 — Fingerprint Decrypt Failed

```
Kondisi : Header ada tapi AES decrypt gagal
Penyebab: CIPH_SECRET di FE dan BE tidak sama
Response: 401 { code: "CIPH002", message: "Failed to decrypt fingerprint" }
Log     : warning level — kemungkinan besar misconfiguration
Aksi    : Return langsung, jangan decrypt body
```

### CIPH003 — Fingerprint Mismatch

```
Kondisi : IP atau UA di fingerprint tidak cocok dengan request saat ini
Penyebab: User pindah network, atau request dari device berbeda
Response: 401 { code: "CIPH003", message: "Fingerprint mismatch: [detail]" }
Log     : info level — event normal (user ganti jaringan)
Aksi    : Return. Client akan auto-retry dengan fingerprint baru.
```

### CIPH004 — Body Decrypt Failed

```
Kondisi : Body ada tapi AES-GCM decrypt/auth-tag verification gagal
Penyebab: Body corrupt, payload dimanipulasi, atau wrong key
Response: 400 { code: "CIPH004", message: "Failed to decrypt request body" }
Log     : error level — bisa jadi tampering attempt
Aksi    : Return, jangan proses body apapun
```

### CIPH005 — Payload Too Large

```
Kondisi : Ukuran body terenkripsi > maxPayloadSize
Response: 413 { code: "CIPH005", message: "Payload too large" }
Log     : info level
Aksi    : Return sebelum mulai decrypt
```

### CIPH006 — Response Encryption Failed

```
Kondisi : Error saat encrypt response body di Phase 2
Penyebab: Sangat jarang — mungkin memory issue atau key derivation gagal
Response: 500 { code: "CIPH006", message: "Failed to encrypt response" }
Log     : error level — log full error internal, jangan leak ke response
Aksi    : Return 500, jangan kirim plain body
```

---

## Global Error Handler (Rekomendasi)

Tambahkan error handler di Hono untuk menangkap `CiphError` yang tidak di-catch:

```ts
import { CiphError } from "@ciph/core"

app.onError((err, c) => {
  if (err instanceof CiphError) {
    const status =
      err.code === "CIPH004" ? 400
      : err.code === "CIPH005" ? 413
      : err.code === "CIPH006" ? 500
      : 401

    return c.json({ code: err.code, message: err.message }, status)
  }

  // Error lain (non-Ciph)
  console.error(err)
  return c.json({ message: "Internal Server Error" }, 500)
})
```
