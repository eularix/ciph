import type { CiphServerLog } from '@ciph/core'
import type { IncomingMessage, OutgoingHttpHeaders, Server, ServerResponse } from 'node:http'
import http from 'node:http'
import WebSocket, { WebSocketServer } from 'ws'
import type { CiphDevtoolsServerOptions, CiphDevtoolsStats } from './types'

interface CiphServerEmitterLike {
  on(event: 'log', listener: (payload: CiphServerLog) => void): void
  off(event: 'log', listener: (payload: CiphServerLog) => void): void
}

declare global {
  // eslint-disable-next-line no-var
  var ciphServerEmitter: CiphServerEmitterLike | undefined
}

const DEFAULT_PORT = 4321
const DEFAULT_MAX_LOGS = 500
const BASE_PATH = '/ciph-devtools'

export { CiphDevtoolsServerOptions, CiphDevtoolsStats } from './types'

export class CiphDevtoolsServer {
  private readonly port: number
  private readonly maxLogs: number
  private readonly cors: string[]

  private readonly logs: CiphServerLog[] = []
  private readonly wsClients = new Set<WebSocket>()

  private server: Server | null = null
  private wsServer: WebSocketServer | null = null
  private startedAt = 0
  private logListener: ((payload: CiphServerLog) => void) | null = null

  constructor(options: CiphDevtoolsServerOptions = {}) {
    this.port = options.port ?? DEFAULT_PORT
    this.maxLogs = options.maxLogs ?? DEFAULT_MAX_LOGS
    this.cors = options.cors ?? []
  }

  async start(): Promise<void> {
    if (this.server) return
    if (process.env.NODE_ENV === 'production') {
      throw new Error('@ciph/devtools-server is disabled in production')
    }

    const emitter = globalThis.ciphServerEmitter
    if (!emitter || typeof emitter.on !== 'function' || typeof emitter.off !== 'function') {
      throw new Error('globalThis.ciphServerEmitter EventEmitter is required')
    }

    this.logListener = (payload: CiphServerLog) => {
      this.pushLog(payload)
      this.broadcast(payload)
    }

    emitter.on('log', this.logListener)

    this.server = http.createServer((req, res) => {
      this.handleHttp(req, res)
    })

    this.wsServer = new WebSocketServer({ noServer: true })

    this.server.on('upgrade', (req, socket, head) => {
      if (!this.wsServer) {
        socket.destroy()
        return
      }

      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
      if (url.pathname !== BASE_PATH) {
        socket.destroy()
        return
      }

      if (!this.isOriginAllowed(req.headers.origin)) {
        socket.destroy()
        return
      }

      this.wsServer.handleUpgrade(req, socket, head, (ws) => {
        this.wsClients.add(ws)
        ws.on('close', () => {
          this.wsClients.delete(ws)
        })
      })
    })

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        reject(error)
      }

      this.server?.once('error', onError)
      this.server?.listen(this.port, () => {
        this.server?.off('error', onError)
        this.startedAt = Date.now()
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.server) return

    if (this.logListener && globalThis.ciphServerEmitter) {
      globalThis.ciphServerEmitter.off('log', this.logListener)
    }

    this.logListener = null

    for (const client of this.wsClients) {
      client.close()
    }
    this.wsClients.clear()

    if (this.wsServer) {
      await new Promise<void>((resolve) => {
        this.wsServer?.close(() => resolve())
      })
      this.wsServer = null
    }

    const currentServer = this.server
    this.server = null

    await new Promise<void>((resolve, reject) => {
      currentServer.close((err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  }

  getLogs(): CiphServerLog[] {
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs.length = 0
  }

  getStats(): CiphDevtoolsStats {
    return {
      totalLogs: this.logs.length,
      maxLogs: this.maxLogs,
      activeConnections: this.wsClients.size,
      uptimeMs: this.startedAt > 0 ? Date.now() - this.startedAt : 0
    }
  }

  private pushLog(log: CiphServerLog): void {
    this.logs.unshift(log)
    if (this.logs.length > this.maxLogs) {
      this.logs.pop()
    }
  }

  private broadcast(log: CiphServerLog): void {
    if (!this.wsClients.size) return
    const payload = JSON.stringify(log)
    for (const client of this.wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    }
  }

  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const method = req.method ?? 'GET'
    const origin = req.headers.origin

    if (method === 'OPTIONS' && url.pathname.startsWith(BASE_PATH)) {
      this.writeJson(res, 204, {}, origin)
      return
    }

    if (url.pathname === `${BASE_PATH}/logs`) {
      if (method === 'GET') {
        this.writeJson(
          res,
          200,
          {
            logs: this.getLogs(),
            total: this.logs.length,
            maxLogs: this.maxLogs
          },
          origin
        )
        return
      }

      if (method === 'DELETE') {
        this.clearLogs()
        this.writeJson(res, 200, { ok: true }, origin)
        return
      }
    }

    if (url.pathname === `${BASE_PATH}/stats` && method === 'GET') {
      this.writeJson(res, 200, this.getStats(), origin)
      return
    }

    this.writeJson(res, 404, { message: 'Not Found' }, origin)
  }

  private writeJson(
    res: ServerResponse,
    statusCode: number,
    body: unknown,
    requestOrigin?: string
  ): void {
    const headers: OutgoingHttpHeaders = {
      'content-type': 'application/json; charset=utf-8'
    }

    if (requestOrigin && this.isOriginAllowed(requestOrigin)) {
      headers['access-control-allow-origin'] = requestOrigin
      headers['access-control-allow-methods'] = 'GET,DELETE,OPTIONS'
      headers['access-control-allow-headers'] = 'content-type'
      headers.vary = 'Origin'
    }

    res.writeHead(statusCode, headers)
    if (statusCode === 204) {
      res.end()
      return
    }

    res.end(JSON.stringify(body))
  }

  private isOriginAllowed(origin?: string): boolean {
    if (!origin) return false
    if (this.cors.length === 0) return false
    if (this.cors.includes('*')) return true
    return this.cors.includes(origin)
  }
}
