# Production Guard — @ciph/devtools-server

## The Rule

**`@ciph/devtools-server` must expose zero information in production.**

When `NODE_ENV=production`:
- All `/ciph/*` routes return `404 Not Found`
- No log buffer is allocated
- No SSE connections are accepted
- `@ciph/hono` stops emitting `ciphServerEmitter` events entirely

## Implementation

### Route-level Guard

```ts
// Inside ciphDevServer — first middleware on all routes
app.use("*", (c, next) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ message: "Not Found" }, 404)
  }
  return next()
})
```

Every request to `/ciph/*` is rejected before any logic runs.

### Emitter Guard (Upstream)

In `@ciph/hono`:

```ts
// Only emit when in development
if (process.env.NODE_ENV !== "production") {
  ciphServerEmitter.emit("log", log)
}
```

Even if the route guard somehow failed, there would be no logs in the buffer because `@ciph/hono` never emits in production.

### Buffer Guard

The circular buffer is never initialized in production:

```ts
// Inside ciphDevServer
const buffer = process.env.NODE_ENV !== "production"
  ? new CircularBuffer<CiphServerLog>(config.maxLogs ?? 500)
  : null
```

## Defense in Depth

Three independent layers prevent data exposure in production:

```
Layer 1: @ciph/hono stops emitting log events
              ↓ (nothing to capture)
Layer 2: ciphDevServer buffer never initialized
              ↓ (nothing to store)
Layer 3: All /ciph/* routes return 404
              ↓ (nothing to serve)
```

All three layers must fail simultaneously for any data to be exposed. This is practically impossible under normal deployment conditions.

## Deployment Recommendation

Do not include `@ciph/devtools-server` in your production Docker image at all. Add it as a dev dependency:

```json
{
  "dependencies": {
    "@ciph/hono": "^0.1.0"
  },
  "devDependencies": {
    "@ciph/devtools-server": "^0.1.0"
  }
}
```

Then conditionally mount it only in development:

```ts
if (process.env.NODE_ENV !== "production") {
  const { ciphDevServer } = await import("@ciph/devtools-server")
  app.route("/ciph", ciphDevServer({ secret: process.env.CIPH_SECRET! }))
}
```

This ensures `@ciph/devtools-server` is never even present in the production bundle or container.
