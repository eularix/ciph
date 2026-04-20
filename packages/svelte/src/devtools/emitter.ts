import type { CiphClientLog } from "@ciph/core"

// ─── Client Emitter ───────────────────────────────────────────────────────────

export interface CiphClientEmitter {
  emit(event: "log", log: CiphClientLog): void
  on(event: "log", listener: (log: CiphClientLog) => void): () => void
}

declare global {
  // eslint-disable-next-line no-var
  var __ciphClientEmitter__: CiphClientEmitter | undefined
}

/**
 * Initialize the global client emitter for devtools communication.
 * Called automatically by ciphClient().
 *
 * @internal
 */
export function initClientEmitter(): CiphClientEmitter {
  if (globalThis.__ciphClientEmitter__) {
    return globalThis.__ciphClientEmitter__
  }

  const listeners: Array<(log: CiphClientLog) => void> = []

  globalThis.__ciphClientEmitter__ = {
    emit(event: "log", log: CiphClientLog): void {
      if (event === "log") {
        for (const listener of listeners) {
          try {
            listener(log)
          } catch (error) {
            console.error("[Ciph DevTools] Error in log listener:", error)
          }
        }
      }
    },
    on(event: "log", listener: (log: CiphClientLog) => void) {
      if (event === "log") {
        listeners.push(listener)
      }
      // Return unsubscribe function
      return () => {
        const index = listeners.indexOf(listener)
        if (index >= 0) {
          listeners.splice(index, 1)
        }
      }
    },
  }

  return globalThis.__ciphClientEmitter__
}

/**
 * Get the global client emitter. Initialize if needed.
 *
 * @internal
 */
export function getCiphClientEmitter(): CiphClientEmitter {
  if (!globalThis.__ciphClientEmitter__) {
    initClientEmitter()
  }
  return globalThis.__ciphClientEmitter__!
}
