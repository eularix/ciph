# @ciph/devtools-server

Backend inspector UI for Ciph encryption debugging. Serves vanilla HTML dashboard + SSE log stream at `/ciph`.

## Features

- **Browser dashboard** — Vanilla HTML/CSS/JS (no framework)
- **Live log stream** — SSE auto-refresh
- **Request/response details** — Decrypted bodies, headers, timing
- **Per-package buffer** — Circular 500-log buffer per instance
- **Production safe** — Three-layer runtime guard
- **Zero dependencies** — No npm packages

## Install

```bash
npm install @ciph/devtools-server @ciph/hono
# or
pnpm add @ciph/devtools-server @ciph/hono
```

## Quick Start

```typescript
import { Hono } from 'hono'
import { ciph } from '@ciph/hono'
import { ciphDevServer } from '@ciph/devtools-server'

const app = new Hono()

// Encryption middleware
app.use('*', ciph({ secret: process.env.CIPH_SECRET! }))

// DevTools inspector (at /ciph)
app.route('/ciph', ciphDevServer({ secret: process.env.CIPH_SECRET! }))

export default app
```

Visit `http://localhost:3000/ciph` in browser.

## Configuration

```typescript
interface CiphDevServerConfig {
  // Shared secret (must match middleware)
  secret: string

  // Custom paths (optional)
  publicKeyPath?: string        // default: '/public-key'
}
```

## Endpoints

| Method | Path | Response | Purpose |
|--------|------|----------|---------|
| GET | `/ciph` | HTML | Inspector UI dashboard |
| GET | `/ciph/stream` | SSE | Live log stream |
| GET | `/ciph/logs` | JSON | All buffered logs |
| DELETE | `/ciph/logs` | 204 | Clear log buffer |
| GET | `/ciph/health` | JSON | `{ status: "ok" }` |
| GET | `/ciph/public-key` | JSON | ECDH public key |

## UI Dashboard

Accessible at `http://localhost:3000/ciph`.

### Features
- **Request list** — All intercepted requests (newest first)
  - METHOD, PATH, STATUS, TIME, SIZE
- **Click to expand** — See full request/response details
  - Plaintext body (formatted JSON if applicable)
  - Encrypted body (ciphertext preview)
  - Request headers
  - Response headers
  - Fingerprint info
  - Duration
- **Filtering** (future) — Filter by method, path, status
- **Clear logs** — Delete all buffered logs

### Auto-refresh
Dashboard receives live updates via SSE. Logs appear instantly as requests are processed.

---

## Log Stream (SSE)

Live Server-Sent Events stream at `/ciph/stream`.

**Format:**
```
event: ciph-log
data: {"method":"POST","path":"/api/users","status":200,...}

event: keepalive
data: {"type":"keepalive"}

event: ciph-log
data: {"method":"GET","path":"/api/data",...}
```

**Connection:**
- Max 10 concurrent connections
- Auto-reconnect on disconnect
- Keepalive comment every 30 seconds

---

## Buffer Management

- **Type:** Circular in-memory buffer
- **Size:** 500 logs default
- **Overflow:** Oldest logs dropped when buffer full
- **Lifetime:** Process lifetime (cleared on restart)
- **Endpoint:** `GET /ciph/logs` (read), `DELETE /ciph/logs` (clear)

---

## Usage Examples

### Basic setup

```typescript
import { Hono } from 'hono'
import { ciph } from '@ciph/hono'
import { ciphDevServer } from '@ciph/devtools-server'

const app = new Hono()

app.use('*', ciph({ secret: process.env.CIPH_SECRET! }))
app.route('/ciph', ciphDevServer({ secret: process.env.CIPH_SECRET! }))

export default app
```

### With custom paths

```typescript
app.route('/debug/ciph', ciphDevServer({
  secret: process.env.CIPH_SECRET!,
  publicKeyPath: '/debug/ciph/key',
}))

// Dashboard at /debug/ciph
// Logs at /debug/ciph/logs
// Stream at /debug/ciph/stream
```

### Conditional registration (dev only)

```typescript
const app = new Hono()

app.use('*', ciph({ secret: process.env.CIPH_SECRET! }))

// Dev only
if (process.env.NODE_ENV === 'development') {
  app.route('/ciph', ciphDevServer({ secret: process.env.CIPH_SECRET! }))
}

export default app
```

### With logging

```typescript
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`)
})

app.use('*', ciph({ secret: process.env.CIPH_SECRET! }))
app.route('/ciph', ciphDevServer({ secret: process.env.CIPH_SECRET! }))
```

---

## Log Data Structure

```typescript
interface CiphServerLog {
  method: string                 // "GET", "POST", etc.
  path: string                   // "/api/users"
  status: number                 // 200, 400, 500
  statusText: string             // "OK", "Bad Request"
  
  // Request
  requestBody?: string           // Decrypted plaintext
  requestEncrypted?: string      // Before decryption (base64url)
  
  // Response
  responseBody?: string          // Before encryption
  responseEncrypted?: string     // Encrypted (base64url)
  
  // Metadata
  headers?: Record<string, string>
  fingerprint?: string           // Device fingerprint
  
  timestamp: number              // When request received
  duration?: number              // ms to complete
  
  // Errors
  error?: {
    code: string                 // "CIPH003", etc.
    message: string
    details?: string
  }
}
```

---

## Security

**Three-layer production guard:**

1. **Runtime check** — `@ciph/hono` doesn't emit logs in production
   ```typescript
   if (process.env.NODE_ENV === 'production') {
     // Logs not emitted
   }
   ```

2. **Buffer never initialized** — Buffer creation skipped in production

3. **Routes return 404** — All `/ciph/*` routes return 404 in production
   ```typescript
   if (process.env.NODE_ENV === 'production') {
     return c.json({ error: 'Not found' }, 404)
   }
   ```

**Result:** No logs, no endpoints, no response body leakage in production.

---

## Performance

- **Log buffering** — ~0.1ms per request
- **SSE streaming** — Negligible overhead
- **Dashboard rendering** — Vanilla JS, ~1-2ms per update
- **Memory usage** — ~1-2KB per log (500 logs = ~1MB)

---

## Accessing Logs Programmatically

### Get all buffered logs

```bash
curl http://localhost:3000/ciph/logs

# Response:
# [
#   {"method":"POST","path":"/api/users","status":200,...},
#   {"method":"GET","path":"/api/data","status":200,...}
# ]
```

### Clear logs

```bash
curl -X DELETE http://localhost:3000/ciph/logs
# Returns 204 No Content
```

### Stream logs (cURL)

```bash
curl -N http://localhost:3000/ciph/stream
# Continuously prints logs as they arrive
```

### Stream logs (Node.js)

```typescript
const response = await fetch('http://localhost:3000/ciph/stream')
const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(decoder.decode(value))
}
```

---

## Troubleshooting

### Dashboard not loading
**Check:**
1. Route registered: `app.route('/ciph', ciphDevServer(...))`?
2. Server running on expected port?
3. Correct URL: `http://localhost:3000/ciph`?

### Logs not showing
**Check:**
1. Requests actually encrypted (content-type: text/plain)?
2. Encryption middleware running before devtools route?
3. `NODE_ENV` not set to "production"?

### Stream connection failing
**Check:**
1. Browser supports SSE?
2. Proxy/CDN not blocking SSE?
3. Max 10 connections reached? (try new tab)

### Logs disappearing after restart
**Expected behavior.** Buffer is in-memory, cleared on process restart.

Solution: Use persistent logging with external service.

---

## Customization

### Custom styling
Edit `/ciph` response to add CSS:
```typescript
const dashboard = ciphDevServer({ secret: '...' })
// (CSS inline in HTML response)
```

### Custom buffer size
Currently hardcoded to 500. To change:
1. Fork package
2. Edit buffer size in source
3. Use forked version

---

## Integration with External Logging

Stream logs to external service:

```typescript
import { ciphServerEmitter } from '@ciph/core'

// Log to external service
ciphServerEmitter.on('log', (log) => {
  // Send to Datadog, Sentry, etc.
  externalLogger.log({
    path: log.path,
    status: log.status,
    duration: log.duration,
    error: log.error?.code,
  })
})

// Still serve devtools UI
app.route('/ciph', ciphDevServer({ secret: process.env.CIPH_SECRET! }))
```

---

## API Reference

### `ciphDevServer(config: CiphDevServerConfig): HonoRequest`

Returns Hono app for encryption logs.

**Params:**
```typescript
{
  secret: string                           // Required, unused (for future)
  publicKeyPath?: string                   // default: '/public-key'
}
```

**Returns:** Hono app (use with `app.route()`)

```typescript
app.route('/ciph', ciphDevServer({ secret: process.env.CIPH_SECRET! }))
```

---

## License

MIT
