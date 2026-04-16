# Implementation Plan for @ciph/devtools-client

## 1. Package Setup (package.json, tsconfig.json, tsup.config.ts, vitest.config.ts)

**Files to create:**
```
packages/devtools-client/
├── package.json
├── tsconfig.json  
├── tsup.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts (exports)
│   ├── types.ts (all task types + CiphDevtoolsClient)
│   ├── client.ts (CiphDevtoolsClient class)
│   └── stats.ts (getStats implementation)
└── __tests__/
    └── client.test.ts (Vitest tests)
```

**package.json:**
```
{
  "name": "@ciph/devtools-client",
  "type": "module",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.cjs"
    }
  },
  "peerDependencies": {
    "@ciph/core": "workspace:*"
  },
  "devDependencies": {
    "@ciph/core": "workspace:*",
    "typescript": "^5.0.0",
    "tsup": "^8.0.0",
    "vitest": "^1.0.0"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest"
  }
}
```

## 2. Types (src/types.ts)

Extend task types with EventEmitter interface:
```ts
// All task types exactly as specified
interface CiphDevtoolsOptions { ... }
type CiphLogSource = "server" | "client"
interface CiphLogEntry { ... }
interface CiphDevtoolsStats { ... }

// EventEmitter-like for globals
interface SimpleEmitter {
  on(event: "log", cb: (log: CiphClientLog | CiphServerLog) => void): () => void
  emit(event: "log", log: CiphClientLog | CiphServerLog): void
}

// Import core types
import type { CiphClientLog, CiphServerLog, CiphErrorCode } from "@ciph/core"
```

## 3. CiphDevtoolsClient Class (src/client.ts)

**Key Implementation:**

```ts
class CiphDevtoolsClient {
  private maxLogs = 500
  private logs: CiphLogEntry[] = []
  private logCallbacks: ((entry: CiphLogEntry) => void)[] = []
  private clientEmitter: SimpleEmitter | null = null
  private serverEmitter: SimpleEmitter | null = null
  private connected = false

  constructor(options?: CiphDevtoolsOptions) {
    this.maxLogs = options?.maxLogs ?? 500
  }

  connect() {
    if (this.connected) return
    
    // Client emitter: window.__ciphClientEmitter__
    this.clientEmitter = (window as any).__ciphClientEmitter__
    if (this.clientEmitter?.on) {
      const clientUnsub = this.clientEmitter.on("log", (log: CiphClientLog) => {
        const entry: CiphLogEntry = {
          id: log.id,
          source: "client",
          timestamp: log.timestamp,
          log
        }
        this.addLog(entry)
      })
      // Store unsub fn for disconnect
    }

    // Server emitter: globalThis.ciphServerEmitter
    this.serverEmitter = (globalThis as any).ciphServerEmitter
    if (this.serverEmitter?.on) {
      // Similar subscription
    }

    this.connected = true
  }

  disconnect() {
    // Cleanup subscriptions
    this.connected = false
  }

  private addLog(entry: CiphLogEntry) {
    if (options?.filter && !options.filter(entry)) return
    
    this.logs.unshift(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.pop()
    }
    
    this.logCallbacks.forEach(cb => cb(entry))
  }

  getLogs(): CiphLogEntry[] { return [...this.logs] }
  clearLogs() { this.logs = [] }
  
  onLog(cb: (entry: CiphLogEntry) => void): () => void {
    this.logCallbacks.push(cb)
    return () => {
      const idx = this.logCallbacks.indexOf(cb)
      if (idx > -1) this.logCallbacks.splice(idx, 1)
    }
  }

  getStats(): CiphDevtoolsStats {
    // Implementation using reduce over logs
    // Count totalRequests, errors, avgDuration, etc.
  }
}
```

## 4. Stats Implementation (src/stats.ts)

Aggregate stats from CiphLogEntry[]:
- totalRequests: logs.length
- totalErrors: logs.filter(l => l.log.status >= 400).length
- avgDuration: average of log.duration
- encryptedCount: logs.filter(l => !l.log.excluded).length
- errorBreakdown: group by l.log.error

## 5. Tests (__tests__/client.test.ts)

**Coverage:**
```
✓ connect/disconnect lifecycle
✓ getLogs() returns circular buffer
✓ clearLogs() empties buffer
✓ onLog() subscription/unsubscribe
✓ getStats() accuracy
✓ filter option works
✓ maxLogs eviction (circular buffer)
✓ server + client log interop
✓ TypeScript strict compliance
```

**Mock emitters on window/globalThis for tests.**

## 6. Exports (src/index.ts)

```ts
export { CiphDevtoolsClient } from "./client.js"
export type { CiphDevtoolsOptions, CiphLogEntry, CiphDevtoolsStats } from "./types.js"
// Re-export core types for convenience
export type { CiphClientLog, CiphServerLog, CiphErrorCode } from "@ciph/core"
```

## 7. Build & Test Commands

```bash
cd packages/devtools-client
pnpm install  # installs peer deps
pnpm test     # vitest
pnpm build    # tsup ESM+CJS+DTS
```

## 8. Verification Steps

1. Create all files per plan
2. `pnpm --filter @ciph/devtools-client test`
3. `pnpm --filter @ciph/devtools-client build`
4. Manual test: mock emitters, verify connect() captures logs
