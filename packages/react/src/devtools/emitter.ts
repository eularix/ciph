import type { CiphClientLog } from "@ciph/core"

// ─── Client-side in-memory pub/sub ────────────────────────────────────────────
// Works identically to TanStack Query devtools: @ciph/react owns the Axios
// instance, emits logs here, and the panel subscribes. No WebSocket needed.

export interface CiphClientEmitter {
  emit(event: "log", log: CiphClientLog): void
  on(event: "log", listener: (log: CiphClientLog) => void): () => void
}

declare global {
  // eslint-disable-next-line no-var
  var __ciphClientEmitter__: CiphClientEmitter | undefined
}

/**
 * Creates `globalThis.__ciphClientEmitter__` if not already set.
 * Should be called once at module init (inside CiphProvider, dev-mode only).
 * Idempotent — safe to call multiple times.
 */
export function autoInitClientEmitter(): void {
  if (typeof globalThis.__ciphClientEmitter__ !== "undefined") return

  const listeners: Array<(log: CiphClientLog) => void> = []

  globalThis.__ciphClientEmitter__ = {
    emit(event, log) {
      if (event === "log") {
        for (const l of listeners) l(log)
      }
    },
    on(event, listener) {
      if (event === "log") {
        listeners.push(listener)
        // Returns unsubscribe fn
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
 * Called by client.ts interceptors after each request/response.
 * No-op if emitter is not initialized (production / SSR).
 */
export function emitClientLog(log: CiphClientLog): void {
  globalThis.__ciphClientEmitter__?.emit("log", log)
}
