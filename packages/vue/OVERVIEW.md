# @ciph/vue — Overview

Vue 3 wrapper for Ciph transparent HTTP encryption. Builds on top of `@ciph/client` to provide composable-based integration for Vue applications.

## Purpose

`@ciph/vue` is a Vue 3 plugin + composable system that brings transparent HTTP encryption to Vue apps. Developers use the `useCiph()` composable in any component to access the encrypted HTTP client—no manual setup required beyond registering the plugin once.

## Core Principles

- **Vue-idiomatic** — Uses Vue 3 composables and dependency injection
- **Zero-change DX** — Same axios API: `.get()`, `.post()`, `.put()`, `.patch()`, `.delete()`
- **Single setup** — `app.use(CiphPlugin, {...})` called once in main.ts
- **Transparent** — All encryption/decryption handled automatically by interceptors
- **DevTools integration** — Floating panel shows decrypted logs (dev-only, tree-shaken in prod)

## What @ciph/vue Does

1. Create and manage encrypted HTTP client via `@ciph/client`
2. Provide client globally to all components via Vue's dependency injection system
3. Export `useCiph()` composable for easy access in any component
4. Integrate with `@ciph/devtools-client` for optional devtools panel
5. Handle lifecycle: mount/unmount devtools with app

## What @ciph/vue Does NOT Do

- Does not manage HTTP interceptors directly (delegated to `@ciph/client`)
- Does not provide state management (use Pinia/Vuex separately if needed)
- Does not encrypt file uploads or FormData (v1 limitation)
- Does not handle authentication headers (caller's responsibility)

## Architecture

```
Vue Component
    │
    └─> useCiph() (composable)
        │
        └─> CIPH_CLIENT_KEY (injected by plugin)
            │
            └─> CiphClient (from @ciph/client)
                │
                ├─> Request Interceptor (encrypt body + inject X-Fingerprint)
                │
                ├─> Response Interceptor (decrypt body)
                │
                └─> Devtools Emitter (emit logs to floating panel)
```

## Plugin Installation

```typescript
import { createApp } from 'vue'
import { CiphPlugin } from '@ciph/vue'

const app = createApp(App)

app.use(CiphPlugin, {
  baseURL: 'https://api.example.com',
  serverPublicKey: process.env.VITE_CIPH_SERVER_PUBLIC_KEY,
  fingerprintOptions: { includeScreen: true },
  devtools: { enabled: true, position: 'bottom-right' },
})
```

## Composable Usage

```typescript
import { useCiph } from '@ciph/vue'

export default {
  setup() {
    const ciph = useCiph()
    
    const fetchData = async () => {
      const response = await ciph.get('/api/data')
      return response.data
    }
    
    return { fetchData }
  },
}
```

## DevTools Integration

When `devtools: { enabled: true }` (default in dev, always off in prod):
- Floating panel auto-mounts to DOM
- Shows all encrypted requests/responses
- Displays decrypted payloads for inspection
- Keyboard shortcut: `Ctrl+Shift+C` to toggle

## Runtime Support

| Runtime | Status |
|---------|--------|
| Browser (Vue 3) | ✅ Full support |
| Nuxt 3+ | ✅ Compatible, register in nuxt.config.ts |
| Vite | ✅ Optimized |
| Node.js (Vue SSR) | ✅ Via `@ciph/client` ESM fallback |

## Dependencies

| Package | Role |
|---------|------|
| `vue` | Peer (3.0+) |
| `axios` | Peer (1.0+) |
| `@ciph/core` | Core encryption (ECDH v2) |
| `@ciph/client` | HTTP client wrapper |
| `@ciph/devtools-client` | Optional devtools panel |

## Error Handling

All errors inherit from `CiphError`. Status codes:

| Code | HTTP | Meaning |
|------|------|---------|
| CIPH001 | 401 | Missing fingerprint header |
| CIPH002 | 401 | Fingerprint decrypt failed |
| CIPH003 | 401 | Fingerprint mismatch (auto-retry) |
| CIPH004 | 400 | Body decrypt failed |
| CIPH005 | 413 | Payload too large |
| CIPH006 | 500 | Response encrypt failed |

## Nuxt Integration

For Nuxt 3+, register plugin in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: [],
  plugins: ['~/plugins/ciph.ts'],
})
```

Then in `plugins/ciph.ts`:

```typescript
import { defineNuxtPlugin } from '#app'
import { CiphPlugin } from '@ciph/vue'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(CiphPlugin, {
    baseURL: process.env.NUXT_PUBLIC_API_URL,
    serverPublicKey: process.env.NUXT_PUBLIC_CIPH_KEY,
  })
})
```

## Related Packages

- `@ciph/core` — Cryptography primitives (ECDH + AES-256-GCM)
- `@ciph/client` — Raw axios wrapper (used by this package)
- `@ciph/devtools-client` — DevTools floating panel
- `@ciph/hono` — Backend middleware for Hono
