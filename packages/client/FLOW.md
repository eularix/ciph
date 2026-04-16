# Request/Response Flow — @ciph/client

Dokumentasi lengkap apa yang terjadi setiap kali `ciph.get()`, `ciph.post()`, dll dipanggil.

## Diagram Alur (Request)

```
Caller
  │
  │  ciph.post("/employees", payload)
  ▼
┌─────────────────────────────────────────────────────┐
│  @ciph/client: Request Interceptor                  │
│                                                     │
│  1. Cek apakah route match excludeRoutes?           │
│     → Ya: skip enkripsi, lanjut as-is               │
│     → Tidak: lanjut step 2                          │
│                                                     │
│  2. Ambil fingerprint dari cache                    │
│     → Ada di cache: pakai langsung                  │
│     → Tidak ada: generate baru (SHA-256 components) │
│                                                     │
│  3. Encrypt fingerprint dengan SECRET               │
│     → Hasil = nilai header X-Fingerprint            │
│                                                     │
│  4. Derive AES key = HKDF(SECRET, fingerprint)      │
│                                                     │
│  5. Encrypt request body dengan derived key         │
│     → body = base64url(IV + AuthTag + ciphertext)   │
│                                                     │
│  6. Set headers:                                    │
│     X-Fingerprint: <encrypted fingerprint>          │
│     Content-Type: text/plain                        │
└───────────────────────────┬─────────────────────────┘
                            │
                            ▼  HTTP request (body = ciphertext)
                       [ SERVER ]
                            │
                            ▼  HTTP response (body = ciphertext)
┌───────────────────────────┴─────────────────────────┐
│  @ciph/client: Response Interceptor                 │
│                                                     │
│  7. Cek status response:                            │
│     → 401 + code CIPH003: goto "Retry Flow"         │
│     → 4xx/5xx lain: throw AxiosError biasa          │
│     → 2xx: lanjut step 8                            │
│                                                     │
│  8. Ambil fingerprint dari cache                    │
│  9. Derive AES key = HKDF(SECRET, fingerprint)      │
│ 10. Decrypt response body dengan derived key        │
│     → plainBody = JSON.parse(decrypted)             │
│                                                     │
│ 11. Parse Ciph headers (X-Coins-Used, dll)          │
│ 12. Emit CiphClientLog ke devtools (dev mode only)  │
│ 13. Return CiphResponse ke caller                   │
└─────────────────────────────────────────────────────┘
  │
  ▼
Caller menerima plain data, tidak tahu ada enkripsi
```

---

## Retry Flow (CIPH003 — Fingerprint Mismatch)

```
Response 401 CIPH003 diterima
  │
  ▼
Apakah ini sudah retry? (flag internal per-request)
  │
  ├─ Ya → throw CiphError("CIPH003", ...)
  │
  └─ Tidak →
       1. Invalidate fingerprint cache
       2. Generate fingerprint baru
       3. Re-encrypt request dengan fingerprint baru
       4. Kirim ulang request dengan flag retried = true
       5. Jika response 200 → return ke caller (transparan)
       6. Jika response error lagi → throw CiphError
```

---

## GET Request (No Body)

```
ciph.get("/materials-list", { params: { page: 1 } })
  │
  ▼
Fingerprint di-cache atau di-generate
  │
  ▼
X-Fingerprint header di-inject
Body: TIDAK ada / TIDAK di-encrypt (tidak ada body pada GET)
  │
  ▼
Response body di-decrypt seperti biasa
```

---

## Excluded Route

```
ciph.get("/health")
  │
  ▼
Route match "/health" di excludeRoutes?
  │
  └─ Ya →
       - Tidak inject X-Fingerprint
       - Tidak encrypt/decrypt
       - Request/response jalan normal seperti axios biasa
       - Log devtools dengan excluded: true
```

---

## Fingerprint Cache Lifecycle

```
App pertama dibuka
  → fingerprint = null (belum ada)

Request pertama
  → generate fingerprint, simpan di module-level variable

Request ke-2, ke-3, ...
  → pakai fingerprint dari cache (0ms overhead)

User pindah jaringan (IP berubah)
  → server return CIPH003
  → cache di-invalidate
  → generate fingerprint baru
  → retry otomatis

User refresh halaman
  → fingerprint di-cache ulang dari awal (tidak persistent di localStorage)
```

---

## Devtools Event Emission

Di development mode, setelah setiap request selesai (sukses maupun gagal), `@ciph/client` emit event ke devtools:

```ts
// hanya jika NODE_ENV !== "production"
ciphClientEmitter.emit("log", {
  id,
  method,
  url,
  status,
  duration,
  timestamp,
  request: { plainBody, encryptedBody, headers },
  response: { plainBody, encryptedBody, headers },
  fingerprint: { value, cached, mismatchRetried },
  excluded,
} satisfies CiphClientLog)
```

`@ciph/devtools-client` subscribe ke emitter ini untuk menampilkan data di floating panel.
