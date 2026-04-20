// Ciph DevTools configuration and initialization
import type { CiphServerLog } from "@ciph/core"

export interface CiphDevtoolsConfig {
  /**
   * Enable devtools logging. Default: true in development.
   */
  enabled?: boolean

  /**
   * Max logs to keep in buffer. Default: 500
   */
  maxLogs?: number
}

// DevTools state
let devtoolsConfig: CiphDevtoolsConfig | null = null
let logBuffer: CiphServerLog[] = []

/**
 * Initialize DevTools configuration.
 * Called by ciphHooks() if devtools config is provided.
 *
 * @internal
 */
export function initDevtools(config: CiphDevtoolsConfig): void {
  if (typeof config !== "object" || config === null) return

  devtoolsConfig = {
    enabled: config.enabled ?? true,
    maxLogs: config.maxLogs ?? 500,
  }
}

/**
 * Get the current devtools configuration.
 *
 * @internal
 */
export function getDevtoolsConfig(): CiphDevtoolsConfig | null {
  return devtoolsConfig
}

/**
 * Add a log to the devtools buffer.
 *
 * @internal
 */
export function addToLogBuffer(log: CiphServerLog): void {
  if (!devtoolsConfig?.enabled) return

  logBuffer.push(log)

  // Keep buffer within max size (circular)
  const maxLogs = devtoolsConfig.maxLogs ?? 500
  if (logBuffer.length > maxLogs) {
    logBuffer = logBuffer.slice(-maxLogs)
  }
}

/**
 * Get all logs from the buffer.
 *
 * @internal
 */
export function getLogBuffer(): CiphServerLog[] {
  return [...logBuffer]
}

/**
 * Clear the log buffer.
 *
 * @internal
 */
export function clearLogBuffer(): void {
  logBuffer = []
}
