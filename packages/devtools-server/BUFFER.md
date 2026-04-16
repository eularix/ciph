# Log Buffer — @ciph/devtools-server

## Overview

All incoming `CiphServerLog` events are stored in a **circular buffer** in memory. This design is intentional:

- Logs are ephemeral — they disappear on server restart
- No database or file system dependency
- Bounded memory usage regardless of traffic volume
- No risk of sensitive plain data persisting beyond the development session

## Circular Buffer Behavior

```
maxLogs = 500 (default)

New log arrives → prepend to buffer (newest first)
Buffer length > maxLogs → drop oldest entry from tail

Timeline:
  [log-500] [log-499] ... [log-2] [log-1]  ← oldest
  ↑
  [log-501 arrives]
  [log-501] [log-500] [log-499] ... [log-2]  ← log-1 dropped
```

The buffer is a standard JavaScript array manipulated with `unshift` (prepend) and `pop` (drop tail).

## Thread Safety

Node.js and Bun run JavaScript on a single thread — no mutex or lock is needed. Each event loop tick processes one operation atomically.

## Memory Estimate

Each `CiphServerLog` entry is approximately 1–5 KB when serialized (depending on payload size). With the default `maxLogs: 500`:

```
500 entries × 5 KB = ~2.5 MB maximum memory usage
```

This is negligible for a development server.

## Buffer Operations

| Operation       | Trigger                      | Effect                             |
|-----------------|------------------------------|------------------------------------|
| Add log         | New request processed        | Prepend to buffer, drop oldest if over limit |
| Read all logs   | `GET /ciph/logs`             | Return buffer as JSON array        |
| Clear buffer    | `DELETE /ciph/logs` or UI button | Empty the buffer (`buffer = []`) |
| Server restart  | Process exits                | Buffer lost — starts fresh         |

## No Persistence — By Design

Plain request/response data must never be written to disk in any form during development. This prevents:
- Accidentally committing sensitive data to version control
- Leaving plain API payloads in log files on a shared machine

If you need to persist logs for a debugging session, use the **Export JSON** button in the inspector UI to download a snapshot manually.
