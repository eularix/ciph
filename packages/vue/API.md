# API Reference — @ciph/vue

Complete API documentation for Vue plugin and composables.

---

## `CiphPlugin`

Vue plugin that initializes the encrypted HTTP client and injects it globally.

### Installation

```typescript
import { createApp } from 'vue'
import { CiphPlugin } from '@ciph/vue'

const app = createApp(App)
app.use(CiphPlugin, { /* options */ })
```

### Options: `CiphPluginOptions`

Extends `CiphClientConfig` from `@ciph/client` with Vue-specific options.

```typescript
interface CiphPluginOptions extends CiphClientConfig {
  // From @ciph/client:
  baseURL: string                    // Required: API base URL
  serverPublicKey: string            // Required: ECDH server public key
  
  fingerprintOptions?: {
    includeScreen?: boolean          // default: true
    includeTimezone?: boolean        // default: true
    customFields?: Record<string, string>
  }

  // Vue-specific:
  devtools?: CiphDevtoolsConfig | false  // Optional: devtools configuration
}
```

### Devtools Configuration: `CiphDevtoolsConfig`

```typescript
interface CiphDevtoolsConfig {
  /** Show devtools panel. Default: true in dev, false in production. */
  enabled?: boolean
  
  /** Max logs to buffer. Default: 500 */
  maxLogs?: number
  
  /** Panel open on page load. Default: false */
  defaultOpen?: boolean
  
  /** Panel position on screen. Default: "bottom-right" */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom' | 'top' | 'left' | 'right'
}
```

### Example

```typescript
app.use(CiphPlugin, {
  baseURL: import.meta.env.VITE_API_URL,
  serverPublicKey: import.meta.env.VITE_CIPH_SERVER_PUBLIC_KEY,
  fingerprintOptions: {
    includeScreen: true,
    includeTimezone: true,
    customFields: {
      appVersion: '1.0.0',
      environment: 'staging',
    },
  },
  devtools: {
    enabled: true,
    defaultOpen: false,
    position: 'bottom-right',
    maxLogs: 100,
  },
})
```

---

## `useCiph()`

Composable that returns the encrypted HTTP client injected by `CiphPlugin`.

### Signature

```typescript
function useCiph(): CiphClient
```

### Returns: `CiphClient`

```typescript
interface CiphClient {
  get<T = unknown>(url: string, config?: RequestConfig): Promise<CiphResponse<T>>
  post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<CiphResponse<T>>
  put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<CiphResponse<T>>
  patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<CiphResponse<T>>
  delete<T = unknown>(url: string, config?: RequestConfig): Promise<CiphResponse<T>>
}
```

### Usage

```typescript
<script setup lang="ts">
import { useCiph } from '@ciph/vue'

const ciph = useCiph()

// GET request
const { data: user } = await ciph.get<User>('/api/users/1')

// POST with data
const { data: created } = await ciph.post<Post>(
  '/api/posts',
  { title: 'Hello', content: 'World' }
)

// With error handling
try {
  const { data } = await ciph.get('/api/protected')
  console.log(data)
} catch (error) {
  if (error instanceof CiphError) {
    console.error(`Encryption error: ${error.message}`)
  } else {
    console.error('Network error:', error)
  }
}
</script>
```

### Throws

- Missing plugin: `TypeError: useInject(CIPH_CLIENT_KEY) is null`
- Network errors: Standard axios `AxiosError`
- Encryption errors: `CiphError` with code (CIPH001-CIPH006)

---

## HTTP Methods

All methods have identical behavior to axios, with automatic encryption:

### `ciph.get<T>(url, config?)`

Fetch without body. Still includes `X-Fingerprint` header.

```typescript
const { data } = await ciph.get<User>('/api/users/1')
```

### `ciph.post<T>(url, data?, config?)`

Send with encrypted body.

```typescript
const { data } = await ciph.post<Post>('/api/posts', {
  title: 'My Post',
  content: 'Hello world',
})
```

### `ciph.put<T>(url, data?, config?)`

Replace resource with encrypted body.

```typescript
const { data } = await ciph.put<User>('/api/users/1', {
  name: 'Updated Name',
})
```

### `ciph.patch<T>(url, data?, config?)`

Partial update with encrypted body.

```typescript
const { data } = await ciph.patch<User>('/api/users/1', {
  email: 'new@example.com',
})
```

### `ciph.delete<T>(url, config?)`

Delete resource. Body optional.

```typescript
await ciph.delete('/api/users/1')
```

---

## Request Configuration: `RequestConfig`

Optional per-request settings that extend axios config.

```typescript
interface RequestConfig extends AxiosRequestConfig {
  /** Override global encrypt setting for this request only. Default: use global */
  encrypt?: boolean

  /** Additional custom fingerprint fields for this request */
  fingerprintFields?: Record<string, string>

  /** Axios standard options */
  headers?: Record<string, string>
  params?: Record<string, unknown>
  timeout?: number
  // ... all other axios options
}
```

### Usage

```typescript
const { data } = await ciph.post<Result>(
  '/api/action',
  { action: 'process' },
  {
    headers: { 'X-Custom-Header': 'value' },
    timeout: 30000,
    fingerprintFields: { requestId: 'abc123' },
  }
)
```

---

## Response Type: `CiphResponse<T>`

```typescript
interface CiphResponse<T> {
  /** Decrypted response body */
  data: T

  /** HTTP status code */
  status: number

  /** HTTP status text */
  statusText: string

  /** Response headers */
  headers: Record<string, string>

  /** Ciph-specific response metadata */
  ciph: {
    coinsUsed?: number        // X-Coins-Used header (if present)
    coinsRemaining?: number   // X-Coins-Remaining header (if present)
    modelUsed?: string        // X-Model-Used header (if present)
  }
}
```

### Type Inference

```typescript
interface Post {
  id: number
  title: string
  content: string
}

const response = await ciph.get<Post>('/api/posts/1')
// response.data is inferred as Post
// typescript error if you access response.data.notAField
```

---

## Error Handling: `CiphError`

All Ciph encryption errors throw `CiphError` instances.

```typescript
import { CiphError } from '@ciph/vue'

try {
  await ciph.post('/api/secure', data)
} catch (error) {
  if (error instanceof CiphError) {
    console.error(`[${error.code}] ${error.message}`)
    
    // Access error code
    if (error.code === 'CIPH003') {
      console.log('Fingerprint mismatch (auto-retried)')
    }
  } else {
    // Standard axios error
    console.error('Network error:', error)
  }
}
```

### Error Codes

```typescript
type CiphErrorCode = 
  | 'CIPH001'  // Missing X-Fingerprint header
  | 'CIPH002'  // Fingerprint decrypt failed
  | 'CIPH003'  // Fingerprint mismatch (auto-retried once)
  | 'CIPH004'  // Body decrypt failed
  | 'CIPH005'  // Payload exceeds maxPayloadSize
  | 'CIPH006'  // Response encrypt failed (server-side)
```

---

## Injection Key: `CIPH_CLIENT_KEY`

For advanced use cases where you need direct access to the Symbol key:

```typescript
import { inject } from 'vue'
import { CIPH_CLIENT_KEY } from '@ciph/vue'

// Manually inject (not recommended, use useCiph() instead)
const ciph = inject(CIPH_CLIENT_KEY)
```

---

## `createClient(config)` (Direct Function)

For non-Vue contexts (utilities, stores, etc.), import directly:

```typescript
import { createClient } from '@ciph/vue'

const ciph = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: 'YOUR_SERVER_PUBLIC_KEY',
})

await ciph.post('/api/data', payload)
```

---

## Devtools Programmatic Control

To emit custom logs or subscribe to events:

```typescript
import { emitClientLog } from '@ciph/vue'

emitClientLog({
  method: 'POST',
  route: '/api/custom',
  duration: 150,
  status: 200,
  encrypedBody: '...',
  decryptedBody: { /* ... */ },
})
```

---

## TypeScript Best Practices

### Strict Typing

```typescript
// ✅ Good
interface ApiResponse {
  success: boolean
  message: string
}

const { data } = await ciph.get<ApiResponse>('/api/status')
data.success // ✅ Type-checked

// ❌ Avoid
const { data } = await ciph.get('/api/status')
(data as any).success // ❌ Loses type safety
```

### Generic Constraints

```typescript
// Define reusable response shapes
interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
}

interface User {
  id: number
  name: string
}

const { data } = await ciph.get<PaginatedResponse<User>>('/api/users?page=1')
data.items[0].name // ✅ Fully typed
```
