import type { CiphServerLog } from '@ciph/core'

export interface CiphDevtoolsServerOptions {
  /**
   * HTTP/WebSocket server port.
   * @default 4321
   */
  port?: number

  /**
   * Maximum number of log entries in circular buffer.
   * @default 500
   */
  maxLogs?: number

  /**
   * CORS allowed origins for browser WebSocket connections.
   * @default []
   */
  cors?: string[]
}

export interface CiphDevtoolsStats {
  /**
   * Current number of logs in buffer.
   */
  totalLogs: number

  /**
   * Maximum buffer size.
   */
  maxLogs: number

  /**
   * Active WebSocket connections.
   */
  activeConnections: number

  /**
   * Server uptime in milliseconds.
   */
  uptimeMs: number
}
