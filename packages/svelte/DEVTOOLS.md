# @ciph/svelte — DevTools Setup & Usage

## Installation

DevTools are automatically included in the package. Simply import and use the component.

## Client DevTools (Floating Panel)

### Setup

Add the `CiphDevtoolsPanel` component to your root layout or app shell:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { CiphDevtoolsPanel } from '@ciph/svelte'
</script>

<main>
  <slot />
</main>

<!-- DevTools panel (dev-only, auto-disabled in production) -->
<CiphDevtoolsPanel position="bottom-right" maxLogs={100} />
```

### Configuration

```typescript
interface CiphDevtoolsPanelProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  defaultOpen?: boolean
  maxLogs?: number
  shortcutEnabled?: boolean
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `position` | string | `'bottom-right'` | Panel position on screen |
| `defaultOpen` | boolean | `false` | Show panel automatically on load |
| `maxLogs` | number | `100` | Max logs to keep in circular buffer |
| `shortcutEnabled` | boolean | `true` | Enable Ctrl+Shift+C to toggle |

### Features

#### Log List
- **Method** — HTTP verb (GET, POST, PUT, PATCH, DELETE)
- **Route** — Request path (e.g., `/api/users`)
- **Status** — HTTP response code
- **Time** — Request timestamp in local time
- **Encryption** — 🔒 encrypted, 🔓 plain

Click any log to view details.

#### Details Panel
- **Plain Body** — Original request/response (collapsible)
- **Encrypted Body** — Base64url ciphertext (truncated, with copy button)
- **Error** — If any encryption/decryption error occurred

#### Controls
- **Toggle (▼/▶)** — Expand/collapse panel
- **Clear (🗑️)** — Clear all logs
- **Close (✕)** — Hide panel

#### Keyboard Shortcut
- **Ctrl+Shift+C** — Toggle panel open/closed (configurable via `shortcutEnabled`)

### Production Guard

Automatically disabled in production:
- Component returns `null` when `NODE_ENV === 'production'`
- Tree-shaken by bundler (zero bytes in prod bundle)
- No overhead even with component in code

## Server DevTools (Logging)

### Setup

Enable server devtools in `ciphHooks` config:

```typescript
// src/hooks.server.ts
import { ciphHooks } from '@ciph/svelte'

export const handle = ciphHooks({
  privateKey: process.env.CIPH_PRIVATE_KEY!,
  devtools: {
    enabled: process.env.NODE_ENV === 'development',
    maxLogs: 500,
  },
})
```

### What Gets Logged

Server devtools log:
- HTTP method, route, status code
- Timestamp of request start
- Whether encryption was applied
- Encrypted request/response bodies (truncated)
- Plain request/response bodies (for debugging)
- Error codes if encryption/decryption failed

Example log entry:

```json
{
  "method": "POST",
  "route": "/api/users",
  "status": 200,
  "timestamp": 1700000000000,
  "encrypted": true,
  "encryptedRequestBody": "rH6s8kL9m2p3...",
  "plainRequestBody": { "name": "Alice" },
  "encryptedResponseBody": "sL2m3n4o5p6q...",
  "plainResponseBody": { "id": 1, "name": "Alice" },
  "error": null
}
```

### Storage

- **Buffer:** In-memory, circular buffer
- **Max:** 500 logs (configurable)
- **Lifetime:** Request lifetime (auto-cleared on server restart)
- **Access:** Via emitter events (for future SSE stream integration)

## Advanced Usage

### Custom Logging

Emit custom logs to the devtools panel:

```typescript
import { emitClientLog } from '@ciph/svelte'

emitClientLog({
  method: 'POST',
  route: '/api/custom',
  status: 200,
  timestamp: Date.now(),
  encrypted: true,
  encryptedBody: '...',
  plainBody: { foo: 'bar' },
  plainResponse: { success: true },
  error: null,
})
```

### Subscribing to Logs

Subscribe to log events in your own code:

```typescript
import { ciphClientEmitter } from '@ciph/svelte'

ciphClientEmitter?.on?.('log', (log) => {
  console.log('Request:", log.method, log.route, log.status)
  if (log.error) {
    console.error('Error:', log.error.message)
  }
})
```

### Per-Route Configuration

Skip encryption devtools logging for specific routes:

```typescript
// Requests to /health are not encrypted and not logged
ciphHooks({
  privateKey: process.env.CIPH_PRIVATE_KEY!,
  excludeRoutes: ['/health', '/api/public'],
  devtools: { enabled: true },
})
```

## Debugging

### Common Issues

#### DevTools Panel Not Showing
- Check: `NODE_ENV === 'development'` (not production)
- Check: Component is mounted in your layout
- Check: Browser console for errors

#### No Logs Appearing
- Check: Requests are encrypted (not in `excludeRoutes`)
- Check: Server has `devtools.enabled: true`
- Check: Check browser DevTools Network tab for headers

#### Logs Disappearing
- Check: Log buffer max size exceeded (default: 100)
- Check: Clear button was clicked
- Increase `maxLogs` prop if needed

### Network Inspector

Open browser DevTools to see encrypted requests:

1. **DevTools → Network tab**
2. Filter by request (e.g., `/api/users`)
3. **Request Headers:**
   - `X-Fingerprint: <encrypted>`
   - `X-Client-PublicKey: <public-key>`
   - `Content-Type: text/plain`
4. **Request Body:** Raw ciphertext (unreadable by design)
5. **Response Body:** Raw ciphertext (unreadable by design)

This confirms encryption is working! The Network tab should never show plaintext bodies.

## Performance

### DevTools Overhead

- **Client:** ~1-2ms per request (encryption/emitting - already done for requests)
- **Server:** ~1-2ms per request (same as above)
- **Memory:** ~100KB per 100 logs (circular buffer)
- **Production:** 0 bytes (tree-shaken)

### Optimization Tips

1. Reduce `maxLogs` if memory is tight (e.g., mobile)
2. Disable `shortcutEnabled` if keyboard shortcut conflicts
3. Use `defaultOpen={false}` to prevent panel drawing on load
4. Use `position="top-left"` to avoid overlapping important UI

## Troubleshooting

### Panel Not Draggable
The panel header is draggable by default. Click and drag from the header to move.

### Logs Not Updating in Real-Time
Logs are added synchronously. If not appearing:
1. Check Network tab to confirm requests are being sent
2. Check browser console for errors
3. Verify DevTools are enabled

### High Memory Usage
Reduce `maxLogs`:
```svelte
<CiphDevtoolsPanel maxLogs={50} />
```

### CSS Conflicts
DevTools use namespaced classes (`.ciph-devtools-*`). If styling conflicts:
- Ensure no global CSS resets affect fixed positioning
- Check z-index doesn't conflict (DevTools use `z-index: 999999`)
