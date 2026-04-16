import type {
  CiphDevtoolsOptions,
  CiphLogEntry,
  CiphDevtoolsStats,
  SimpleEmitter
} from "./types.js"
import type { CiphClientLog, CiphServerLog, CiphErrorCode } from "@ciph/core"

type GlobalWithEmitters = typeof globalThis & {
  ciphServerEmitter?: SimpleEmitter
  __ciphClientEmitter__?: SimpleEmitter
}

export class CiphDevtoolsClient {
  private maxLogs: number
  private filter: ((entry: CiphLogEntry) => boolean) | undefined
  private logs: CiphLogEntry[] = []
  private logCallbacks: Array<(entry: CiphLogEntry) => void> = []
  private clientUnsubscribe: (() => void) | undefined
  private serverUnsubscribe: (() => void) | undefined
  private connected = false
  private autoConnect: boolean

  constructor(options: CiphDevtoolsOptions = {}) {
    this.maxLogs = options.maxLogs ?? 500
    this.filter = options.filter
    this.autoConnect = options.autoConnect ?? true

    if (this.autoConnect) {
      this.connect()
    }
  }

  connect(): void {
    if (this.connected) return

    const root = globalThis as GlobalWithEmitters

    const clientEmitter = root.__ciphClientEmitter__
    if (clientEmitter?.on) {
      this.clientUnsubscribe = clientEmitter.on("log", (log) => {
        const clientLog = log as CiphClientLog
        const entry: CiphLogEntry = {
          id: clientLog.id,
          source: "client",
          timestamp: clientLog.timestamp,
          log: clientLog
        }
        this.addLog(entry)
      })
    }

    const serverEmitter = root.ciphServerEmitter
    if (serverEmitter?.on) {
      this.serverUnsubscribe = serverEmitter.on("log", (log) => {
        const serverLog = log as CiphServerLog
        const entry: CiphLogEntry = {
          id: serverLog.id,
          source: "server",
          timestamp: serverLog.timestamp,
          log: serverLog
        }
        this.addLog(entry)
      })
    }

    this.connected = true
  }

  disconnect(): void {
    this.clientUnsubscribe?.()
    this.serverUnsubscribe?.()
    this.clientUnsubscribe = undefined
    this.serverUnsubscribe = undefined
    this.connected = false
  }

  private addLog(entry: CiphLogEntry): void {
    if (this.filter?.(entry) === false) return

    this.logs.unshift(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.pop()
    }

    for (const cb of this.logCallbacks) {
      cb(entry)
    }
  }

  getLogs(): CiphLogEntry[] {
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
  }

  onLog(callback: (entry: CiphLogEntry) => void): () => void {
    this.logCallbacks.push(callback)
    return () => {
      const index = this.logCallbacks.indexOf(callback)
      if (index >= 0) {
        this.logCallbacks.splice(index, 1)
      }
    }
  }

  getStats(): CiphDevtoolsStats {
    if (this.logs.length === 0) {
      return {
        totalRequests: 0,
        totalErrors: 0,
        avgDuration: 0,
        encryptedCount: 0,
        excludedCount: 0,
        errorBreakdown: {}
      }
    }

    let totalDuration = 0
    let totalErrors = 0
    let encryptedCount = 0
    let excludedCount = 0
    const errorBreakdown: Partial<Record<CiphErrorCode, number>> = {}

    for (const entry of this.logs) {
      const log = entry.log
      totalDuration += log.duration

      if (log.status >= 400) {
        totalErrors += 1
      }

      if (log.excluded) {
        excludedCount += 1
      } else {
        encryptedCount += 1
      }

      if ("error" in log && log.error) {
        const errorCode = log.error as CiphErrorCode
        errorBreakdown[errorCode] = (errorBreakdown[errorCode] ?? 0) + 1
      }
    }

    return {
      totalRequests: this.logs.length,
      totalErrors,
      avgDuration: Math.round(totalDuration / this.logs.length),
      encryptedCount,
      excludedCount,
      errorBreakdown
    }
  }

  isConnected(): boolean {
    return this.connected
  }
}
