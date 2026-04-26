# @ciph/react

React wrapper for Ciph encryption. Drop-in axios replacement for transparent HTTP encryption in React apps.

## Features

- **Transparent encryption** — No changes to request/response handling
- **Axios-compatible** — Same API as axios
- **Automatic fingerprinting** — Per-device key derivation
- **DevTools integration** — Built-in devtools panel
- **TypeScript** — Fully typed
- **Zero setup** — Just wrap axios instance

## Install

```bash
npm install @ciph/react axios @ciph/core
# or
pnpm add @ciph/react axios @ciph/core
```

## Quick Start

```typescript
// lib/ciph.ts
import { createClient } from '@ciph/react'

export const ciph = createClient({
  baseURL: import.meta.env.VITE_API_URL,
  serverPublicKey: import.meta.env.CIPH_PUBLIC_KEY,
  fingerprintOptions: {
    includeScreen: true,
    includeTimezone: true,
  },
})
```

```typescript
// App.tsx
import { CiphDevtools } from '@ciph/devtools-client'
import { ciph } from './lib/ciph'

function App() {
  return (
    <>
      <YourApp />
      <CiphDevtools />
    </>
  )
}

export default App
```

```typescript
// Usage — identical to axios
const response = await ciph.get('/api/data')
const created = await ciph.post('/api/users', { name: 'John' })
await ciph.put('/api/users/1', { name: 'Jane' })
await ciph.delete('/api/users/1')
```

## Configuration

```typescript
interface CiphClientConfig {
  // Base URL for all requests
  baseURL: string

  // Server's ECDH P-256 public key (base64url, raw 65-byte point)
  // Get from backend at GET /ciph/public-key
  serverPublicKey: string

  // Fingerprint generation options
  fingerprintOptions?: {
    includeScreen?: boolean           // default: true
    includeTimezone?: boolean         // default: true
    includeLanguage?: boolean         // default: false
    includePlugins?: boolean          // default: false
    customFields?: Record<string, string>
  }

  // Action on fingerprint mismatch (CIPH003 — user changed network)
  // "retry" — auto-retry once with fresh key pair (default)
  // "throw" — throw error
  // "ignore" — continue with error
  onFingerprintMismatch?: 'retry' | 'throw' | 'ignore'

  // Routes to skip encryption
  // Default: ["/health", "/ciph", "/ciph/*"]
  excludeRoutes?: string[]

  // Fall back to plain request if encryption fails
  // default: false. NEVER use in production.
  fallbackToPlain?: boolean
}
```

## Environment Variables

```bash
# .env.local (Vite)
VITE_API_URL=https://api.example.com
CIPH_PUBLIC_KEY=<base64url-encoded-public-key>
```

**Get server public key:**
```bash
curl https://api.example.com/ciph/public-key
# → { "publicKey": "AQAB..." }
```

## API Reference

### `createClient(config: CiphClientConfig): AxiosInstance`

Creates encrypted axios instance.

**Params:** Configuration object

**Returns:** Axios instance with encryption interceptors

```typescript
const client = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: 'AQAB...',
})

// Use like axios
client.get('/api/data')
client.post('/api/users', { name: 'John' })
```

---

## Request Flow

1. **Fingerprint generation** — Create per-device fingerprint (cached for tab lifetime)
2. **ECDH key exchange** — Derive shared secret with server
3. **Session key derivation** — Generate AES key via HKDF
4. **Encrypt body** — AES-256-GCM encryption
5. **Send with headers:**
   - `X-Fingerprint-Encrypted` — Encrypted fingerprint
   - `X-Key-Pair-Public` — Client's ECDH public key
   - `Content-Type: text/plain` — Hide encryption from Network tab

---

## Response Flow

1. **Receive encrypted body** — Content-Type: text/plain
2. **Decrypt** — Use shared session key
3. **Parse JSON** — Convert ciphertext → plaintext object
4. **Auto-retry on CIPH003** — Mismatch? Fresh fingerprint + retry once
5. **Return to caller** — Transparent decryption

---

## Error Codes

| Code | HTTP | Meaning | Auto-retry? |
|------|------|---------|------------|
| CIPH001 | 401 | Missing fingerprint header | No |
| CIPH002 | 401 | Fingerprint decrypt failed (wrong secret) | No |
| CIPH003 | 401 | Fingerprint mismatch (IP/UA changed) | Yes (once) |
| CIPH004 | 400 | Body decrypt failed (tampered) | No |
| CIPH005 | 413 | Payload too large | No |
| CIPH006 | 500 | Server encrypt failed | No |

```typescript
try {
  const data = await ciph.get('/api/data')
} catch (err) {
  if (err.response?.data?.code === 'CIPH003') {
    // Network changed, auto-retried. If still fails, user moved networks
    console.error('Fingerprint mismatch — network changed?')
  }
}
```

---

## Fingerprint Mismatch Handling

Triggered when user changes network (IP) or user agent changes mid-session.

**Default behavior (`onFingerprintMismatch: "retry"`):**
```
Request 1: ❌ CIPH003 (IP mismatch)
         ↓
Generate new fingerprint + key pair
         ↓
Request 2 (auto-retry): ✅ Success
```

**Custom handling:**
```typescript
const client = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: '...',
  onFingerprintMismatch: (error) => {
    if (error.code === 'CIPH003') {
      // Manual handling
      console.error('Network changed, retrying...')
      // Return to retry, throw to fail, ignore to continue
    }
  },
})
```

---

## DevTools Integration

Floating panel shows encrypted/decrypted request/response logs.

```typescript
import { CiphDevtools } from '@ciph/devtools-client'

function App() {
  return (
    <>
      <YourApp />
      {/* Floating panel — dev only, tree-shaken in production */}
      <CiphDevtools
        position="bottom-right"
        defaultOpen={false}
        maxLogs={100}
        shortcut="ctrl+shift+c"
      />
    </>
  )
}
```

**Props:**
```typescript
interface CiphDevtoolsProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  defaultOpen?: boolean          // default: false
  maxLogs?: number               // default: 100 (circular buffer)
  shortcut?: string | null       // default: 'ctrl+shift+c'
  disabled?: boolean             // default: false (use to disable in dev)
}
```

---

## Examples

### Basic setup

```typescript
// lib/ciph.ts
import { createClient } from '@ciph/react'

export const ciph = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: import.meta.env.CIPH_PUBLIC_KEY,
})
```

### React Query integration

```typescript
import { useQuery, useMutation } from '@tanstack/react-query'
import { ciph } from '@/lib/ciph'

function useUserData(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => ciph.get(`/api/users/${id}`).then(r => r.data),
  })
}

function useUpdateUser() {
  return useMutation({
    mutationFn: (user) => ciph.put('/api/users', user),
  })
}
```

### SWR integration

```typescript
import useSWR from 'swr'
import { ciph } from '@/lib/ciph'

function useUser(id: string) {
  const { data, error } = useSWR(
    `/api/users/${id}`,
    (url) => ciph.get(url).then(r => r.data)
  )
  return { user: data, error }
}
```

### Conditional encryption

```typescript
const client = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: '...',
  excludeRoutes: [
    '/health',        // Don't encrypt health checks
    '/auth/login',    // Don't encrypt login (auth handled separately)
    '/public/*',      // Wildcard support
  ],
})

// GET /health → plain request (no encryption)
// GET /api/data → encrypted
// POST /auth/login → plain request
```

### Error boundaries

```typescript
function MyComponent() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ciph.get('/api/data')
      .then(res => console.log(res.data))
      .catch(err => {
        if (err.response?.data?.code === 'CIPH004') {
          setError('Data corrupted or tampered')
        } else if (err.response?.data?.code === 'CIPH003') {
          setError('Network changed — reconnecting...')
        }
      })
  }, [])

  return error ? <div className="error">{error}</div> : <div>Loading...</div>
}
```

---

## Performance

- **Fingerprint generation** — ~0.1ms (cached)
- **Key derivation** — ~0.5ms per request
- **Encryption** — ~1-2ms per 1KB
- **Decryption** — ~1-2ms per 1KB
- **Total overhead per request** — ~2-5ms (hardware-dependent)

Fingerprint cached for tab lifetime. No localStorage access.

---

## Security Notes

- **Fingerprint storage** — Module-level variable, not localStorage (XSS safe)
- **Fingerprint lifetime** — Tab lifetime. Closes if user clears cache/cookies.
- **Key derivation** — Stateless, derived per-request. No key storage.
- **Network visibility** — Browser DevTools shows `text/plain` body (ciphertext)
- **Man-in-the-middle** — Protected by ECDH key exchange + server secret

---

## TypeScript

Full TypeScript support included.

```typescript
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import type { CiphClientConfig } from '@ciph/react'
```

---

## Troubleshooting

### "CIPH003: Fingerprint mismatch"
**Cause:** User switched networks or user agent changed
**Fix:** Auto-retried once by default. If persists, user may have unstable network.

### "CIPH004: Body decrypt failed"
**Cause:** Ciphertext corrupted or wrong key
**Fix:** Check server is using same secret. Verify network isn't tampering.

### "CIPH006: Server encrypt failed"
**Cause:** Backend encryption threw error
**Fix:** Check server logs. Verify CIPH_SECRET is set correctly.

### DevTools panel not showing
**Check:**
1. Running in dev (production removes it via tree-shaking)
2. Shortcut not conflicting (customize with `shortcut` prop)
3. `disabled` prop not set to true

---

## License

MIT
