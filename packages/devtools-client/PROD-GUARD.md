# Production Guard — @ciph/devtools-client

## The Rule

**`@ciph/devtools-client` must have zero presence in production builds.**

This means:
- No DOM nodes rendered
- No event subscriptions active
- No memory allocated for log buffer
- No bytes added to production JS bundle

## How It Works

### Runtime Guard

Inside the component:

```ts
export function CiphDevtools(props: CiphDevtoolsProps) {
  if (process.env.NODE_ENV === "production") {
    return null
  }
  // ... all devtools logic
}
```

### Build-time Tree Shaking

When `NODE_ENV=production`, bundlers (Vite, webpack, esbuild, Rollup) statically analyze the `process.env.NODE_ENV === "production"` check and eliminate the entire dead code branch.

After tree-shaking, the production bundle contains roughly:

```js
// The entire @ciph/devtools-client becomes:
function CiphDevtools() { return null }
export { CiphDevtools }
```

Which is then further eliminated if unused imports are removed (e.g., with `sideEffects: false` in package.json).

### Emitter Guard (in @ciph/client)

The event emission itself is also guarded:

```ts
// Inside @ciph/client — only emits in development
if (process.env.NODE_ENV !== "production") {
  ciphClientEmitter.emit("log", log)
}
```

So even if the component somehow rendered, there would be no events to capture.

## Verification

To confirm zero production presence:

```bash
# Build production bundle
vite build

# Search for devtools code in output
grep -r "CiphDevtools" dist/
grep -r "ciphClientEmitter" dist/

# Both should return no results
```
