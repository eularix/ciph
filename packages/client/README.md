# @ciph/client

Transparent HTTP encryption client for Ciph. Axios wrapper with built-in encryption/decryption.

> **Note:** For React apps, use [`@ciph/react`](../react) instead. This package is framework-agnostic.

## Features

- **Framework-agnostic** — Works with any JavaScript framework (Vue, Svelte, Angular, etc.)
- **Axios-compatible** — Drop-in replacement for axios
- **Dual mode** — Supports v1 (symmetric, deprecated) and v2 (ECDH asymmetric)
- **Automatic encryption** — Transparent request/response handling
- **Per-device keys** — Device fingerprinting + key derivation
- **TypeScript** — Fully typed

## Install

```bash
npm install @ciph/client axios @ciph/core
# or
pnpm add @ciph/client axios @ciph/core
```

## Quick Start

### v2 (ECDH) — Recommended

```typescript
import { createClient } from '@ciph/client'

const ciph = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: 'AQAB...', // Get from server
})

// Use like axios
const data = await ciph.get('/api/data')
const created = await ciph.post('/api/users', { name: 'John' })
```

### v1 (Symmetric) — Deprecated

```typescript
import { createClient } from '@ciph/client'

const ciph = createClient({
  baseURL: 'https://api.example.com',
  secret: 'your-min-32-char-secret...',  // Deprecated
})

// Same API
const data = await ciph.get('/api/data')
```

## Configuration

```typescript
interface CiphClientConfig {
  // Required
  baseURL: string

  // v2 — ECDH asymmetric (recommended)
  serverPublicKey?: string          // Base64url P-256 point
  publicKeyEndpoint?: string        // URL to fetch key (default: baseURL + "/ciph-public-key")

  // v1 — Symmetric (deprecated)
  secret?: string                   // Min 32 chars, not recommended

  // Optional
  fingerprintOptions?: {
    includeScreen?: boolean         // default: true
    includeTimezone?: boolean       // default: true
    includeLanguage?: boolean       // default: false
    includePlugins?: boolean        // default: false
    customFields?: Record<string, string>
  }

  onFingerprintMismatch?: 'retry' | 'throw' | 'ignore'  // default: 'retry'
  fallbackToPlain?: boolean         // default: false, never in prod
  excludeRoutes?: string[]          // default: ["/health"]
  headers?: Record<string, string>  // Extra headers
}
```

## API Reference

### `createClient(config: CiphClientConfig): AxiosInstance`

Creates encrypted axios instance.

**Params:** Configuration object

**Returns:** Axios instance (use identically to axios)

```typescript
const client = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: 'AQAB...',
})

// All axios methods work
await client.get(url, config)
await client.post(url, data, config)
await client.put(url, data, config)
await client.patch(url, data, config)
await client.delete(url, config)
await client.request(config)
```

---

## Request Flow

1. **Generate fingerprint** — Device fingerprint (cached)
2. **ECDH key exchange** — Derive shared secret with server public key
3. **Derive session key** — HKDF-SHA256
4. **Encrypt body** — AES-256-GCM
5. **Send request** — Headers: X-Key-Pair-Public, X-Fingerprint-Encrypted
6. **Receive response** — Encrypted (text/plain)
7. **Decrypt** — Use session key
8. **Auto-retry on CIPH003** — Fresh fingerprint if needed
9. **Return plaintext** — To caller

---

## Error Handling

```typescript
try {
  const data = await ciph.get('/api/data')
} catch (err) {
  if (err.response?.data?.code === 'CIPH003') {
    // Network changed, will auto-retry
    console.error('Fingerprint mismatch')
  } else if (err.response?.data?.code === 'CIPH004') {
    // Body decrypt failed
    console.error('Data corrupted')
  } else {
    // Other axios error
    console.error(err.message)
  }
}
```

---

## Examples

### Vue.js

```typescript
// composables/useCiph.ts
import { createClient } from '@ciph/client'

export const ciph = createClient({
  baseURL: import.meta.env.VITE_API_URL,
  serverPublicKey: import.meta.env.CIPH_PUBLIC_KEY,
})

// components/UserList.vue
<script setup>
import { ref, onMounted } from 'vue'
import { ciph } from '@/composables/useCiph'

const users = ref([])

onMounted(async () => {
  const res = await ciph.get('/api/users')
  users.value = res.data
})
</script>

<template>
  <div v-for="user in users" :key="user.id">
    {{ user.name }}
  </div>
</template>
```

### Svelte

```typescript
// src/lib/ciph.ts
import { createClient } from '@ciph/client'

export const ciph = createClient({
  baseURL: import.meta.env.VITE_API_URL,
  serverPublicKey: import.meta.env.CIPH_PUBLIC_KEY,
})

// src/routes/+page.svelte
<script>
  import { onMount } from 'svelte'
  import { ciph } from '$lib/ciph'

  let users = []

  onMount(async () => {
    const res = await ciph.get('/api/users')
    users = res.data
  })
</script>

<div>
  {#each users as user (user.id)}
    <p>{user.name}</p>
  {/each}
</div>
```

### Angular

```typescript
// services/ciph.service.ts
import { Injectable } from '@angular/core'
import { createClient } from '@ciph/client'
import { environment } from '../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class CiphService {
  private client = createClient({
    baseURL: environment.apiUrl,
    serverPublicKey: environment.ciphServerPublicKey,
  })

  getUsers() {
    return this.client.get('/api/users')
  }

  createUser(data: any) {
    return this.client.post('/api/users', data)
  }
}

// components/users.component.ts
import { Component, OnInit } from '@angular/core'
import { CiphService } from '../services/ciph.service'

@Component({
  selector: 'app-users',
  template: `<div *ngFor="let user of users">{{ user.name }}</div>`
})
export class UsersComponent implements OnInit {
  users: any[] = []

  constructor(private ciph: CiphService) {}

  ngOnInit() {
    this.ciph.getUsers().then(res => {
      this.users = res.data
    })
  }
}
```

---

## Excluded Routes

Skip encryption for specific routes:

```typescript
const ciph = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: '...',
  excludeRoutes: [
    '/health',        // Health checks
    '/auth/*',        // All auth routes
    '/public/posts',  // Specific route
  ],
})

// GET /health → plain (no encryption)
// POST /auth/login → plain
// GET /api/data → encrypted
```

---

## Custom Headers

Add extra headers to all requests:

```typescript
const ciph = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: '...',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Client-Version': '1.0.0',
  },
})
```

---

## Per-Request Config

```typescript
const data = await ciph.get('/api/data', {
  timeout: 5000,
  params: { filter: 'active' },
  headers: { 'X-Custom': 'value' },
})

const created = await ciph.post('/api/users', { name: 'John' }, {
  encrypt: false,  // Skip encryption for this request
})
```

---

## Fingerprint Customization

```typescript
const ciph = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: '...',
  fingerprintOptions: {
    includeScreen: true,
    includeTimezone: true,
    includeLanguage: false,
    includePlugins: false,
    customFields: {
      userId: '123',      // App-specific data
      environment: 'prod',
    },
  },
})
```

---

## Mismatch Handling

When user's network changes (IP/UA mismatch):

**Default (`retry`):**
```
Request 1: ❌ CIPH003
    ↓
Auto-retry with fresh fingerprint
    ↓
Request 2: ✅ Success
```

**Custom:**
```typescript
const ciph = createClient({
  baseURL: 'https://api.example.com',
  serverPublicKey: '...',
  onFingerprintMismatch: 'throw',  // or 'ignore'
})
```

---

## TypeScript

Full types:

```typescript
import type { CiphClientConfig } from '@ciph/client'
import type { AxiosInstance } from 'axios'

const config: CiphClientConfig = {
  baseURL: 'https://api.example.com',
  serverPublicKey: 'AQAB...',
}

const ciph: AxiosInstance = createClient(config)
```

---

## v1 vs v2

| Feature | v1 (Deprecated) | v2 (Recommended) |
|---------|-----------------|-----------------|
| **Config** | `secret` | `serverPublicKey` |
| **Key type** | Symmetric (shared secret) | Asymmetric (ECDH) |
| **Security** | ⚠️ Lower (secret exposed) | ✅ Higher (ephemeral keys) |
| **Per-request key** | No (fixed) | Yes (unique per request) |
| **Recommended** | No | Yes |

**Migrate from v1:**
```typescript
// Before (v1)
const ciph = createClient({
  baseURL: '...',
  secret: 'xxxxx...',  // ❌ Deprecated
})

// After (v2)
const ciph = createClient({
  baseURL: '...',
  serverPublicKey: 'AQAB...',  // ✅ Recommended
})
```

---

## Performance

- **Fingerprint** — ~0.1ms (cached)
- **Key exchange** — ~0.5ms per request
- **Encryption** — ~1-2ms per 1KB
- **Total overhead** — ~2-5ms per request

---

## Security Notes

- **v1 deprecated** — Don't use shared `secret` mode
- **v2 recommended** — Use server public key + ephemeral keys
- **Fingerprint** — Cached, not in localStorage
- **Network** — HTTPS required in production

---

## Troubleshooting

### "CIPH003: Fingerprint mismatch"
User network changed. Auto-retried. If persistent, user has unstable network.

### "CIPH004: Body decrypt failed"
Ciphertext corrupted or wrong key. Check server uses same secret.

### No encryption happening
Check:
1. Route not in `excludeRoutes`?
2. Request body encrypted (text/plain)?
3. Server actually encrypted?

---

## License

MIT
