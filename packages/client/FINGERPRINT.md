# Fingerprint Strategy — @ciph/client

## Tujuan

Fingerprint adalah identifier unik perangkat yang berfungsi sebagai "salt" per-device untuk key derivation. Ini memastikan bahwa ciphertext yang diambil dari satu device tidak bisa di-replay dari device lain.

## Komponen Default

```ts
{
  userAgent: navigator.userAgent,
  screen: `${screen.width}x${screen.height}`,     // jika includeScreen: true
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // jika includeTimezone: true
  ...customFields,
}
```

## Cara Generate

```ts
// 1. Sort keys untuk output deterministic
const sorted = Object.fromEntries(
  Object.entries(components).sort(([a], [b]) => a.localeCompare(b))
)

// 2. JSON stringify
const raw = JSON.stringify(sorted)

// 3. SHA-256
const fingerprint = sha256(raw) // hex string 64 char
```

## Cache Strategy

```
Module-level variable (bukan localStorage, bukan sessionStorage)
  → Hidup selama tab browser aktif
  → Hilang saat refresh (tidak persistent)
  → Tidak dishare antar tab

Alasan tidak pakai localStorage:
  - Menghindari fingerprint lama dipakai setelah environment berubah
  - Lebih aman: tidak bisa di-steal via XSS dari storage
```

## Kapan Regenerate

| Kondisi                       | Aksi                            |
|-------------------------------|---------------------------------|
| Pertama kali request          | Generate & cache                |
| Cache masih ada               | Pakai cache (0ms)               |
| Server return CIPH003         | Invalidate cache, generate baru |
| User refresh halaman          | Cache hilang, generate ulang    |
| `onFingerprintMismatch: throw` | Tidak regenerate, langsung throw |

## Retry Guard

Setiap request punya flag internal `_ciphRetried: boolean`. Jika CIPH003 terjadi:

1. Cek flag: sudah retried? → throw langsung
2. Belum retried → set flag, regenerate fingerprint, kirim ulang

Ini mencegah infinite retry loop.

## Validasi di Backend

Backend (`@ciph/hono`) memvalidasi fingerprint dengan membandingkan:
- IP yang tersimpan di fingerprint vs IP request saat ini
- UA yang tersimpan vs `User-Agent` header saat ini

Jika berbeda → CIPH003. Detail ada di `packages/hono/FLOW.md`.
