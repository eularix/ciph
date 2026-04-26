# @ciph/vue

Vue 3 wrapper for Ciph transparent HTTP encryption. Drop-in composable + plugin for transparent request/response encryption in Vue apps.

## Features

- **Transparent encryption** — No changes to request/response handling
- **Vue 3 composables** — `useCiph()` integration with your components
- **Automatic fingerprinting** — Per-device key derivation
- **DevTools integration** — Built-in floating devtools panel (dev-only)
- **TypeScript** — Fully typed
- **Zero setup** — Install plugin once, use composable anywhere
- **ECDH v2** — Asymmetric key exchange + AES-256-GCM encryption

## Install

```bash
npm install @ciph/vue axios @ciph/core
# or
pnpm add @ciph/vue axios @ciph/core
# or
bun add @ciph/vue axios @ciph/core
```

## Quick Start

### 1. Register Plugin (main.ts)

```typescript
import { createApp } from 'vue'
import { CiphPlugin } from '@ciph/vue'
import App from './App.vue'

const app = createApp(App)

app.use(CiphPlugin, {
  baseURL: import.meta.env.VITE_API_URL,
  serverPublicKey: import.meta.env.CIPH_PUBLIC_KEY,
  fingerprintOptions: {
    includeScreen: true,
    includeTimezone: true,
  },
  // Optional: configure devtools
  devtools: {
    enabled: true,
    defaultOpen: false,
    position: 'bottom-right',
  },
})

app.mount('#app')
```

### 2. Use in Component

```vue
<template>
  <div>
    <button @click="fetchUsers">Fetch Users</button>
    <div v-if="loading">Loading...</div>
    <ul v-else>
      <li v-for="user in users" :key="user.id">{{ user.name }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCiph } from '@ciph/vue'

const ciph = useCiph()
const users = ref([])
const loading = ref(false)

async function fetchUsers() {
  loading.value = true
  try {
    const response = await ciph.get('/api/users')
    users.value = response.data
  } catch (error) {
    console.error('Failed to fetch users:', error)
  } finally {
    loading.value = false
  }
}
</script>
```

## API

### `CiphPlugin`

Vue plugin that registers the Ciph client globally via dependency injection.

```typescript
app.use(CiphPlugin, {
  baseURL: string                    // Required
  serverPublicKey: string            // Required (ECDH public key)
  fingerprintOptions?: {
    includeScreen?: boolean
    includeTimezone?: boolean
    customFields?: Record<string, string>
  }
  devtools?: CiphDevtoolsConfig | false  // Optional
})
```

### `useCiph()`

Composable that returns the encrypted HTTP client. Must be called inside a component.

```typescript
import { useCiph } from '@ciph/vue'

const ciph = useCiph()

// Use all HTTP methods
await ciph.get('/url')
await ciph.post('/url', data)
await ciph.put('/url', data)
await ciph.patch('/url', data)
await ciph.delete('/url')
```

## How It Works

1. **Plugin Registration** — `CiphPlugin` creates encrypted client and injects it into Vue app
2. **Composable Hook** — `useCiph()` retrieves injected client using Vue's `inject`
3. **Automatic Encryption** — All requests/responses filtered through Ciph interceptors
4. **DevTools Panel** — Floats on page, shows decrypted logs (dev-only)
5. **Production Safety** — DevTools panel and logging completely removed in production

## Devtools Configuration

```typescript
devtools: {
  enabled: true,              // Show panel (default: true in dev)
  defaultOpen: false,         // Start panel collapsed (default)
  position: 'bottom-right',   // "bottom-right" | "bottom-left" | "top-right" | "top-left"
  maxLogs: 500,              // Max logs to keep (default: 500)
}
```

**Keyboard Shortcut:** `Ctrl+Shift+C` (or `Cmd+Shift+C` on Mac) to toggle panel visibility

## Error Handling

All Ciph error codes from `@ciph/core` are available:

```typescript
import { CiphError } from '@ciph/vue'

try {
  await ciph.post('/api/secure', data)
} catch (error) {
  if (error instanceof CiphError) {
    console.error(`Ciph error [${error.code}]: ${error.message}`)
  } else {
    console.error('Network error:', error)
  }
}
```

Common error codes:
- `CIPH003` — Fingerprint mismatch (auto-retried client-side)
- `CIPH004` — Body decrypt failed
- `CIPH005` — Payload too large
- `CIPH006` — Response encrypt failed (server-side)

## Comparison: Composable vs createClient

### Using Composable (Recommended)

```typescript
// Easy, works in any component
const ciph = useCiph()
await ciph.get('/api/data')
```

### Using createClient Directly

```typescript
// For use outside Vue (utilities, node scripts)
import { createClient } from '@ciph/vue'

const ciph = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: 'YOUR_PUBLIC_KEY',
})

await ciph.get('/api/data')
```

## TypeScript

All methods are fully typed. Return type includes decrypted data:

```typescript
interface User {
  id: number
  name: string
}

const response = await ciph.get<User>('/api/users/1')
// response.data is typed as User
```

## Production Safety

- ✅ DevTools panel automatically disabled (tree-shaken by bundler)
- ✅ No logging in production
- ✅ Fingerprint validation always active
- ✅ Strict error handling (no fallback to plain text)

## See Also

- [@ciph/core](../core) — Cryptography primitives
- [@ciph/client](../client) — Raw HTTP client
- [@ciph/devtools-client](../devtools-client) — DevTools panel UI
- [Ciph Documentation](../../docs) — Full guides and examples
