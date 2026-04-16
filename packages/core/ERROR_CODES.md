# Error Codes — @ciph/core

All errors thrown or returned by Ciph packages use structured error codes for predictable handling.

---

## Error Code Reference

| Code     | HTTP Status | Trigger                                      | Thrown By          |
|----------|-------------|----------------------------------------------|--------------------|
| CIPH001  | 401         | `X-Fingerprint` header is missing            | `@ciph/hono`       |
| CIPH002  | 401         | Fingerprint decryption failed (wrong secret) | `@ciph/hono`       |
| CIPH003  | 401         | Fingerprint IP or UA does not match          | `@ciph/hono`       |
| CIPH004  | 400         | Request body decryption failed               | `@ciph/hono`       |
| CIPH005  | 413         | Payload exceeds configured size limit        | `@ciph/hono`       |
| CIPH006  | 500         | Response encryption failed                   | `@ciph/hono`       |

---

## HTTP Error Response Shape

All errors return a JSON body conforming to `CiphErrorResponse`:

```json
{
  "code": "CIPH003",
  "message": "Fingerprint mismatch: IP address changed"
}
```

---

## Error Handling Per Code

### CIPH001 — Missing Fingerprint Header

```
Cause:   Request arrived without X-Fingerprint header.
         Could be a direct curl call, misconfigured client, or non-Ciph client.
Action:  Reject immediately. Do not attempt to decrypt body.
Retry:   No automatic retry. Client must include header.
```

### CIPH002 — Fingerprint Decryption Failed

```
Cause:   X-Fingerprint header present but cannot be decrypted.
         Most likely: SECRETKEY mismatch between FE and BE.
Action:  Reject. Log warning (possible misconfiguration).
Retry:   No. This is a configuration error, not a transient failure.
```

### CIPH003 — Fingerprint Mismatch

```
Cause:   Fingerprint decrypted successfully but IP or UA in fingerprint
         does not match current request IP or UA.
         Common cause: user switched networks (WiFi → mobile data).
Action:  Return 401 CIPH003.
Retry:   @ciph/client auto-retries ONCE with fresh fingerprint.
         If retry also fails → throw CiphError to caller.
```

### CIPH004 — Body Decryption Failed

```
Cause:   Body present but AES-GCM decryption failed.
         Could be: corrupted payload, wrong key, tampered ciphertext.
Action:  Reject with 400.
Retry:   No. Indicates data integrity issue.
```

### CIPH005 — Payload Too Large

```
Cause:   Encrypted payload exceeds configured maxPayloadSize.
Action:  Reject with 413 before attempting decryption.
Retry:   No. Client must reduce payload or use chunking.
Default limit: 10MB (configurable in @ciph/hono options)
```

### CIPH006 — Response Encryption Failed

```
Cause:   Server-side error during response body encryption.
         Should never happen under normal conditions.
Action:  Return 500. Log full error server-side.
Retry:   No. Investigate server logs.
```

---

## Client-Side Handling (`@ciph/client`)

```typescript
try {
  const data = await ciph.get("/materials-list")
} catch (err) {
  if (err instanceof CiphError) {
    switch (err.code) {
      case "CIPH003":
        // Fingerprint mismatch — already auto-retried once
        // Show user: "Session expired, please refresh"
        break
      case "CIPH001":
      case "CIPH002":
        // Configuration error — should not happen in production
        console.error("Ciph misconfiguration:", err.message)
        break
      default:
        // Other Ciph errors
        break
    }
  }
}
```
