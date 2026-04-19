# Request/Response Flow — @ciph/vue

Complete documentation of what happens at each step when using `useCiph()` in Vue components.

---

## Diagram: Full Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Vue Component                                                           │
│ <script setup>                                                          │
│   const ciph = useCiph()                                               │
│   const { data } = await ciph.post('/api/action', payload)             │
│ </script>                                                               │
└─────────────────────┬───────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ @ ciph/client: Request Phase                                           │
│ (Encrypts request body)                                                 │
│                                                                         │
│  1. Is route in excludeRoutes?                                         │
│     ✓ Yes → Send unencrypted, skip to HTTP                             │
│     ✗ No → Continue                                                    │
│                                                                         │
│  2. Load or generate fingerprint                                       │
│     - From module-level cache first                                    │
│     - If missing: generate SHA-256 from device components              │
│                   (userAgent, screen size, timezone, etc.)             │
│                                                                         │
│  3. Encrypt fingerprint with CIPH_SECRET                               │
│     → IV(12) + AuthTag(16) + ciphertext → base64url                   │
│     → Result: X-Fingerprint header value                               │
│                                                                         │
│  4. Derive AES-256 key via HKDF:                                       │
│     HKDF-SHA256(                                                       │
│       secret: CIPH_SECRET,                                             │
│       salt: fingerprint (encrypted),                                   │
│       info: "ciph-v2"                                                  │
│     ) → 32 bytes for AES-GCM                                           │
│                                                                         │
│  5. Encrypt request body (if method has body: POST/PUT/PATCH):        │
│     AES-256-GCM encrypt:                                               │
│     - IV: random 12 bytes                                              │
│     - Key: derived in step 4                                           │
│     - Data: JSON.stringify(body)                                       │
│     - Result: IV(12) + AuthTag(16) + ciphertext → base64url           │
│                                                                         │
│  6. Set headers:                                                       │
│     X-Fingerprint: <encrypted-fingerprint-from-step-3>                │
│     Content-Type: text/plain                                           │
│     (Content-Type prevents browser from parsing as JSON)               │
│                                                                         │
│  7. Emit CiphClientLog (dev-only):                                    │
│     {                                                                  │
│       method: 'POST',                                                  │
│       route: '/api/action',                                            │
│       duration: 0,  // Will update after response                    │
│       status: null,                                                    │
│       encryptedBody: '<base64url ciphertext>',                        │
│       decryptedBody: { /* original payload */ },                      │
│     }                                                                  │
│     → Emitted to floating devtools panel                              │
└─────────────────────┬───────────────────────────────────────────────────┘
                      │
                      ▼
          ╔═══════════════════════════╗
          ║   NETWORK REQUEST         ║
          ║ POST /api/action         ║
          ║ X-Fingerprint: [...] ║
          ║ Content-Type: text/plain  ║
          ║ Body: <ciphertext>        ║
          ╚═════════════┬═════════════╝
                        │
                        ▼  [SERVER PROCESSING]
                        │
                        │  Server:
                        │  1. Extract X-Fingerprint header
                        │  2. Decrypt fingerprint (same secret)
                        │  3. Validate fingerprint (IP, UA, timestamp)
                        │  4. Derive same AES key (same HKDF)
                        │  5. Decrypt body with AES-GCM
                        │  6. Process plaintext request
                        │  7. Generate response
                        │  8. Encrypt response body (same process)
                        │  9. Send ciphertext response
                        │
                        ▼
          ╔═══════════════════════════╗
          ║   NETWORK RESPONSE        ║
          ║ Status: 200 OK           ║
          ║ Body: <ciphertext>        ║
          ╚═════════════┬═════════════╝
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ @ciph/client: Response Phase                                            │
│ (Decrypts response body)                                                 │
│                                                                         │
│  10. Check response status:                                            │
│      - 401 + code CIPH003 → Fingerprint mismatch, retry flow (↓)      │
│      - 4xx/5xx other → Throw AxiosError                                │
│      - 2xx → Continue                                                  │
│                                                                         │
│  11. Derive same AES key as step 4 (using cached fingerprint)         │
│      (Note: Same fingerprint = same key, deterministic)                │
│                                                                         │
│  12. Decrypt response body:                                            │
│      - Parse base64url ciphertext                                      │
│      - Extract IV(12), AuthTag(16), encrypted data                    │
│      - AES-256-GCM decrypt with derived key                           │
│      - Result: plaintext JSON                                          │
│      - JSON.parse → plain object                                       │
│                                                                         │
│  13. Emit final CiphClientLog (dev-only):                             │
│      {                                                                 │
│        status: 200,        // Now populated                           │
│        duration: 45,       // Milliseconds                             │
│        encryptedBody: '<binary>',                                      │
│        decryptedBody: { /* response from server */ },                 │
│      }                                                                 │
│                                                                         │
│  14. Return CiphResponse<T> to component:                             │
│      {                                                                 │
│        data: { /* decrypted-response */ },  // ← Your payload here    │
│        status: 200,                                                    │
│        statusText: 'OK',                                               │
│        headers: { /* response headers */ },                            │
│        ciph: { coinsUsed: 10, ... },                                   │
│      }                                                                 │
└─────────────────────┬───────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Vue Component (Back in <script setup>)                                  │
│                                                                         │
│   const { data } = await ciph.post(...)  ← Resolves here               │
│   // data is now plain, decrypted response                             │
│   console.log(data)  // ✅ Plain object, not ciphertext               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Fingerprint Mismatch Retry Flow

When server returns `401 CIPH003` (fingerprint mismatch):

```
┌──────────────────────────────────────────────────────────────┐
│ Fingerprint Mismatch Detected (CIPH003)                     │
│ (e.g., User changed WiFi → Different IP address)        │
│                                                          │
│ Why: Stored device fingerprint includes IP/UA hash,      │
│      which changed since first request                   │
└───────────────────┬──────────────────────────────────────┘
                    │
                    ▼
            ┌───────────────────┐
            │ Clear cache:      │
            │ - Old fingerprint │
            │ - Old AES key     │
            └───────────┬───────┘
                        │
                        ▼
        ┌─────────────────────────────────┐
        │ Generate fresh fingerprint:     │
        │ - Re-hash current device state  │
        │ - New IP address included       │
        │ - Encrypt with new salt value   │
        └─────────────┬───────────────────┘
                      │
                      ▼
      ┌────────────────────────────────────┐
      │ Reconstruct original request:      │
      │ - Same method (POST)               │
      │ - Same URL                         │
      │ - Same body (re-encrypt with new key) │
      │ - New X-Fingerprint header         │
      └────────────┬─────────────────────┘
                   │
                   ▼
    ╔═══════════════════════════════════╗
    ║ RETRY: Send request with new key  ║
    ║ (Should succeed this time)         ║
    ╚═══════════┬═══════════════════════╝
                │
                ▼
    ┌─────────────────────────────────────┐
    │ If retry succeeds: Return response   │
    │ If retry fails again: Throw CIPH003 │
    └─────────────────────────────────────┘
```

---

## Code Example: Step-by-Step

```typescript
// Component
<script setup lang="ts">
import { useCiph } from '@ciph/vue'
import { computed, ref } from 'vue'

const ciph = useCiph()
const loading = ref(false)
const result = ref(null)

const handleSubmit = async () => {
  loading.value = true
  try {
    // Request Phase begins here:
    //   1. Check excludeRoutes → No match
    //   2. Load fingerprint from cache
    //   3. Encrypt fingerprint
    //   4. Derive AES key (deterministic from fingerprint)
    //   5. Encrypt body
    //   6. Set X-Fingerprint header
    //   7. Emit CiphClientLog with encrypted data
    
    const { data } = await ciph.post('/api/process', {
      content: 'Hello world',  // ← This gets encrypted
      timestamp: Date.now(),   // ← This too
    })
    
    // Response Phase here:
    //    10. Server check response status
    //    11. Derive same AES key
    //    12. Decrypt response body
    //    13. Emit complete CiphClientLog with status
    //    14. Return response
    
    result.value = data  // ← Plain, decrypted data
    console.log('Success:', data)
    
  } catch (error) {
    console.error('Error:', error)
    // If CIPH003: Already auto-retried once
    // If still fails: Throws error
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <button :disabled="loading">
      {{ loading ? 'Sending...' : 'Submit' }}
    </button>
    <div v-if="result">Result: {{ JSON.stringify(result) }}</div>
  </form>
</template>
```

---

## Fingerprint Cache Lifecycle

```
┌─────────────────────────────────────────────────────┐
│ Module Initialization (first import of @ciph/vue)  │
│                                                    │
│ fingerprint = null  (module-level variable)         │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ First useCiph() call in any component              │
│                                                    │
│ Check: fingerprint exists?                         │
│  ✗ No → Generate new:                             │
│    - SHA-256(userAgent + screen + timezone + ...)  │
│    - Encrypt with secret                           │
│    - Cache in module variable                      │
│  ✓ Yes → Use cached value                          │
└────────────┬────────────────────────────────────────┘
             │
             ▼
   All subsequent requests use SAME fingerprint
   (and thus SAME derived AES key)
   for the lifetime of the page/tab
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ If CIPH003 received from server:                   │
│                                                    │
│ fingerprint = null  (clear cache)                   │
│ ↻ Generate new fingerprint (goto "First call")      │
│                                                    │
│ Reason: Device state (IP/UA) changed              │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ Page navigation or tab close                       │
│                                                    │
│ fingerprint destroyed (not in localStorage)        │
│ Next tab/session: Start fresh                      │
│                                                    │
│ ✅ Defense against XSS: Cache in memory only       │
└─────────────────────────────────────────────────────┘
```

---

## Encryption/Decryption Details

### Request Body Encryption

```
Plaintext:
{
  "username": "alice",
  "password": "secret"
}

↓ JSON.stringify()

JSON String:
{"username":"alice","password":"secret"}

↓ AES-256-GCM encrypt with derived key

Output Format:
IV (12 bytes) + AuthTag (16 bytes) + Ciphertext (variable)
                 ↓
            base64url encode

X-Fingerprint Header:
zN4qX8k9mL2pQ5wE7rT6yU3sH8fG1jD0aB2cQ4mW5nE6oS7vR8xU9yV0zW

Content-Type: text/plain
Body: xY9zM8bN7qW6sQ5kE4rT3yV2uO1pI0jH9aG8fL7eM6dN5cO4bP3aQ2zR1sS0tU
```

### Response Body Decryption

Server applies identical encryption, client reverses:

```
Received ciphertext:
xY9zM8bN7qW6sQ5kE4rT3yV2uO1pI0jH9aG8fL7eM6dN5cO4bP3aQ2zR1sS0tU

↓ base64url decode

Raw bytes:
[IV(12)] [AuthTag(16)] [encrypted data]

↓ AES-256-GCM decrypt with derived key (same key, same fingerprint)

Decrypted JSON:
{"success":true,"userId":123,"token":"xyz..."}

↓ JSON.parse()

Plaintext Object:
{
  success: true,
  userId: 123,
  token: "xyz..."
}
```

---

## DevTools Panel Event Timeline

As you make requests, the floating panel receives events:

```
[Log 1] 14:23:45
POST /api/login
Status: 200 (after success)
Duration: 45ms

[Log 2] 14:23:51
GET /api/profile
Status: 200
Duration: 23ms

[Log 3] 14:23:58
POST /api/action
Status: 401 → Auto-retry with new fingerprint
Status: 200 (retry succeeded)
Duration: 78ms (total)
```

Click any log row to see full encrypted/decrypted payloads.
