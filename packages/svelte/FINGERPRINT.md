# @ciph/svelte — Fingerprinting

## What is a Fingerprint?

A fingerprint is a device-specific hash used for per-device key derivation. It ensures that the same plaintext encrypted on Device A produces different ciphertext than on Device B, even with the same session.

```
Device A: plaintext → encrypt → ciphertext_A
Device B: plaintext → encrypt → ciphertext_B
(ciphertext_A ≠ ciphertext_B)
```

This adds a layer of forward secrecy and device-binding.

## Components

A fingerprint is derived from:

1. **User-Agent** (always)
2. **Screen Dimensions** (width × height, optional but default: true)
3. **Timezone** (e.g., "America/New_York", optional but default: true)
4. **Custom Fields** (optional, user-provided)

## Generation

### Automatic (Default)

```typescript
const { client } = ciphClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: process.env.VITE_CIPH_SERVER_PUBLIC_KEY,
  fingerprintOptions: {
    includeScreen: true,      // default
    includeTimezone: true,    // default
  },
})
```

Fingerprint is generated on first request and cached for tab lifetime.

### With Custom Fields

```typescript
const { client } = ciphClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: process.env.VITE_CIPH_SERVER_PUBLIC_KEY,
  fingerprintOptions: {
    includeScreen: true,
    includeTimezone: true,
    customFields: {
      userId: '12345',      // e.g., your logged-in user ID
      appVersion: '1.0.0',  // your app version
    },
  },
})
```

### Per-Request Override

```typescript
const res = await client.get('/api/data', {
  fingerprintFields: {
    sessionId: 'abc123',  // add extra field for this request only
  },
})
```

## Caching

Fingerprints are cached at the **tab level** (module-level variable in `client.ts`):

```typescript
let cachedFingerprint: string | null = null

// First request:
// cachedFingerprint = "sha256-hash..."

// Subsequent requests:
// Reuse cachedFingerprint (no regeneration)

// On CIPH003 retry:
// cachedFingerprint = null (fresh generation)
// Then regenerated and cached again
```

**Why?** Regenerating on every request is expensive (crypto operations). Once per session is sufficient.

## Validation (Server-Side)

### v2 (ECDH)

The server receives two fingerprint-related values:

1. **X-Fingerprint Header:** Encrypted fingerprint (encrypted with server's private key during initial ECDH)
2. **Fingerprint Hash:** SHA-256 hash of the fingerprint, used as salt for key derivation

Server validates:
- Header is present and valid format
- Decryption succeeds (correct secret)
- (In future) IP/UA mismatch detection (pending implementation)

### Error Codes

| Code | Trigger |
|------|---------|
| CIPH001 | Missing X-Fingerprint header |
| CIPH002 | Fingerprint decryption failed (wrong secret) |
| CIPH003 | Fingerprint validation failed (IP/UA mismatch or other) |

## Format

### Storage Format

Fingerprint is a base64url-encoded string:

```
Type: base64url
Length: ~87 characters (65 bytes raw)
Example: "rH6s8kL9m2p3q4r5s6t7u8v9w0x1y2z3A4b5C6d7E8f9G0h1I..."
```

### Internal Format

Before encoding, it's a 65-byte value:

```
IV (12 bytes) + AuthTag (16 bytes) + EncryptedData (32 bytes)
= 60 bytes of ciphertext/auth info
```

## Lifecycle

```
┌─ Tab Created ────────────────────────────────┐
│                                               │
│  cachedFingerprint = null                    │
│                                               │
├─ First Request ──────────────────────────────┤
│                                               │
│  1. Generate fingerprint from:               │
│     • User-Agent                             │
│     • Screen (if includeScreen)             │
│     • Timezone (if includeTimezone)         │
│     • Custom fields                          │
│                                               │
│  2. Hash fingerprint:                        │
│     fingerprint_hash = SHA-256(fingerprint) │
│                                               │
│  3. Cache it:                                │
│     cachedFingerprint = fingerprint          │
│                                               │
│  4. Include in request:                      │
│     X-Fingerprint: cachedFingerprint         │
│                                               │
├─ Subsequent Requests ────────────────────────┤
│                                               │
│  Reuse: X-Fingerprint: cachedFingerprint    │
│                                               │
├─ Server Detects Mismatch (CIPH003) ─────────┤
│                                               │
│  1. Reset cache:                             │
│     cachedFingerprint = null                 │
│     cachedKeyPair = null                     │
│                                               │
│  2. Retry request:                           │
│     Generate fresh fingerprint              │
│     Generate fresh key pair                 │
│     Keep session key (same ECDH)            │
│                                               │
│  3. Send request again                       │
│                                               │
├─ Tab Closed ──────────────────────────────────┤
│                                               │
│  All caches cleared (tab lifetime)           │
│  Next tab starts fresh                       │
│                                               │
└───────────────────────────────────────────────┘
```

## Mismatch Detection (CIPH003)

When does a fingerprint mismatch occur?

1. **User-Agent Changes** (rarely)
   - Browser update
   - DevTools agent switcher
   - Tab restored after crash

2. **Screen Resolution Changes** (if includeScreen: true)
   - Window resized
   - Display disconnected
   - Zoom level changed (increases/decreases effective resolution)

3. **Timezone Changes** (if includeTimezone: true)
   - User changes OS timezone
   - Daylight saving time transition (rare browsers handle this)
   - VPN changes (if VPN reports different TZ)

### Recovery Flow

```
Request with old fingerprint
    │
    ▼
Server: Fingerprint doesn't match stored → 401 CIPH003
    │
    ▼
Client:
  if onFingerprintMismatch === 'retry':
    1. Reset fingerprint and key pair
    2. Generate fresh ones
    3. Retry request
  else if onFingerprintMismatch === 'throw':
    throw CiphError('CIPH003', ...)
  else:
    // ignore — treat as normal 401
    │
    ▼
Success (usually)
```

## Configuration Options

### Client Config

```typescript
interface FingerprintOptions {
  includeScreen?: boolean           // Default: true
  includeTimezone?: boolean         // Default: true
  customFields?: Record<string, string>
}
```

### Per-Request Override

```typescript
const res = await client.post('/api/data', { ... }, {
  fingerprintFields: {
    custom: 'value',
  },
})
```

### Mismatch Handling

```typescript
const { client } = ciphClient({
  baseURL: '...',
  serverPublicKey: '...',
  onFingerprintMismatch: 'retry',  // 'retry' | 'throw' | 'ignore'
})
```

## Best Practices

### Do ✓
- Include custom fields for important identifiers (userId, sessionId)
- Let fingerprint cache persist (don't manually clear unless needed)
- Use default includeScreen and includeTimezone (works for 99% of cases)
- Test on multiple devices to verify encryption differences

### Don't ✗
- Don't include user-entered data (changes per request)
- Don't regenerate fingerprint on every request (expensive)
- Don't disable fingerprinting entirely (reduces security)
- Don't assume fingerprints are stable if user changes UA/screen/TZ

## Troubleshooting

### CIPH003 Errors Constantly

**Symptom:** Every request returns 401 CIPH003

**Causes:**
- Server's ECDH private key doesn't match the client's public key storage
- Fingerprint hash computation differs between client and server
- Custom fingerprint fields not consistent

**Solution:**
1. Verify `CIPH_PRIVATE_KEY` and `VITE_CIPH_SERVER_PUBLIC_KEY` are correct
2. Check custom fingerprint fields are deterministic
3. Restart server and client
4. Check browser console for errors

### Fingerprint Shows as "null" in UI

**Symptom:** `$fingerprintStore` is null even after requests

**Causes:**
- Requests are excluded (routes in `excludeRoutes`)
- Encryption is disabled (`encrypt: false`)
- First request hasn't completed yet

**Solution:**
1. Make a POST request to encrypt (fingerprint generated on first request)
2. Wait for request to complete
3. Check Network tab to confirm requests are encrypted

### Different Fingerprints on Different Devices

**This is expected!** Fingerprints are device-specific by design. This ensures ciphertext differs across devices for the same plaintext.

To test:
1. Make a request on Device A → note ciphertext
2. Make same request on Device B → ciphertext should differ
3. Both should decrypt to same plaintext

## Security Implications

- **Device Binding:** Ciphertext is tied to a device (User-Agent + Screen + TZ)
- **Forward Secrecy:** Compromising one device's session doesn't expose others
- **User Privacy:** Fingerprint is unique but not personally identifying
- **Replay Protection:** Changing device invalidates old ciphertexts (by design)
