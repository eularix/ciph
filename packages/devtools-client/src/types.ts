import type { CiphClientLog, CiphServerLog, CiphErrorCode } from "@ciph/core"

export interface CiphDevtoolsOptions {
  maxLogs?: number       // default 500
  autoConnect?: boolean  // default true
  filter?: (entry: CiphLogEntry) => boolean
}

export type CiphLogSource = "server" | "client"

export interface CiphLogEntry {
  id: string
  source: CiphLogSource
  timestamp: string
  log: CiphServerLog | CiphClientLog
}

export interface CiphDevtoolsStats {
  totalRequests: number
  totalErrors: number
  avgDuration: number
  encryptedCount: number
  excludedCount: number
  errorBreakdown: Partial<Record<CiphErrorCode, number>>
}

export interface SimpleEmitter {
  on(event: "log", cb: (log: CiphClientLog | CiphServerLog) => void): () => void
  emit(event: "log", log: CiphClientLog | CiphServerLog): void
}
