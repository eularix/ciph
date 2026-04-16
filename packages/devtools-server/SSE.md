# SSE — @ciph/devtools-server

## Overview

The `/ciph/stream` endpoint uses **Server-Sent Events (SSE)** to push new log entries to the inspector UI in real time. SSE was chosen over WebSocket because:
- Unidirectional (server → client only) is sufficient for log streaming
- Native browser support, no extra library needed
- Works through HTTP/1.1 proxies and load balancers
- Simpler implementation than WebSocket

## Event Format

Each log entry is pushed as a named SSE event:

```
event: ciph-log
data: <JSON string of CiphServerLog>
\n
```

Example:

```
event: ciph-log
data: {"id":"a1b2c3","method":"POST","route":"/employees","status":201,"duration":34,"timestamp":"2026-04-16T13:01:12.443Z","request":{"plainBody":{"name":"Dimas"},"encryptedBody":"aB3k...","ip":"127.0.0.1","userAgent":"Mozilla/5.0"},"response":{"plainBody":{"data":{"id":"abc-123"}},"encryptedBody":"cD7n..."},"fingerprint":{"value":"a3f8b2...","ipMatch":true,"uaMatch":true},"excluded":false,"error":null}

```

## Keepalive

To prevent proxies and browsers from timing out idle connections, a keepalive comment is sent every 30 seconds:

```
: keepalive

```

(A line starting with `:` is a comment in SSE — browsers ignore it but it keeps the connection alive.)

## Connection Lifecycle

```
Browser opens /ciph/stream
    │
    ▼
Server registers listener on ciphServerEmitter
    │
    ▼
New log arrives → server writes SSE event to response stream
    │
    ▼
Browser receives event → UI updates
    │
    ▼
Browser closes tab / navigates away
    │
    ▼
"close" event fires on Hono request → server removes listener
Buffer and emitter are not affected — other connections continue
```

## Concurrent Connections

Multiple browser tabs can connect to `/ciph/stream` simultaneously. Each connection gets its own independent SSE stream. All receive the same events (fan-out pattern via emitter).

```ts
// Conceptual — each connection adds its own listener
const listeners = new Set<(log: CiphServerLog) => void>()

ciphServerEmitter.on("log", (log) => {
  for (const send of listeners) {
    send(log) // push to each active SSE connection
  }
})
```

## Max Concurrent Connections

Default: **10 concurrent SSE connections**. Beyond this limit, new connections receive a `503 Service Unavailable` response with body:

```json
{ "message": "Too many devtools connections" }
```

This is a safety limit — in practice, a developer machine should never have more than a handful of connections.

## Reconnect Behavior (Client-side)

The inspector UI handles reconnection automatically:

```js
// Inside the vanilla JS of the inspector UI
function connectSSE() {
  const es = new EventSource("/ciph/stream")

  es.addEventListener("ciph-log", (e) => {
    const log = JSON.parse(e.data)
    prependLog(log) // add to UI
  })

  es.onerror = () => {
    // Show 🔴 Offline indicator
    // Retry after 3s, backing off to max 30s
    scheduleReconnect()
  }
}
```
