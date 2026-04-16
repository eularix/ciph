# @ciph/devtools-server — Overview

> A built-in backend request inspector for Ciph — mounted at `/ciph`, works like a self-hosted ngrok inspect panel.

## Purpose

When Ciph is active, all request and response bodies on the network are ciphertext. `@ciph/devtools-server` gives developers a dedicated browser UI at `http://localhost:3000/ciph` to inspect every decrypted request/response that passes through the Hono server — in real time via SSE.

This is especially useful when:
- Debugging from a mobile device (no DevTools available)
- Working with a teammate who needs to inspect API traffic
- The floating client panel (`@ciph/devtools-client`) is not available (e.g., non-React frontend)

## How It Works

```
@ciph/hono middleware
    │
    │  ciphServerEmitter.emit("log", CiphServerLog)
    ▼
@ciph/devtools-server
    │  subscribes to emitter, pushes to circular buffer
    ▼
Browser opens http://localhost:3000/ciph
    │  connects to GET /ciph/stream (SSE)
    ▼
Inspector UI — live log of all plain request/response data
```

## Key Characteristics

- **Dev-only** — all `/ciph` routes return 404 when `NODE_ENV=production`
- **Zero framework dependency** — inspector UI is built with vanilla HTML/CSS/JS (no React, no bundler required)
- **Real-time** — SSE pushes new logs to the browser instantly
- **Self-contained** — the entire UI is served from the Hono sub-app, no external assets
- **Independent from devtools-client** — the two devtools panels are separate; either can be used alone

## What This Package Does NOT Do

- Does not sync with `@ciph/devtools-client` (they are independent tools)
- Does not persist logs beyond server restart
- Does not expose plain data when `NODE_ENV=production`
- Does not require a database or file system
- Does not support WebSocket or binary stream inspection (v1)

## Runtime

| Runtime  | Support |
|----------|---------|
| Node.js  | ✅      |
| Bun      | ✅      |
| Deno     | ✅      |
| Browser  | ❌ (server-only) |

## Dependencies

| Package      | Role                          |
|--------------|-------------------------------|
| `@ciph/core` | `CiphServerLog` type + emitter |
| `hono`       | Peer dependency               |
