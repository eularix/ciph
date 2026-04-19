# Ciph DevTools Logging

Persistent and in-memory logging for the Ciph Inspector backend devtools.

## Overview

The Ciph devtools supports two logging modes:

1. **Temporary (default)** - In-memory circular buffer only, fast, ephemeral
2. **Persistent** - JSONL file on disk + in-memory buffer, for audit trails

Both modes keep logs in a circular buffer (default 500 entries) in memory for the browser inspector UI. The persistent mode **additionally** writes every log to disk.

---

## Mode 1: Temporary (In-Memory Only) — Default

Fastest mode. Logs stored only in `_logs` array, cleared on app restart.

### Setup

```typescript
// packages/hono/src/index.ts
import { autoInitEmitter, initDevtools } from "@ciph/hono"

if (process.env.NODE_ENV !== "production") {
  autoInitEmitter()
  initDevtools() // Uses default: { temporary: true }
}

app.use("/*", ciph({ privateKey: process.env.CIPH_PRIVATE_KEY! }))
app.route("/ciph-devtools", getCiphInspectorApp())
```

### Behavior

- ✅ Logs appear in browser Inspector UI
- ✅ SSE stream broadcasts real-time logs
- ✅ `/ciph-devtools/logs` endpoint returns buffered history
- ❌ Logs **NOT** persisted to disk
- ❌ Logs lost on app restart

### Use Case

Local development, testing, debugging — where persistence isn't needed.

---

## Mode 2: Persistent (Disk + Memory)

Logs written as JSONL + kept in circular buffer.

### Setup

```typescript
import { autoInitEmitter, initDevtools, type CiphDevtoolsConfig } from "@ciph/hono"

if (process.env.NODE_ENV !== "production") {
  autoInitEmitter()
  initDevtools({
    temporary: false,
    logFilePath: ".ciph-logs.jsonl", // Relative to process.cwd()
    maxInMemoryLogs: 500,  // Default, optional
  })
}

app.use("/*", ciph({ privateKey: process.env.CIPH_PRIVATE_KEY! }))
app.route("/ciph-devtools", getCiphInspectorApp())
```

### Behavior

- ✅ Logs appear in browser Inspector UI (same as temporary mode)
- ✅ Logs **also** written to disk as JSONL
- ✅ Each line is a complete JSON object: `{"method":"POST","route":"/api/echo","status":200,...}\n`
- ✅ Logs **survive** app restart (old logs still in file)
- ✅ File grows unbounded (your responsibility to rotate/clean)

### File Format

`.ciph-logs.jsonl` (JSON Lines)

```jsonl
{"method":"POST","route":"/api/echo","status":200,"timestamp":"2026-04-19T10:28:22Z","duration":45,"excluded":false,...}
{"method":"GET","route":"/api/health","status":200,"timestamp":"2026-04-19T10:28:23Z","duration":2,"excluded":true,...}
{"method":"POST","route":"/api/echo","status":500,"timestamp":"2026-04-19T10:28:24Z","duration":150,"excluded":false,...}
```

Read with:

```bash
cat .ciph-logs.jsonl | jq .

# Or filter by route:
cat .ciph-logs.jsonl | jq 'select(.route=="/api/echo")'

# Or by status code:
cat .ciph-logs.jsonl | jq 'select(.status>=400)'
```

### Use Cases

- **Staging/Production Debugging** (dev-only, not prod)
- **Audit Trails** — Keep encrypted request history
- **Performance Analysis** — Replay logs, measure patterns
- **Compliance** — Document all API interactions
- **CI/CD Logging** — Capture test request logs

---

## Configuration API

```typescript
export interface CiphDevtoolsConfig {
  /**
   * If true (default), keep logs only in memory (_logs array).
   * If false, persist logs to disk as JSONL.
   */
  temporary?: boolean

  /**
   * Path to log file (JSONL format).
   * Only used if temporary === false.
   * Default: ".ciph-logs.jsonl"
   * Relative to process.cwd()
   */
  logFilePath?: string

  /**
   * Max in-memory circular buffer size.
   * Default: 500
   * Older logs are dropped from memory once this limit is reached.
   */
  maxInMemoryLogs?: number
}
```

---

## Inspector UI Integration

Both modes work identically in the browser:

### GET `/ciph-devtools`

Serves Inspector HTML with:
- Real-time log list
- Encrypted/decrypted body inspector
- Fingerprint details
- Status color coding

### GET `/ciph-devtools/stream`

Server-Sent Events (SSE) stream. Browser connects and receives logs in real-time:

```
data: {"method":"POST","route":"/api/echo",..."status":200}\n\n
data: {"method":"GET","route":"/api/health","status":200}\n\n
```

### GET `/ciph-devtools/logs`

Returns all buffered logs (up to `maxInMemoryLogs`):

```json
{ "logs": [...], "total": 42 }
```

### DELETE `/ciph-devtools/logs`

Clears both in-memory buffer **and** disk file (if persistent mode).

---

## Examples

### Example 1: Dev Server (Temporary)

```typescript
// example/hono/src/index.ts
import { Hono } from "hono"
import { ciph, getCiphInspectorApp, autoInitEmitter, initDevtools } from "@ciph/hono"

const app = new Hono()

// Initialize devtools in dev
if (process.env.NODE_ENV !== "production") {
  autoInitEmitter()
  initDevtools() // Temporary mode (default)
  console.log("✅ Ciph Inspector ready (temporary mode)")
  console.log("   Open http://localhost:4008/ciph-devtools")
}

app.use("/*", ciph({ privateKey: process.env.CIPH_PRIVATE_KEY! }))
app.route("/ciph-devtools", getCiphInspectorApp())

app.post("/api/echo", (c) => {
  return c.json({ message: "echo" })
})

export default app
```

Start server:

```bash
cd example/hono
bun dev
# ✅ Ciph Inspector ready (temporary mode)
#    Open http://localhost:4008/ciph-devtools
```

Open http://localhost:4008/ciph-devtools and make requests. Logs appear in real-time.

---

### Example 2: Test Suite (Persistent)

```typescript
// test/ciph-inspector.test.ts
import { Hono } from "hono"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { ciph, getCiphInspectorApp, autoInitEmitter, initDevtools } from "@ciph/hono"
import fs from "fs"

describe("Ciph Inspector with Persistent Logging", () => {
  let app: Hono
  const logFile = ".ciph-test-logs.jsonl"

  beforeAll(() => {
    app = new Hono()

    autoInitEmitter()
    initDevtools({
      temporary: false,
      logFilePath: logFile,
      maxInMemoryLogs: 100,
    })

    app.use("/*", ciph({ privateKey: process.env.CIPH_PRIVATE_KEY! }))
    app.route("/ciph-devtools", getCiphInspectorApp())

    app.post("/api/echo", async (c) => {
      const body = await c.req.json()
      return c.json({ echo: body })
    })

    // Cleanup before test
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile)
  })

  afterAll(() => {
    // Verify log file was created
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, "utf-8")
      const lines = content.trim().split("\n").filter((l) => l.length > 0)
      console.log(`📋 Test logged ${lines.length} entries to ${logFile}`)
      // Analyze logs
      const errors = lines.filter((l) => {
        const log = JSON.parse(l)
        return log.status >= 400
      })
      if (errors.length > 0) {
        console.log(`⚠️  Found ${errors.length} error logs`)
      }
    }
  })

  it("should log encrypted requests", async () => {
    const res = await app.request(
      new Request("http://localhost/api/echo", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "...", // encrypted body
      })
    )

    expect(res.status).toBe(200)

    // Verify log file has entry
    const lines = fs
      .readFileSync(logFile, "utf-8")
      .trim()
      .split("\n")
      .filter((l) => l.length > 0)

    expect(lines.length).toBeGreaterThan(0)

    const lastLog = JSON.parse(lines[lines.length - 1])
    expect(lastLog.route).toBe("/api/echo")
    expect(lastLog.method).toBe("POST")
  })

  it("should include error logs in file", async () => {
    // Make request to non-existent route
    await app.request(new Request("http://localhost/api/notfound"))

    // Check logs for 404
    const lines = fs
      .readFileSync(logFile, "utf-8")
      .trim()
      .split("\n")
      .filter((l) => l.length > 0)

    const has404 = lines.some((l) => {
      const log = JSON.parse(l)
      return log.status === 404
    })

    expect(has404).toBe(true)
  })
})
```

Run tests:

```bash
bun test

# Output:
# ✓ test/ciph-inspector.test.ts (2)
#   ✓ Ciph Inspector with Persistent Logging (2)
#     ✓ should log encrypted requests
#     ✓ should include error logs in file
#
# 📋 Test logged 5 entries to .ciph-test-logs.jsonl
# ⚠️  Found 2 error logs
```

Inspect logs:

```bash
cat .ciph-test-logs.jsonl | jq .

# {
#   "method": "POST",
#   "route": "/api/echo",
#   "status": 200,
#   "timestamp": "2026-04-19T10:30:45.123Z",
#   "duration": 25,
#   ...
# }
```

---

### Example 3: Production-Safe Setup

```typescript
// In your Hono app startup
import { autoInitEmitter, initDevtools } from "@ciph/hono"

// Production guard: only initialize in development or explicit opt-in
const enableDevtools = process.env.CIPH_DEVTOOLS === "true" && process.env.NODE_ENV !== "production"

if (enableDevtools) {
  autoInitEmitter()

  const isPersistent = process.env.CIPH_DEVTOOLS_PERSISTENT === "true"

  if (isPersistent) {
    console.log("🔒 Ciph DevTools running in PERSISTENT mode")
    console.log(`📝 Logging to: ${process.env.CIPH_DEVTOOLS_LOG_PATH || ".ciph-logs.jsonl"}`)
    initDevtools({
      temporary: false,
      logFilePath: process.env.CIPH_DEVTOOLS_LOG_PATH || ".ciph-logs.jsonl",
      maxInMemoryLogs: parseInt(process.env.CIPH_DEVTOOLS_MAX_LOGS || "500"),
    })
  } else {
    console.log("⚡ Ciph DevTools running in TEMPORARY (in-memory) mode")
    initDevtools({ temporary: true })
  }
}

// Only expose devtools UI if enabled
if (enableDevtools) {
  app.route("/ciph-devtools", getCiphInspectorApp())
}
```

Environment variables:

```bash
# dev/.env.local
CIPH_DEVTOOLS=true
CIPH_DEVTOOLS_PERSISTENT=true
CIPH_DEVTOOLS_LOG_PATH=./logs/ciph-requests.jsonl
CIPH_DEVTOOLS_MAX_LOGS=1000
```

---

## Storage Considerations

### Temporary Mode

- **Memory**: 500 logs × ~2KB per log ≈ 1MB (configurable)
- **Lifetime**: App restart = data lost
- **I/O**: Zero disk writes

### Persistent Mode

- **Memory**: Same as temporary mode (~1MB)
- **Disk**: Growing JSONL file (your responsibility to manage)
- **I/O**: One write per request (async, non-blocking)
- **Rotation**: Not included (use external log rotation tool like `logrotate`)

### Log Rotation Example

```bash
# Use logrotate to rotate .ciph-logs.jsonl daily
# /etc/logrotate.d/ciph

/path/to/.ciph-logs.jsonl {
  daily
  rotate 7
  compress
  delaycompress
  missingok
  notifempty
  create 0640 user user
}
```

Or manually:

```bash
# Archive old logs before cleanup
mv .ciph-logs.jsonl .ciph-logs-$(date +%Y%m%d-%H%M%S).jsonl
# Devtools will create new file on next request
```

---

## Performance Notes

- **Temporary mode**: ✅ Zero overhead (logs are just array operations)
- **Persistent mode**: 
  - Async I/O (non-blocking)
  - Single `appendFileSync()` per request
  - ~1-5ms per write (depends on disk/buffer)
  - No impact on request handler (fire-and-forget)

---

## Troubleshooting

### Logs not appearing in browser?

1. Ensure devtools initialized before middleware:
   ```typescript
   autoInitEmitter()
   initDevtools()
   app.use("/*", ciph(...))  // After init
   ```

2. Check `/ciph-devtools` is mounted:
   ```typescript
   app.route("/ciph-devtools", getCiphInspectorApp())
   ```

3. Use browser DevTools Console → check for errors

### Log file not created?

- Ensure `temporary: false` is set
- Check file path is writable: `touch .ciph-logs.jsonl`
- Permission denied? Run with `chmod 755` on parent directory

### Log file growing too large?

- Implement rotation (see above)
- Reduce `maxInMemoryLogs` (only affects memory, not disk)
- Use `DELETE /ciph-devtools/logs` to clear file

---

## API Reference

### `initDevtools(config?: CiphDevtoolsConfig)`

Initialize devtools with optional configuration.

```typescript
initDevtools()  // Defaults: temporary=true, maxInMemoryLogs=500

initDevtools({
  temporary: false,
  logFilePath: "logs/requests.jsonl",
  maxInMemoryLogs: 1000,
})
```

Returns: `void`

Throws: Nothing (errors silently caught)

---

## Migration

### From None → Temporary

No change needed. Default setup enables temporary logging.

### From Temporary → Persistent

```typescript
// Before
initDevtools()

// After
initDevtools({ temporary: false })
```

Logs will be written to `.ciph-logs.jsonl` automatically.

---

## Future Enhancements

- [ ] Structured log query API (`/ciph-devtools/query?status=500&limit=10`)
- [ ] Log export (CSV, JSON, etc.)
- [ ] Built-in log rotation
- [ ] Metrics dashboard (request count, avg duration, error rate)
- [ ] Local SQLite storage option
