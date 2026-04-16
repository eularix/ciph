# Request/Response Flow — @ciph/hono

Dokumentasi lengkap yang terjadi di server untuk setiap request.

## Diagram Alur (Lengkap)

```
HTTP Request masuk
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  @ciph/hono Middleware                              │
│                                                     │
│  [PHASE 1: PRE-HANDLER]                             │
│                                                     │
│  1. Cek apakah route match excludeRoutes?           │
│     → Ya: skip semua, next() langsung               │
│     → Tidak: lanjut                                 │
│                                                     │
│  2. Cek header X-Fingerprint ada?                   │
│     → Tidak ada: return 401 CIPH001                 │
│                                                     │
│  3. Decrypt X-Fingerprint dengan SECRET             │
│     → Gagal: return 401 CIPH002                     │
│     → Berhasil: dapat fingerprint F                 │
│                                                     │
│  4. Validasi fingerprint (jika strictFingerprint)   │
│     Bandingkan IP & UA di F vs request saat ini     │
│     → Mismatch: return 401 CIPH003                  │
│     → Match: lanjut                                 │
│                                                     │
│  5. Cek ukuran body                                 │
│     → > maxPayloadSize: return 413 CIPH005          │
│                                                     │
│  6. Jika ada body (POST/PUT/PATCH):                 │
│     Derive key K = HKDF(SECRET, F)                  │
│     Decrypt body dengan K                           │
│     → Gagal: return 400 CIPH004                     │
│     → Berhasil: parse JSON → plain object           │
│                                                     │
│  7. Inject plain body ke context (override req.body)│
│                                                     │
│  8. next() — lanjut ke handler                      │
└───────────────────────────┬─────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────┐
│  Route Handler (kode developer)                     │
│                                                     │
│  const body = await c.req.json()  ← sudah plain    │
│  // ... business logic ...                          │
│  return c.json({ data: result })  ← plain object   │
└───────────────────────────┬─────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────┐
│  @ciph/hono Middleware                              │
│                                                     │
│  [PHASE 2: POST-HANDLER / RESPONSE INTERCEPT]       │
│                                                     │
│  9. Ambil plain response body dari handler          │
│ 10. Derive key K (sama dengan step 6, pakai F)      │
│ 11. Encrypt plain body dengan K                     │
│     → Gagal: return 500 CIPH006                     │
│ 12. Kirim response dengan body = ciphertext         │
│ 13. Emit CiphServerLog ke devtools (dev only)       │
└─────────────────────────────────────────────────────┘
                            │
                            ▼
              HTTP Response (body = ciphertext)
```

---

## GET Request (No Body)

```
GET /materials-list?page=1
  │
  ▼
Phase 1:
  - Cek X-Fingerprint → ada
  - Decrypt → dapat fingerprint F
  - Validasi IP/UA → match
  - Tidak ada body → skip decrypt body
  - next()
  │
  ▼
Handler:
  const { page } = c.req.query()   ← query param, tidak di-encrypt
  return c.json({ data: [...] })
  │
  ▼
Phase 2:
  - Encrypt response body
  - Kirim ciphertext
```

---

## Excluded Route

```
GET /health
  │
  ▼
Route "/health" match excludeRoutes?
  └─ Ya →
       - Tidak baca X-Fingerprint
       - Tidak decrypt/encrypt apapun
       - next() langsung
       - Response dikirim plain
       - Log devtools: excluded: true
```

---

## Fingerprint Validation Detail

```
fingerprint yang di-decrypt dari X-Fingerprint:
  {
    userAgent: "Mozilla/5.0 ...",
    screen: "1920x1080",
    timezone: "Asia/Jakarta",
    ip: "180.244.100.5"    ← IP saat fingerprint di-generate di client
  }

Request saat ini:
  IP header: "180.244.100.5"     ← dari c.req.header("x-real-ip") atau socket
  User-Agent: "Mozilla/5.0 ..."  ← dari c.req.header("user-agent")

Validasi:
  ip match?        → 180.244.100.5 === 180.244.100.5 → ✅
  userAgent match? → "Mozilla..." === "Mozilla..."   → ✅
  → Lanjut

Jika IP beda (user pindah jaringan):
  ip match? → 180.244.100.5 !== 110.138.50.9 → ❌
  → 401 CIPH003
  → Client akan auto-retry dengan fingerprint baru
```

---

## Devtools Event Emission

```ts
// hanya jika NODE_ENV !== "production"
ciphServerEmitter.emit("log", {
  id,
  method,
  route,         // matched Hono route pattern
  status,
  duration,
  timestamp,
  request: {
    plainBody,       // setelah di-decrypt (null untuk GET)
    encryptedBody,   // raw string dari network (null untuk GET)
    headers,
    ip,
    userAgent,
  },
  response: {
    plainBody,       // sebelum di-encrypt (yang ditulis handler)
    encryptedBody,   // yang dikirim ke network
  },
  fingerprint: { value, ipMatch, uaMatch },
  excluded,
  error,           // CiphErrorCode | null
} satisfies CiphServerLog)
```
