import type { CiphClientLog } from "@ciph/core"

// ─── Client-side in-memory pub/sub ────────────────────────────────────────────

export interface CiphClientEmitter {
  emit(event: "log", log: CiphClientLog, isBroadcast?: boolean): void
  on(event: "log", listener: (log: CiphClientLog) => void): () => void
}

declare global {
  // eslint-disable-next-line no-var
  var __ciphClientEmitter__: CiphClientEmitter | undefined
}

// ─── Broadcast Channel for Multi-tab Sync ─────────────────────────────────────
let _channel: BroadcastChannel | undefined

/**
 * Creates `globalThis.__ciphClientEmitter__` if not already set.
 * Idempotent — safe to call multiple times.
 */
export function autoInitClientEmitter(): void {
  if (typeof globalThis.__ciphClientEmitter__ !== "undefined") return

  const listeners: Array<(log: CiphClientLog) => void> = []

  if (typeof BroadcastChannel !== "undefined" && !_channel) {
    _channel = new BroadcastChannel("ciph-devtools-logs")
    _channel.onmessage = (event) => {
      if (event.data?.type === "ciph-log" && event.data.log) {
        globalThis.__ciphClientEmitter__?.emit("log", event.data.log as CiphClientLog, true)
      }
    }
  }

  globalThis.__ciphClientEmitter__ = {
    emit(event, log, isBroadcast = false) {
      if (event === "log") {
        for (const l of listeners) l(log)
        if (!isBroadcast && _channel) {
          _channel.postMessage({ type: "ciph-log", log })
        }
      }
    },
    on(event, listener) {
      if (event === "log") {
        listeners.push(listener)
        return () => {
          const i = listeners.indexOf(listener)
          if (i >= 0) listeners.splice(i, 1)
        }
      }
      return () => { /* noop */ }
    },
  }
}

/**
 * Emit a CiphClientLog to the global emitter.
 * No-op if emitter is not initialized (production / SSR).
 */
export function emitClientLog(log: CiphClientLog): void {
  globalThis.__ciphClientEmitter__?.emit("log", log)
}
