# DevTools Integration — @ciph/vue

Documentation for the built-in Ciph DevTools floating panel integrated with Vue.

---

## Overview

`@ciph/vue` includes optional, zero-configuration devtools support. When enabled, a floating panel appears in development mode showing all encrypted requests/responses with full decrypted payloads and metadata.

**Production:** DevTools completely disabled and tree-shaken from bundle (zero bytes added).

---

## Enabling DevTools

### Option 1: Default Settings (Recommended)

```typescript
import { CiphPlugin } from '@ciph/vue'

app.use(CiphPlugin, {
  baseURL: 'https://api.example.com',
  serverPublicKey: 'YOUR_KEY',
  // Simply omit or set true:
  devtools: true,  // or just `devtools: {}`
})
```

**Default behavior (dev mode only):**
- Panel visible on bottom-right
- Starts closed (collapsed)
- Logs last 500 requests
- Keyboard shortcut: `Ctrl+Shift+C` (toggle)

### Option 2: Custom Configuration

```typescript
app.use(CiphPlugin, {
  baseURL: 'https://api.example.com',
  serverPublicKey: 'YOUR_KEY',
  devtools: {
    enabled: true,                    // Show panel (default: true in dev)
    position: 'bottom-right',         // Dock position
    defaultOpen: true,                // Start opened (default: false)
    maxLogs: 250,                     // Buffer size (default: 500)
  },
})
```

### Option 3: Disable DevTools

```typescript
app.use(CiphPlugin, {
  baseURL: 'https://api.example.com',
  serverPublicKey: 'YOUR_KEY',
  devtools: false,  // Completely disabled, no panel
})
```

---

## Position Options

Panel can be docked to any corner or edge:

```typescript
position: 'bottom-right'   // ✅ Bottom-right corner (default)
position: 'bottom-left'    // Bottom-left corner
position: 'top-right'      // Top-right corner
position: 'top-left'       // Top-left corner
position: 'bottom'         // Centered bottom
position: 'top'            // Centered top
position: 'left'           // Centered left
position: 'right'          // Centered right
```

Panel is **draggable** — can be moved anywhere on screen after opening.

---

## UI Layout

### Panel Structure

```
┌──────────────────────────────────────────────────────────┐
│ 🔷 Ciph DevTools                        [:] [×]          │
├──────────────────────────────────────────────────────────┤
│ METHOD   ROUTE              STATUS   TIME                │
├──────────────────────────────────────────────────────────┤
│ POST     /api/login         200      45ms                │ ← Clickable row
│ GET      /api/profile       200      23ms                │
│ POST     /api/action        401→200  78ms   [RETRIED]    │
│ PATCH    /api/update        400      12ms   [ERROR]      │
│ DELETE   /api/resource      204      8ms                 │
│                                                          │
│  ^ Scroll for more logs                                  │
└──────────────────────────────────────────────────────────┘
```

### Columns

| Column | Width | Content |
|--------|-------|---------|
| METHOD | 70px | HTTP verb with color badge |
| ROUTE | Flex | Request URL path (200px minimum) |
| STATUS | 50px | HTTP status code, colored by range |
| TIME | 50px | Duration in milliseconds |

**Status colors:**
- Green (200-299): Success
- Yellow (300-399): Redirect
- Pink (400-499): Client error
- Red (500-599): Server error

---

## Detail Panel (Click a Log)

Click any log row to open detailed view:

```
┌──────────────────────────────────────────────────────────┐
│ POST /api/action                        [← Back]        │
├──────────────────────────────────────────────────────────┤
│ REQUEST                                                  │
│ ─────────────────────────────────────────────────────────│
│ { "username": "alice", "action": "create" }             │
│                                                          │
│ RESPONSE (Decrypted)                                     │
│ ─────────────────────────────────────────────────────────│
│ { "success": true, "id": 12345 }                        │
│                                                          │
│ CIPHERTEXT (Encrypted) [📋 Copy]                        │
│ ─────────────────────────────────────────────────────────│
│ xY9zM8bN7qW6sQ5kE4rT3yV2uO1pI0jH9aG8fL7e...  (truncated)│
│                                                          │
│ METADATA                                                │
│ ─────────────────────────────────────────────────────────│
│ Duration: 45ms                                           │
│ Status: 200 OK                                          │
│ X-Fingerprint: [encrypted-value]                        │
│ Fingerprint Valid: ✓                                    │
│ Retried: No                                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+C` (Windows/Linux) | Toggle panel open/close |
| `Cmd+Shift+C` (Mac) | Toggle panel open/close |
| `Ctrl+Shift+K` | Clear all logs |
| `Escape` | Close detail view (goto list) |

All shortcuts only active in development.

---

## Log Buffer

### Circular Buffer

```
Max logs: 500 (configurable)

When limit reached:
- Oldest log is removed
- New log appended
- Newest logs always visible at top
```

### Clear Logs

Three ways to clear:

1. **UI Button** — Small "clear" icon in bottom-right of panel
2. **Keyboard** — `Ctrl+Shift+K` 
3. **Programmatic** — (See Advanced section below)

---

## Log Entry Structure

Each log captured contains:

```typescript
interface CiphClientLog {
  method: string                    // "POST", "GET", etc.
  route: string                     // "/api/action"
  status: number | null             // 200, 401, null if pending
  duration: number                  // Milliseconds until response
  encryptedBody: string             // base64url ciphertext
  decryptedBody: unknown            // Plain object/value
  headers: Record<string, string>   // Response headers
  fingerprint?: {
    valid: boolean
    reason?: string
  }
}
```

---

## Development vs Production

### Development Build

```typescript
// In vite.config.ts
export default {
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
}

// In your code:
app.use(CiphPlugin, {
  // ...
  devtools: { enabled: true },  // ✅ Panel enabled
})

// Result: DevTools panel VISIBLE
```

### Production Build

```typescript
// In vite.config.ts
export default {
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
}

// In your code (same code as dev):
app.use(CiphPlugin, {
  // ...
  devtools: { enabled: true },  // ← Line remains!
})

// Result: DevTools panel HIDDEN + tree-shaken
// File size reduction: ~0 bytes added
```

**No need to remove or wrap devtools code** — it's automatically excluded during production bundling.

---

## Troubleshooting

### Panel Not Showing

**Check:**
1. Is `NODE_ENV` set to `production`? → Panel never shows (by design)
2. Is `devtools.enabled: false`? → Set to `true` or omit
3. Are you in Vue component? → `useCiph()` must be called inside Vue app
4. Is plugin registered? → `app.use(CiphPlugin, {...})`

### Logs Not Appearing

**Check:**
1. Are requests actually encrypted? → Check Network tab (should see `text/plain` content type)
2. Is `X-Fingerprint` header present? → Yes = correct
3. Is there an error in console? → Check browser console
4. Did you exclude the route? → Check `excludeRoutes` in plugin config

### Performance Issues

If logging many requests (hundreds+):
```typescript
devtools: {
  enabled: true,
  maxLogs: 50,  // Lower buffer size
}
```

---

## Advanced: Programmatic Control

### Subscribe to Logs

```typescript
import { autoInitClientEmitter, emitClientLog } from '@ciph/vue'

// Must call once (plugin does this automatically, but shown here for clarity)
autoInitClientEmitter()

// Subscribe to all logs
window.addEventListener('ciph-client-log', (event: CustomEvent) => {
  const log = event.detail
  console.log(`[${log.method}] ${log.route} → ${log.status}`)
})
```

### Emit Custom Logs

```typescript
import { emitClientLog } from '@ciph/vue'

// Emit a custom log entry (useful for analytics)
emitClientLog({
  method: 'POST',
  route: '/api/custom-event',
  duration: 0,
  status: 200,
  decryptedBody: { event: 'user-interaction', timestamp: Date.now() },
  encryptedBody: 'N/A',
})
```

---

## Network Tab Inspection

When DevTools panel is open, you can still inspect encrypted traffic in browser Network tab:

```
POST /api/login
Status: 200 OK

Request Headers:
  Content-Type: application/json
  X-Fingerprint: xY9zM8bN7qW6sQ5kE4rT...

Request Payload:
  zN4qX8k9mL2pQ5wE7rT6yU3sH8fG1jD0aB2cQ4mW5nE6...

Response:
  xY9zM8bN7qW6sQ5kE4rT3yV2uO1pI0jH9aG8fL7eM6d...
```

**Important:** Network tab shows **encrypted** ciphertext. The Ciph DevTools panel shows **decrypted** plaintext (dev convenience).

---

## Integration with Nuxt

In Nuxt 3+, devtools work automatically within plugin:

```typescript
// plugins/ciph.ts
import { defineNuxtPlugin } from '#app'
import { CiphPlugin } from '@ciph/vue'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(CiphPlugin, {
    baseURL: process.env.NUXT_PUBLIC_API_URL,
    serverPublicKey: process.env.NUXT_PUBLIC_CIPH_KEY,
    devtools: {
      enabled: true,  // Enabled in dev, auto-disabled in prod
      position: 'bottom-right',
    },
  })
})
```

---

## CSS Customization

DevTools panel uses inline styles. To override appearance:

```html
<!-- Add to your app's global CSS -->
<style>
  /* Override panel background */
  [data-ciph-panel] {
    background: #fff !important;
  }

  /* Override log list text */
  [data-ciph-panel] [data-ciph-log-row] {
    font-size: 13px;
    font-family: 'Monaco', monospace;
  }
</style>
```

---

## FAQ

**Q: Will DevTools slow down my app?**
A: Only in development. In production, it's completely removed (tree-shaken).

**Q: Can I see encrypted requests in DevTools?**
A: Yes, the panel shows both encrypted (base64) and decrypted versions.

**Q: Can I use DevTools in production?**
A: No, it's automatically disabled. Attempting to enable it in production has no effect.

**Q: How do I export logs?**
A: Open browser console, copy logs from memory, or implement custom export logic using the event listener approach.

**Q: Does DevTools affect my API responses?**
A: No, it's purely observational. No data is modified or sent anywhere.

**Q: Can I place multiple DevTools panels?**
A: No, only one panel per page. Multiple positions aren't supported.
