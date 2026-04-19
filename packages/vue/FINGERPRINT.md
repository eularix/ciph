# Fingerprinting — @ciph/vue

Documentation for device fingerprinting in Ciph, how it's generated, cached, and validated.

---

## What is a Fingerprint?

A **fingerprint** is a cryptographic hash of device characteristics used to bind encryption keys to a specific device. It acts as a salt for key derivation.

```
Device State           Fingerprint              Key Derivation
┌──────────────────────────────────────────────────────────┐
│ User Agent           ┐                                   │
│ Screen Size          │ → SHA-256 → base64    → HKDF      │
│ Timezone             │    hash       ┌─ Encrypt ↓        │
│ Language (optional)  │               │  & Cache   AES Key │
│ Custom Fields        ┘               │                   │
│                                      └─ X-Fingerprint    │
│                                         Header           │
└──────────────────────────────────────────────────────────┘
```

## Why Fingerprinting?

### Security Benefits

1. **Per-device keys** — Same API secret produces different keys on different machines
2. **Contextual binding** — Even if secret is leaked, attacker needs exact device state
3. **Change detection** — If user moves WiFi (IP changes), server detects and auto-invalidates
4. **Replay prevention** — Encrypted requests are "locked" to originating device

### Example

```
Device A (Alice's Laptop)        Device B (Alice's Phone)
UA: Mozilla/5.0 Win64           UA: Mozilla/5.0 iPhone
Screen: 1920x1080               Screen: 390x844
Timezone: America/New_York      Timezone: America/New_York

↓ SHA-256                        ↓ SHA-256

FP_A = abc123...                FP_B = xyz789...

↓ Encrypt with secret            ↓ Encrypt with secret

X-FP_A                           X-FP_B
(Different values)               (Different values)

↓ HKDF key derivation            ↓ HKDF key derivation

Key_A = k1k2k3...              Key_B = m9n8o7...
(Different keys)                 (Different keys)

Same API request on Device A ≠ Same request on Device B
(Even with same secret)
```

---

## Generation

Fingerprints are generated once per session using device components.

### Default Components

```typescript
interface FingerprintComponents {
  userAgent: string               // Navigator.userAgent
  screenWidth: number             // Screen.width (optional)
  screenHeight: number            // Screen.height (optional)
  timezone: string                // Intl.DateTimeFormat().resolvedOptions()
  language: string                // Navigator.language
}
```

### Algorithm: SHA-256

```typescript
const components = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  screenWidth: 1920,
  screenHeight: 1080,
  timezone: 'America/New_York',
  language: 'en-US',
  // + custom fields if provided
}

const sorted = JSON.stringify(components, Object.keys(components).sort())
// {"language":"en-US","screenHeight":1080,"screenWidth":1920,"timezone":"America/New_York","userAgent":"Mozilla/5.0..."}

const fingerprint = SHA256(sorted)
// "abc123def456ghi789jkl012mno345pqr678stu901vwx234yza567bcd890..."

// Fingerprint is 64 hex characters (256 bits)
```

### Encryption

The plain fingerprint is encrypted with the CIPH_SECRET before sending to server:

```
Plain FP:    abc123def456ghi789...
             ↓
             AES-256-GCM encrypt with secret
             ↓
Encrypted:   xY9zM8bN7qW6sQ5kE4rT3yV2uO1pI... (base64url)
             ↓ Sent as X-Fingerprint header
Server:      Decrypts with same secret → Validates
```

---

## Customization

### Include/Exclude Components

```typescript
import { CiphPlugin } from '@ciph/vue'

app.use(CiphPlugin, {
  baseURL: 'https://api.example.com',
  serverPublicKey: 'YOUR_KEY',
  fingerprintOptions: {
    includeScreen: true,         // Include screen size (default: true)
    includeTimezone: true,       // Include timezone (default: true)
    includeLanguage: true,       // Include language (default: true)
    customFields: {              // Add custom fields
      appVersion: '1.2.0',
      platform: 'web',
    },
  },
})
```

### Use Case: Excluding Screen

For apps accessed on devices with dynamic screen sizes (tablets, resizing), disable screen component:

```typescript
fingerprintOptions: {
  includeScreen: false,  // ← Don't include screen size
  includeTimezone: true,
}
```

Now fingerprint only depends on UA + timezone, not screen dimensions.

### Custom Fields

Use custom fields for app-specific identity:

```typescript
fingerprintOptions: {
  customFields: {
    workspace: 'team-a',
    buildVersion: '3.2.1',
    environment: 'staging',
  },
}
```

This binds fingerprint to specific app build or team, preventing key sharing across systems.

---

## Caching

Fingerprints are cached in **module-level memory** (not localStorage) for the tab lifetime.

### Cache Lifecycle

```
┌─────────────────────────────────────┐
│ First Request in Tab                │
│                                    │
│ fingerprint = null                  │
│ ↓ Generate new from device state    │
│ ↓ Encrypt with secret               │
│ fingerprint = "x1Y2z..."             │
│ ↓ Send in X-Fingerprint header      │
└─────────────────────┬───────────────┘
                      │
     ┌────────────────┼────────────────┐
     │                │                │
  SUCCESS          RETRY (CIPH003)  FAILURE
     │                │                │
     ▼                ▼                ▼
Reuse same FP   Clear & regenerate   Abort
for all future  (IP/UA changed)
requests
     │
     └──→ Cache survives until tab closed
```

### Why Memory Only?

```
✅ Memory cache (current approach):
   - Secure from XSS (inaccessible to scripts outside module)
   - Per-tab isolation
   - Auto-cleared on page reload/close

❌ localStorage would be:
   - Vulnerable to XSS → steal fingerprint
   - Persistent across tabs → fingerprint leaks
   - Slow disk I/O
```

---

## Server-Side Validation

Server receives X-Fingerprint header and validates on every request:

```
Server Receives Request:
┌─────────────────────────────────────────────────────┐
│ 1. Extract X-Fingerprint header                     │
│    Value: "xY9zM8bN7qW6sQ5kE4rT3yV2uO1pI..."      │
│                                                     │
│ 2. Decrypt with shared CIPH_SECRET                  │
│    Result: Plaintext fingerprint hash              │
│                                                     │
│ 3. Re-generate fingerprint from current request:   │
│    - Extract IP from request header                 │
│    - Extract User-Agent from request header        │
│    - Look up user's timezone/language (from DB)    │
│    - Hash: SHA256({ IP, UA, TZ, ... })            │
│                                                     │
│ 4. Compare:                                         │
│    - Decrypted FP == Regenerated FP?               │
│      YES → Request valid, proceed (200)             │
│      NO  → Fingerprint mismatch (401 CIPH003)      │
└─────────────────────────────────────────────────────┘
```

### CIPH003 Triggers

```
User IP changes → CIPH003
(Changed WiFi: 192.168.1.1 → 192.168.1.5)

User-Agent changes → CIPH003
(Browser language setting changed)

Timezone changes → CIPH003
(Auto-adjust to new timezone after travel)

Timestamp difference too large → CIPH003
(Fingerprint older than N days)
```

---

## Auto-Retry on Mismatch

When client receives `401 CIPH003`:

```
┌──────────────────────────────────────┐
│ Client receives 401 CIPH003           │
│ (Fingerprint mismatch)                │
│                                       │
│ 1. Clear module cache: fingerprint = null    │
│ 2. Regenerate fingerprint (new state)│
│ 3. Re-derive AES key (new derivation)│
│ 4. Re-encrypt body with new key      │
│ 5. Inject new X-Fingerprint header   │
│ 6. RETRY request (once only)          │
│                                       │
│ Result:                               │
│   - If retry succeeds (200): Return response  │
│   - If retry fails: Throw CIPH003 error      │
└──────────────────────────────────────┘
```

**User experience:**
- Request appears to take slightly longer (retry adds 50-200ms)
- No visible error, completely transparent
- Only happens first time after IP/UA change

---

## Per-Request Customization

Override fingerprint for specific requests:

```typescript
import { useCiph } from '@ciph/vue'

const ciph = useCiph()

// Global fingerprint applies
await ciph.post('/api/default', data)  // Uses cached FP

// Per-request override
await ciph.post('/api/special', data, {
  fingerprintFields: {
    requestId: 'req-123',
    category: 'premium',
  },
})
// Adds extra fields to fingerprint hash for this request only
// Useful for: permission-based requests, audit logging
```

---

## Fingerprint Mismatch Strategies

Configure client behavior when mismatch occurs:

```typescript
interface CiphClientConfig {
  /**
   * Action when fingerprint mismatch detected and retry fails.
   */
  onFingerprintMismatch?: 'retry' | 'throw' | 'ignore'
}
```

### "retry" (Default)

```typescript
// Auto-retry once with fresh fingerprint
// Recommended for most apps
onFingerprintMismatch: 'retry'
```

### "throw"

```typescript
// Immediately throw CIPH003 error, no retry
// Use if you need strict device binding
onFingerprintMismatch: 'throw'
```

### "ignore"

```typescript
// Fall back to unencrypted request if mismatch
// ⚠️ NEVER use in production, huge security hole
onFingerprintMismatch: 'ignore'
```

---

## Fingerprint Lifecycle Example

```typescript
// App starts, user opens in browser
const app = createApp(App)
app.use(CiphPlugin, {
  baseURL: 'https://api.example.com',
  serverPublicKey: 'pk_...',
  fingerprintOptions: {
    includeScreen: true,
    includeTimezone: true,
  },
})

// Component: First request
const ciph = useCiph()
await ciph.get('/api/users')
  // 1. FP not in cache
  // 2. Generate: SHA256({ UA, screen, TZ })
  //    = "abc123..."
  // 3. Encrypt: AES(secret, "abc123...")
  //    = "xY9z..."
  // 4. Send header: X-Fingerprint: xY9z...
  // 5. Server validates ✓
  // 6. Cache "abc123..." in memory

// Second request (same device, same session)
await ciph.post('/api/users', { name: 'Alice' })
  // 1. FP in cache: "abc123..."
  // 2. Encrypt cached: AES(secret, "abc123...")
  //    = "xY9z..." (same encrypted value)
  // 3. Send header: X-Fingerprint: xY9z...
  // 4. Server validates ✓
  // 5. No regeneration needed

// User changes WiFi (IP changes 192.168.1.1 → 10.0.0.5)
await ciph.get('/api/data')
  // 1. Send cached FP: xY9z...
  // 2. Server checks: Old IP in FP ≠ New IP in request
  // 3. Server returns 401 CIPH003
  // 4. On client:
  //    - Clear cache: fingerprint = null
  //    - Regenerate: SHA256({ UA, screen, TZ })
  //      (No IP in fingerprint, TZ might differ)
  //      = "def456..."
  //    - Encrypt: AES(secret, "def456...")
  //      = "zN4q..."
  //    - RETRY with new header: X-Fingerprint: zN4q...
  // 5. Server validates ✓
  // 6. Return response (retry succeeded)
  // 7. Cache new FP: "def456..."
```

---

## Debugging

### Check Cached Fingerprint

In browser console (dev mode only):

```javascript
// Module exports emitter API — check if module loaded
import { autoInitClientEmitter } from '@ciph/vue'

// Emit a test log to see fingerprint
autoInitClientEmitter()
console.log('DevTools event listener ready')

// Make a request, inspect Network tab
// X-Fingerprint header value is encrypted FP
```

### Monitor Fingerprint Changes

```typescript
window.addEventListener('ciph-client-log', (event: CustomEvent) => {
  const { fingerprint } = event.detail
  console.log('Fingerprint:', fingerprint)
})
```

### Trace Server-Side

Server logs should include:

```
[CIPH] Request /api/action
  IP: 192.168.1.1
  UA: Mozilla/5.0 Win64
  FP (decrypted): abc123...
  FP (regenerated): abc123...
  Match: ✓
  → Proceed to handler
```

---

## Migration: Changing Fingerprint Components

If you update fingerprint options:

```typescript
// v1: Original config
fingerprintOptions: {
  includeScreen: true,
  includeTimezone: true,
}

// v2: New config (added custom field)
fingerprintOptions: {
  includeScreen: true,
  includeTimezone: true,
  customFields: { buildVersion: '2.0.0' },
}
```

**Result on user's device:**
- Cache contains old FP (for original config)
- First request sends old FP
- Server receives mismatch → 401 CIPH003
- Client auto-retries with new FP
- User doesn't notice (transparent)

This is expected and safe — server validates both old and new FP against request context.

---

## Security Considerations

### Fingerprint Entropy

Fingerprints are **not cryptographically unique** per device, they're **contextually unique**.

```
Good entropy:
✓ User-Agent (hundreds of values)
✓ Screen size (hundreds of combinations)
✓ Timezone (400 zones)
✓ Language (100+ values)
✓ Custom fields (unlimited)

Low entropy:
✗ Just timezone alone (only 400 values)
✗ Just language (only 100 values)
✗ Shared office/school network (all same IP)
```

**Recommendation:** Combine multiple components. Default config provides ~25-30 bits of entropy, sufficient for replay prevention.

### Fingerprint Leakage

If encrypted fingerprint is compromised:

```
Attacker has: X-Fingerprint: xY9zM8...

Attacker needs: CIPH_SECRET (shared with backend)

After decryption: Gets device fingerprint hash
  - Reveals UA, screen, TZ, etc. (already visible in headers)
  - Does NOT reveal secret
  - Does NOT allow key derivation (needs secret)

Risk level: 🟡 Medium (reveals device state, not keys)
```

### Protection

- Store `CIPH_SECRET` in environment (not in code)
- Use HTTPS (blocks network eavesdropping)
- Rotate secret periodically
- Use strict CSP (Content Security Policy) to prevent XSS

---

## FAQ

**Q: Is fingerprint permanent?**
A: Per-session only. Cleared when tab closes or page reloads.

**Q: What if user disables screen info?**
A: Set `includeScreen: false` in config. App continues working.

**Q: Can I detect fingerprint changes in code?**
A: Yes, subscribe to `ciph-client-log` events. Check if new FP differs from previous.

**Q: Does fingerprint work across tabs?**
A: No, each tab has its own cache. Separate fingerprint per tab.

**Q: Can I force fingerprint regeneration?**
A: Only implicitly via CIPH003. Direct API: Not exposed (by design).
