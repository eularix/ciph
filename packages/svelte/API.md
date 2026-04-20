# @ciph/svelte — API Reference

## Client

### `ciphClient(config)`

Creates a Ciph-enabled HTTP client with Svelte store integration.

```typescript
import { ciphClient } from '@ciph/svelte'

const { client, fingerprintStore, errorStore, isEncryptingStore } = ciphClient({
  baseURL: import.meta.env.VITE_API_URL,
  serverPublicKey: import.meta.env.VITE_CIPH_SERVER_PUBLIC_KEY,
})
```

#### Parameters

```typescript
interface CiphClientConfig {
  baseURL: string
  serverPublicKey: string
  fingerprintOptions?: FingerprintOptions
  onFingerprintMismatch?: 'retry' | 'throw' | 'ignore'
  fallbackToPlain?: boolean
  excludeRoutes?: string[]
  headers?: Record<string, string>
}

interface FingerprintOptions {
  includeScreen?: boolean       // default: true
  includeTimezone?: boolean     // default: true
  customFields?: Record<string, string>
}
```

#### Returns

```typescript
interface CiphClientContext {
  client: CiphClient
  fingerprintStore: Readable<string | null>
  errorStore: Readable<CiphError | null>
  isEncryptingStore: Readable<boolean>
}
```

### `CiphClient`

HTTP client with standard methods.

```typescript
type CiphClient = {
  get: <T = unknown>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>
  post: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  put: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  patch: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  delete: <T = unknown>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>
}
```

### `CiphResponse<T>`

Response wrapper with metadata.

```typescript
interface CiphResponse<T> {
  data: T                           // Decrypted response body
  status: number
  statusText: string
  headers: Record<string, string>
  ciph: {
    coinsUsed?: number              // Optional: consumed credits
    coinsRemaining?: number         // Optional: remaining credits
    modelUsed?: string              // Optional: model used
  }
}
```

### `RequestConfig`

Per-request configuration (extends AxiosRequestConfig).

```typescript
interface RequestConfig extends AxiosRequestConfig {
  encrypt?: boolean                 // Override encryption for this request
  fingerprintFields?: Record<string, string>  // Extra fingerprint fields
}
```

### Stores

#### `fingerprintStore`
```typescript
const fingerprint: Readable<string | null> = fingerprintStore
```

Device fingerprint (base64url encoded). Updated on first request or after CIPH003 retry.

#### `errorStore`
```typescript
const error: Readable<CiphError | null> = errorStore
```

Current error, if any. Cleared on successful request.

#### `isEncryptingStore`
```typescript
const isEncrypting: Readable<boolean> = isEncryptingStore
```

True during encryption/decryption. Useful for loading indicators.

#### Usage in Svelte

```svelte
<script lang="ts">
  import { fingerprintStore, errorStore } from '$lib/ciph'
</script>

<p>Fingerprint: {$fingerprintStore || 'generating...'}</p>
{#if $errorStore}
  <p class="error">{$errorStore.message}</p>
{/if}
```

## Server

### `ciphHooks(config)`

Creates a SvelteKit handle hook for encryption middleware.

```typescript
import { ciphHooks } from '@ciph/svelte'

export const handle = ciphHooks({
  privateKey: process.env.CIPH_PRIVATE_KEY!,
  excludeRoutes: ['/health', '/api/public'],
})
```

#### Parameters

```typescript
interface CiphSvelteKitConfig {
  privateKey: string                      // ECDH P-256 private key (base64url pkcs8)
  excludeRoutes?: string[]                // default: ["/health", "/ciph", "/ciph/*"]
  maxPayloadSize?: number                 // default: 10 * 1024 * 1024 (10 MB)
  allowUnencrypted?: boolean              // default: false
  devtools?: CiphDevtoolsConfig
  _testOverrides?: { encrypt?: typeof core.encrypt }
}

interface CiphDevtoolsConfig {
  enabled?: boolean                       // default: true in dev
  maxLogs?: number                        // default: 500
}
```

#### Returns

```typescript
type Handle = (input: RequestEvent) => Promise<Response>
```

### `ciphPublicKeyEndpoint(publicKey)`

Helper to create a public key endpoint route.

```typescript
// src/routes/ciph-public-key/+server.ts
import { ciphPublicKeyEndpoint } from '@ciph/svelte'

export const GET = ciphPublicKeyEndpoint(process.env.VITE_CIPH_SERVER_PUBLIC_KEY!)
```

Returns a SvelteKit RequestHandler that responds with:

```json
{
  "publicKey": "<base64url-key>"
}
```

## DevTools

### `CiphDevtoolsPanel`

Svelte component for the floating devtools panel.

```svelte
<script lang="ts">
  import { CiphDevtoolsPanel } from '@ciph/svelte'
</script>

<CiphDevtoolsPanel
  position="bottom-right"
  defaultOpen={false}
  maxLogs={100}
  shortcutEnabled={true}
/>
```

#### Props

```typescript
interface CiphDevtoolsPanelProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom' | 'top' | 'left' | 'right'
  defaultOpen?: boolean                   // default: false
  maxLogs?: number                        // default: 100
  shortcutEnabled?: boolean               // default: true
}
```

- **Position:** Panel placement on screen
- **defaultOpen:** Show panel on mount
- **maxLogs:** Circular buffer size
- **shortcutEnabled:** Enable Ctrl+Shift+C to toggle

**Production guard:** Component returns `null` if `NODE_ENV === 'production'`.

### `emitClientLog(log)`

Emit a custom log entry to devtools (for advanced use).

```typescript
import { emitClientLog } from '@ciph/svelte'

emitClientLog({
  method: 'POST',
  route: '/api/endpoint',
  status: 200,
  timestamp: Date.now(),
  encrypted: true,
  encryptedBody: '...',
  plainBody: { foo: 'bar' },
  plainResponse: { success: true },
  error: null,
})
```

### `emitServerLog(log)`

Emit a custom server log entry (for advanced use).

```typescript
import { emitServerLog } from '@ciph/svelte'

emitServerLog({
  method: 'POST',
  route: '/api/endpoint',
  status: 200,
  timestamp: Date.now(),
  encrypted: true,
  encryptedRequestBody: '...',
  plainRequestBody: { foo: 'bar' },
  encryptedResponseBody: '...',
  plainResponseBody: { success: true },
  error: null,
})
```

### `autoInitClientEmitter()`

Manually initialize the client emitter (rarely needed).

```typescript
import { autoInitClientEmitter } from '@ciph/svelte'

autoInitClientEmitter()
```

### `autoInitServerEmitter()`

Manually initialize the server emitter (rarely needed).

```typescript
import { autoInitServerEmitter } from '@ciph/svelte'

autoInitServerEmitter()
```

## Types

### `CiphClient`
```typescript
type CiphClient = {
  get: <T>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>
  post: <T>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  put: <T>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  patch: <T>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  delete: <T>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>
}
```

### `CiphResponse<T>`
```typescript
interface CiphResponse<T> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  ciph: {
    coinsUsed?: number
    coinsRemaining?: number
    modelUsed?: string
  }
}
```

### `CiphError`

From `@ciph/core`. Holds error code and message.

```typescript
class CiphError extends Error {
  code: CiphErrorCode
  message: string
}

type CiphErrorCode = 
  | 'CIPH001'    // Missing headers
  | 'CIPH002'    // Fingerprint decrypt failed
  | 'CIPH003'    // Fingerprint mismatch
  | 'CIPH004'    // Body decrypt failed
  | 'CIPH005'    // Payload too large
  | 'CIPH006'    // Response encrypt failed
  | 'encryption_failed'
  | 'decryption_failed'
  | 'network_error'
```

## Hooks and Lifecycle

### Client Lifecycle

1. **First request**
   - Generate key pair (cached)
   - Generate fingerprint (cached)
   - Derive session key (cached)
   - Derive request key (fingerprint + session key)
   - Encrypt request

2. **Response**
   - On 401 CIPH003: Invalidate key pair + fingerprint, retry
   - Decrypt response
   - Update stores

3. **Tab lifetime**
   - Key pair and fingerprint persists
   - Session key persists (unless explicitly cleared)

### Server Lifecycle

1. **Per-request** (in `handle()`)
   - Validate headers
   - Derive session key
   - Decrypt request
   - Call route handler
   - Encrypt response

2. **Cleanup**
   - Automatic (WeakMap GC)
   - No manual state management required

## Error Handling

### Client

```typescript
const { client, errorStore } = ciphClient(config)

try {
  const res = await client.post('/api/endpoint', { data: 'test' })
  console.log(res.data)
} catch (err) {
  if (err instanceof CiphError) {
    console.error(err.code, err.message)  // CIPH003, Fingerprint mismatch
  } else {
    console.error('Network error', err)
  }
}
```

### Server

Errors are returned as JSON:

```json
{ "code": "CIPH003", "message": "Fingerprint mismatch: User-Agent changed" }
```

HTTP status codes match error severity (401 for auth, 400 for client, 500 for server).
