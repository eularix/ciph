# API Reference — @ciph/devtools-server

## `ciphDevServer(config)`

Returns a Hono app that can be mounted at any path via `app.route()`.

### Setup

```ts
import { Hono } from "hono"
import { ciph } from "@ciph/hono"
import { ciphDevServer } from "@ciph/devtools-server"

const app = new Hono()

// 1. Mount Ciph encryption middleware first
app.use("*", ciph({ secret: process.env.CIPH_SECRET! }))

// 2. Mount devtools inspector (always after ciph middleware)
app.route("/ciph", ciphDevServer({
  secret: process.env.CIPH_SECRET!,
}))

// 3. Your routes — all protected by Ciph
app.get("/employees", async (c) => { ... })
```

Open `http://localhost:3000/ciph` in the browser to access the inspector UI.

---

### Config Options

```ts
interface CiphDevServerConfig {
  /**
   * Shared secret. Used to verify the request comes from a Ciph client.
   * Must match the secret in @ciph/hono config.
   */
  secret: string

  /**
   * Maximum number of log entries held in memory.
   * Oldest entries are dropped when limit is reached (circular buffer).
   * Default: 500
   */
  maxLogs?: number

  /**
   * Optional password to protect the inspector UI.
   * If set, browser will prompt for password before showing the UI.
   * Uses HTTP Basic Auth.
   * Default: undefined (no password)
   */
  password?: string

  /**
   * If true, the inspector UI is disabled even in development.
   * Useful for CI environments where the server starts but devtools are not needed.
   * Default: false
   */
  disabled?: boolean
}
```

---

## Endpoints

All endpoints are mounted relative to where `ciphDevServer` is routed (default: `/ciph`).

| Method | Path            | Description                                      |
|--------|-----------------|--------------------------------------------------|
| `GET`  | `/ciph`         | Serves the inspector UI (vanilla HTML)           |
| `GET`  | `/ciph/stream`  | SSE endpoint — streams live `CiphServerLog` events |
| `GET`  | `/ciph/logs`    | Returns all buffered logs as JSON array          |
| `DELETE` | `/ciph/logs`  | Clears all buffered logs                         |
| `GET`  | `/ciph/health`  | Returns `{ status: "ok" }` — for uptime checks   |

### `GET /ciph/stream` — SSE Format

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: ciph-log
data: {"id":"abc123","method":"POST","route":"/employees",...}

event: ciph-log
data: {"id":"def456","method":"GET","route":"/materials-list",...}

: keepalive

event: ciph-log
data: {...}
```

- Event name: always `ciph-log`
- Data: `JSON.stringify(CiphServerLog)`
- Keepalive ping sent every **30 seconds** as a comment (`: keepalive`)
- On client disconnect, the SSE connection is cleaned up immediately

### `GET /ciph/logs` — Response Shape

```ts
{
  logs: CiphServerLog[],  // newest first
  total: number,          // total logs in buffer
  maxLogs: number,        // configured buffer limit
}
```

---

## Production Guard

When `NODE_ENV=production`, **all `/ciph` routes return 404** immediately:

```ts
// Internal guard inside ciphDevServer
app.use("*", (c, next) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ message: "Not Found" }, 404)
  }
  return next()
})
```

Additionally, `@ciph/hono` stops emitting `ciphServerEmitter` events in production, so there is nothing to capture even if the route somehow remained accessible.
