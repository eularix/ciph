# @ciph/svelte

SvelteKit client and server for Ciph transparent HTTP encryption. Drop-in composable + server hooks for transparent request/response encryption in SvelteKit apps.

## Features

- **Transparent encryption** — No changes to request/response handling
- **Svelte stores** — Reactive fingerprint, error, and loading states
- **Automatic fingerprinting** — Per-device key derivation
- **SvelteKit Hooks** — Server-side request/response encryption
- **DevTools integration** — Built-in floating devtools panel (dev-only)
- **TypeScript** — Fully typed, strict mode
- **Zero setup** — Import and use components directly
- **ECDH v2** — Asymmetric key exchange + AES-256-GCM encryption

## Install

```bash
npm install @ciph/svelte axios @ciph/core
# or
pnpm add @ciph/svelte axios @ciph/core
# or
bun add @ciph/svelte axios @ciph/core
```

## Quick Start

### 1. Client Setup (src/lib/ciph.ts)

```typescript
import { ciphClient } from '@ciph/svelte'

export const { client, fingerprintStore, errorStore, isEncryptingStore } =
  ciphClient({
    baseURL: import.meta.env.VITE_API_URL,
    serverPublicKey: import.meta.env.VITE_CIPH_SERVER_PUBLIC_KEY,
    fingerprintOptions: {
      includeScreen: true,
      includeTimezone: true,
    },
  })
```

### 2. Server Setup (src/hooks.server.ts)

```typescript
import { ciphHooks } from '@ciph/svelte'

export const handle = ciphHooks({
  privateKey: process.env.CIPH_PRIVATE_KEY!,
  excludeRoutes: ['/health', '/api/public'],
  devtools: {
    enabled: process.env.NODE_ENV === 'development',
  },
})
```

### 3. Use in Components (src/routes/+page.svelte)

```svelte
<script lang="ts">
  import { client, fingerprintStore, errorStore } from '$lib/ciph'

  let profile = null
  let isLoading = false

  async function loadProfile() {
    try {
      isLoading = true
      const res = await client.get('/api/profile')
      profile = res.data // Already decrypted!
    } catch (err) {
      console.error('Request failed:', $errorStore?.message)
    } finally {
      isLoading = false
    }
  }
</script>

<p>Device Fingerprint: {$fingerprintStore || 'loading...'}</p>
{#if $errorStore}
  <p class="error">{$errorStore.message}</p>
{/if}
<button on:click={loadProfile} disabled={isLoading}>
  {isLoading ? 'Loading...' : 'Load Profile'}
</button>
{#if profile}
  <pre>{JSON.stringify(profile, null, 2)}</pre>
{/if}
```

### 4. DevTools (Optional)

```svelte
<script lang="ts">
  import { CiphDevtoolsPanel } from '@ciph/svelte'
</script>

<CiphDevtoolsPanel position="bottom-right" maxLogs={100} />
<!-- DevTools auto-disabled in production -->
```

## Configuration

### Client Config

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseURL` | string | required | Base URL for requests |
| `serverPublicKey` | string | required | Server's ECDH public key (base64url) |
| `fingerprintOptions` | object | — | Fingerprint generation options |
| `onFingerprintMismatch` | "retry" \| "throw" \| "ignore" | "retry" | Action on CIPH003 errors |
| `fallbackToPlain` | boolean | false | Fall back to plaintext on encryption failure |
| `excludeRoutes` | string[] | ["/health"] | Routes to skip encryption |
| `headers` | object | — | Default request headers |

### Server Config

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `privateKey` | string | required | Server's ECDH private key (base64url pkcs8) |
| `excludeRoutes` | string[] | ["/health", "/ciph", "/ciph/*"] | Routes to skip encryption |
| `maxPayloadSize` | number | 10MB | Max allowed request body size |
| `allowUnencrypted` | boolean | false | Allow unencrypted requests (migration only) |
| `devtools` | object | — | DevTools configuration |

## Stores

### `fingerprintStore` (Readable<string | null>)

Device fingerprint generated on first request. Used for per-device key derivation.

```svelte
<script lang="ts">
  import { fingerprintStore } from '$lib/ciph'
</script>

<p>Your device fingerprint: {$fingerprintStore}</p>
```

### `errorStore` (Readable<CiphError | null>)

Current error if encryption/decryption fails.

```svelte
<script lang="ts">
  import { errorStore } from '$lib/ciph'
</script>

{#if $errorStore}
  <p>Error: {$errorStore.message}</p>
  <p>Code: {$errorStore.code}</p>
{/if}
```

### `isEncryptingStore` (Readable<boolean>)

Loading state during encryption/decryption.

```svelte
<script lang="ts">
  import { isEncryptingStore } from '$lib/ciph'
</script>

{#if $isEncryptingStore}
  <p>Encrypting...</p>
{/if}
```

## Error Handling

| Code | HTTP | Meaning | Retry? |
|------|------|---------|--------|
| CIPH001 | 401 | Missing encryption headers | No |
| CIPH002 | 401 | Fingerprint decrypt failed | No |
| CIPH003 | 401 | Fingerprint mismatch (IP/UA changed) | Yes (auto) |
| CIPH004 | 400 | Body decrypt failed | No |
| CIPH005 | 413 | Payload too large | No |
| CIPH006 | 500 | Response encryption failed | No |

## TypeScript

```typescript
import type {
  CiphClient,
  CiphResponse,
  CiphClientConfig,
  CiphSvelteKitConfig,
} from '@ciph/svelte'

import { CiphError, type CiphErrorCode } from '@ciph/svelte'
```

## API Reference

See [API.md](./API.md) for complete API documentation.

## Architecture

See [OVERVIEW.md](./OVERVIEW.md) for architecture details.

## Request/Response Flow

See [FLOW.md](./FLOW.md) for detailed flow diagrams.

## DevTools

See [DEVTOOLS.md](./DEVTOOLS.md) for DevTools setup and usage.

## Fingerprinting

See [FINGERPRINT.md](./FINGERPRINT.md) for fingerprint generation details.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## License

MIT
