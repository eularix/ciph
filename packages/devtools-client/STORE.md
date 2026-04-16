# Log Store — @ciph/devtools-client

## Overview

All captured log entries are stored in a **circular buffer** in memory. This is intentionally not persistent — logs disappear on page refresh to avoid stale data confusion.

## Circular Buffer

```ts
// Conceptual implementation inside @ciph/devtools-client
const MAX_LOGS = 100 // overridable via props

const logBuffer: CiphClientLog[] = []

function addLog(log: CiphClientLog) {
  logBuffer.unshift(log) // newest first
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.pop()      // drop oldest
  }
}
```

## Subscription Lifecycle

```ts
// On component mount
const unsubscribe = ciphClientEmitter.on("log", (log: CiphClientLog) => {
  addLog(log)
  // trigger re-render
})

// On component unmount
unsubscribe()
```

## Memory Behavior

| Action                | Result                              |
|-----------------------|-------------------------------------|
| New request           | Log prepended to buffer             |
| Buffer at max limit   | Oldest log dropped                  |
| Click "Clear"         | Buffer emptied (`logBuffer = []`)   |
| Page refresh          | Buffer lost — starts fresh          |
| Component unmount     | Subscription cleaned up, no leaks   |

## Not Stored In

- ❌ `localStorage` — would expose plain data between sessions
- ❌ `sessionStorage` — plain data should never leave memory
- ❌ `IndexedDB`
- ❌ Any external service
