# @ciph/hono

Hono middleware for transparent HTTP request/response encryption. Handles decryption of incoming bodies and encryption of outgoing responses.

## Features

- **Zero setup** — Single middleware, handles everything
- **Transparent** — No changes to handlers
- **Per-request keys** — Derived from client fingerprint
- **ECDH key exchange** — P-256 asymmetric negotiation
- **Per-package routes** — Exclude routes per middleware instance
- **DevTools support** — SSE streaming logs to inspector UI
- **TypeScript** — Fully typed

## Install

```bash
npm install @ciph/hono axios @ciph/core
# or
pnpm add @ciph/hono axios @ciph/core
```

## Quick Start

```typescript
import { Hono } from 'hono'
import { ciph, ciphExclude } from '@ciph/hono'
import { ciphDevServer } from '@ciph/devtools-server'

const app = new Hono()

// 1. Add Ciph middleware (handles encryption/decryption)
app.use('*', ciph({ secret: process.env.CIPH_SECRET! }))

// 2. Use it in handlers (transparent)
app.post('/api/users', async (c) => {
  const body = await c.req.json() // Already decrypted
  return c.json({ id: 1, ...body })
})

// 3. (Optional) DevTools inspector UI
app.route('/ciph', ciphDevServer({ secret: process.env.CIPH_SECRET! }))

export default app
```

## Environment Variables

```bash
# .env
CIPH_SECRET=your-secret-min-32-chars-long-here-xxxxx
```

**Requirements:**
- Must match frontend `VITE_CIPH_SECRET`
- Minimum 32 characters
- Store in Secret Manager (never in git)

## Configuration

```typescript
interface CiphConfig {
  // Shared secret (min 32 chars)
  secret: string

  // Routes to skip encryption
  // Default: ["/health", "/ciph", "/ciph/*"]
  excludeRoutes?: string[]

  // Validate fingerprint IP/UA match
  // Set false behind load balancers/proxies that modify IP
  // Default: true
  strictFingerprint?: boolean

  // Max payload size (bytes)
  // Default: 10MB (10485760)
  maxPayloadSize?: number

  // Allow unencrypted requests temporarily (migration)
  // Default: false. NEVER use in production.
  allowUnencrypted?: boolean
}
```

## Request Flow (Phase 1)

When encrypted request arrives:

```
1. Check excludeRoutes → skip if match
2. Read X-Fingerprint-Encrypted header (CIPH001 if missing)
3. Decrypt fingerprint (CIPH002 if fails)
4. Validate IP + UA vs request (CIPH003 if mismatch)
5. Check payload size (CIPH005 if too large)
6. Decrypt body (CIPH004 if fails)
7. Inject decrypted body into context
8. Call next handler
```

## Response Flow (Phase 2)

After handler returns:

```
1. Intercept response body
2. Encrypt with same derived key
3. Send as text/plain (CIPH006 if fails)
4. Emit CiphServerLog (dev only)
```

---

## Error Codes

| Code | HTTP | Meaning | Recoverable |
|------|------|---------|------------|
| CIPH001 | 401 | Missing X-Fingerprint-Encrypted | No — client bug |
| CIPH002 | 401 | Fingerprint decrypt failed (wrong secret) | No — config error |
| CIPH003 | 401 | IP/UA mismatch (network changed) | Yes — client retries |
| CIPH004 | 400 | Body decrypt failed (corrupted/tampered) | No — data invalid |
| CIPH005 | 413 | Payload exceeds maxPayloadSize | No — split request |
| CIPH006 | 500 | Response encrypt failed | No — server error |

**Error response:**
```json
{
  "code": "CIPH003",
  "message": "Fingerprint mismatch: IP address changed"
}
```

---

## API Reference

### `ciph(config: CiphConfig): MiddlewareHandler`

Creates encryption/decryption middleware.

**Params:**
```typescript
{
  secret: string                      // Required
  excludeRoutes?: string[]
  strictFingerprint?: boolean
  maxPayloadSize?: number
  allowUnencrypted?: boolean
}
```

**Returns:** Hono middleware

```typescript
app.use('*', ciph({ secret: process.env.CIPH_SECRET! }))
```

---

### `ciphExclude(routes: string[]): MiddlewareHandler`

Per-route encryption exclusion.

**Usage:**
```typescript
// Don't encrypt this route
app.get('/health', ciphExclude(['/health']), (c) => {
  return c.json({ status: 'ok' })
})
```

---

### `ciphDevServer(config: { secret: string }): HonoRequest`

DevTools inspector UI endpoint. Serves HTML + SSE stream.

**Endpoints:**
| Path | Method | Response |
|------|--------|----------|
| `/ciph` | GET | Inspector UI (HTML) |
| `/ciph/stream` | GET | SSE log stream |
| `/ciph/logs` | GET | All buffered logs (JSON) |
| `/ciph/logs` | DELETE | Clear buffer |
| `/ciph/health` | GET | `{ status: "ok" }` |

**Setup:**
```typescript
// Always after ciph middleware
app.use('*', ciph({ secret: process.env.CIPH_SECRET! }))
app.route('/ciph', ciphDevServer({ secret: process.env.CIPH_SECRET! }))
```

---

## Usage Examples

### Basic setup

```typescript
import { Hono } from 'hono'
import { ciph } from '@ciph/hono'

const app = new Hono()

app.use('*', ciph({ secret: process.env.CIPH_SECRET! }))

app.get('/api/data', (c) => {
  return c.json({ message: 'hello' })
})

export default app
```

### With excluded routes

```typescript
app.use('*', ciph({
  secret: process.env.CIPH_SECRET!,
  excludeRoutes: [
    '/health',           // Health checks
    '/auth/login',       // Auth endpoints
    '/public/*',         // Public routes
    '/ciph',             // DevTools
  ],
}))

// GET /health → plain (no encryption)
// POST /auth/login → plain
// GET /api/data → encrypted
```

### Strict fingerprint disabled (behind proxy)

```typescript
// If behind Cloudflare, load balancer, or NAT that modifies IPs
app.use('*', ciph({
  secret: process.env.CIPH_SECRET!,
  strictFingerprint: false,  // Skip IP/UA validation
}))
```

### Custom payload size limit

```typescript
app.use('*', ciph({
  secret: process.env.CIPH_SECRET!,
  maxPayloadSize: 50 * 1024 * 1024,  // 50MB instead of 10MB
}))
```

### DevTools integration

```typescript
import { ciphDevServer } from '@ciph/devtools-server'

const app = new Hono()

app.use('*', ciph({ secret: process.env.CIPH_SECRET! }))

// DevTools inspector at /ciph
app.route('/ciph', ciphDevServer({ secret: process.env.CIPH_SECRET! }))

// Visit http://localhost:3000/ciph in browser
```

### Error handling

```typescript
app.use('*', async (c, next) => {
  try {
    await next()
  } catch (err) {
    if (err instanceof CiphError) {
      return c.json(
        {
          code: err.code,
          message: err.message,
        },
        { status: err.statusCode }
      )
    }
    throw err
  }
})

app.use('*', ciph({ secret: process.env.CIPH_SECRET! }))
```

### Handler accessing encrypted data

```typescript
app.post('/api/users', (c) => {
  // Body is already decrypted by middleware
  const body = await c.req.json()

  // Fingerprint info available in context
  const fingerprint = c.get('ciphFingerprint') // From X-Fingerprint-Encrypted header

  return c.json({
    id: Math.random(),
    ...body,
    fingerprint,
  })
})
```

---

## DevTools Inspector

Accessible at `http://localhost:3000/ciph` (if endpoint configured).

**Features:**
- Log list (METHOD, ROUTE, STATUS, TIME, ENCRYPTED/PLAIN)
- Click log → detail panel
- View decrypted request body
- View encrypted body (truncated, copy button)
- Headers, fingerprint info
- Circular buffer (default 500 logs)
- SSE auto-refresh

**Production:** Disabled. All logs and routes return 404.

---

## Security Notes

- **Secret min length:** 32 characters (enforced)
- **Fingerprint validation:** IP + User-Agent checked by default
  - Disable if behind proxy/NAT that modifies IPs
  - Validate in application code instead if needed
- **Payload size:** Default 10MB limit (configurable)
- **Stack traces:** Never leaked to client (only error codes)
- **DevTools:** Only enabled in development (verified at runtime)

---

## Performance

- **Fingerprint decryption** — ~0.5ms
- **Body decryption** — ~1-2ms per 1KB
- **Body encryption** — ~1-2ms per 1KB
- **Total per-request** — ~2-5ms (hardware-dependent)

No external API calls. All crypto local.

---

## Troubleshooting

### "CIPH002: Fingerprint decrypt failed"
**Cause:** Wrong CIPH_SECRET on server vs client
**Fix:**
```bash
# Check env var
echo $CIPH_SECRET
# Must match frontend VITE_CIPH_SECRET
```

### "CIPH003: Fingerprint mismatch"
**Cause:** Client IP/UA changed (network switch)
**Fix:** Client auto-retries. If behind proxy, set `strictFingerprint: false`

### "CIPH005: Payload exceeds maxPayloadSize"
**Cause:** Request body too large
**Fix:** Increase `maxPayloadSize` or split request

### DevTools shows nothing
**Check:**
1. Using `ciphDevServer` middleware?
2. Routes not in `excludeRoutes`?
3. Open http://localhost:3000/ciph?

### Body not decrypted in handler
**Check:**
1. Route not in `excludeRoutes`?
2. Request actually encrypted (Content-Type: text/plain)?
3. No `allowUnencrypted: true` interfering?

---

## Public Key Endpoint

Frontend needs server's ECDH public key for key exchange.

```typescript
app.get('/ciph/public-key', (c) => {
  return c.json({
    publicKey: process.env.CIPH_PUBLIC_KEY!, // Base64url P-256 point
    algorithm: 'ECDH-P256',
  })
})
```

Or use `ciphDevServer` — includes public key at `/ciph/public-key`.

---

## Migration from Plain HTTP

To add encryption to existing API:

```typescript
// Step 1: Add middleware
app.use('*', ciph({
  secret: process.env.CIPH_SECRET!,
  allowUnencrypted: true,  // Allow both plain and encrypted
}))

// Step 2: Gradually roll out clients
// Clients that send encrypted requests → decrypted automatically
// Clients that send plain requests → still work (allowUnencrypted: true)

// Step 3: Monitor, then disable allowUnencrypted
// app.use('*', ciph({ secret: process.env.CIPH_SECRET! }))
```

---

## License

MIT
