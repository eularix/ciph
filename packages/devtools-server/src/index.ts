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

function buildInspectorHtml(wsUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Ciph Inspector</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f1117; --bg2: #161b22; --bg3: #1c2230;
    --border: #30363d; --text: #e6edf3; --text2: #8b949e;
    --green: #3fb950; --red: #f85149; --blue: #58a6ff;
    --orange: #d29922; --purple: #bc8cff; --yellow: #e3b341;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Menlo','Monaco','Consolas',monospace; font-size: 13px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  header { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
  header h1 { font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: 0.5px; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); flex-shrink: 0; }
  .status-dot.live { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .status-label { font-size: 11px; color: var(--text2); }
  .spacer { flex: 1; }
  .btn { padding: 5px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3); color: var(--text2); cursor: pointer; font-size: 12px; font-family: inherit; }
  .btn:hover { color: var(--text); border-color: var(--text2); }
  .count-badge { background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 2px 8px; font-size: 11px; color: var(--text2); }
  .main { display: flex; flex: 1; overflow: hidden; }
  .log-list { width: 420px; border-right: 1px solid var(--border); overflow-y: auto; flex-shrink: 0; }
  .log-list-header { position: sticky; top: 0; background: var(--bg2); border-bottom: 1px solid var(--border); padding: 8px 12px; display: grid; grid-template-columns: 60px 1fr 52px 52px; gap: 8px; font-size: 11px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; z-index: 1; }
  .log-row { padding: 9px 12px; display: grid; grid-template-columns: 60px 1fr 52px 52px; gap: 8px; border-bottom: 1px solid var(--border); cursor: pointer; align-items: center; transition: background 0.1s; }
  .log-row:hover { background: var(--bg2); }
  .log-row.selected { background: var(--bg3); border-left: 2px solid var(--blue); }
  .log-row.error { border-left: 2px solid var(--red); }
  .log-row.excluded { opacity: 0.5; }
  .method-badge { font-size: 10px; font-weight: 700; padding: 2px 5px; border-radius: 4px; text-align: center; }
  .GET    { background: #0d1b2e; color: var(--blue); }
  .POST   { background: #0d2010; color: var(--green); }
  .PUT    { background: #1e1500; color: var(--orange); }
  .PATCH  { background: #1a0d2e; color: var(--purple); }
  .DELETE { background: #2e0d0d; color: var(--red); }
  .route { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  .status-ok { color: var(--green); font-size: 12px; font-weight: 600; }
  .status-err { color: var(--red); font-size: 12px; font-weight: 600; }
  .status-warn { color: var(--orange); font-size: 12px; font-weight: 600; }
  .duration { color: var(--text2); font-size: 11px; }
  .detail { flex: 1; overflow-y: auto; padding: 20px; }
  .detail-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text2); font-size: 14px; }
  .detail-header { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  .detail-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .detail-meta { color: var(--text2); font-size: 11px; display: flex; gap: 12px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 11px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .code-block { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 12px; overflow-x: auto; }
  pre { color: var(--text); font-family: inherit; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
  .copy-btn { font-size: 10px; padding: 2px 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg); color: var(--text2); border-radius: 4px; font-family: inherit; }
  .copy-btn:hover { color: var(--text); }
  .fp-row { display: flex; gap: 8px; align-items: center; padding: 4px 0; color: var(--text2); font-size: 12px; }
  .fp-key { color: var(--blue); min-width: 100px; }
  .fp-val { color: var(--text); }
  .tag { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; }
  .tag-enc  { background: #0d1b2e; color: var(--blue); }
  .tag-excl { background: var(--bg3); color: var(--text2); }
  .tag-ok   { background: #0d2010; color: var(--green); }
  .tag-err  { background: #2e0d0d; color: var(--red); }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
</style>
</head>
<body>
<header>
  <div class="status-dot" id="dot"></div>
  <h1>🔒 Ciph Inspector</h1>
  <span class="status-label" id="status-label">Connecting…</span>
  <div class="spacer"></div>
  <span class="count-badge" id="count">0 requests</span>
  <button class="btn" onclick="clearLogs()">Clear</button>
</header>
<div class="main">
  <div class="log-list">
    <div class="log-list-header">
      <span>Method</span><span>Route</span><span>Status</span><span>Time</span>
    </div>
    <div id="rows"></div>
  </div>
  <div class="detail" id="detail">
    <div class="detail-empty">← Select a request to inspect</div>
  </div>
</div>
<script>
  const wsUrl = '${wsUrl}'
  let logs = []
  let selected = null
  let ws = null
  let reconnectTimer = null
  let reconnectDelay = 1000

  function connect() {
    ws = new WebSocket(wsUrl)
    ws.onopen = () => {
      document.getElementById('dot').classList.add('live')
      document.getElementById('status-label').textContent = 'Live'
      reconnectDelay = 1000
      // Load buffered logs on connect
      fetch('/ciph-devtools/logs').then(r => r.json()).then(d => {
        if (d.logs) { logs = d.logs.reverse(); renderList() }
      }).catch(() => {})
    }
    ws.onmessage = (e) => {
      try {
        const log = JSON.parse(e.data)
        logs.unshift(log)
        if (logs.length > 500) logs.pop()
        renderList()
        if (selected === null) selectLog(0)
      } catch {}
    }
    ws.onclose = () => {
      document.getElementById('dot').classList.remove('live')
      document.getElementById('status-label').textContent = 'Reconnecting…'
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30000)
        connect()
      }, reconnectDelay)
    }
    ws.onerror = () => ws.close()
  }

  function statusClass(s) {
    if (s >= 500) return 'status-err'
    if (s >= 400) return 'status-warn'
    return 'status-ok'
  }

  function renderList() {
    const count = logs.length
    document.getElementById('count').textContent = count + ' request' + (count === 1 ? '' : 's')
    const rows = logs.map((log, i) => {
      const isErr = log.status >= 400
      const cls = ['log-row', isErr ? 'error' : '', log.excluded ? 'excluded' : '', selected === i ? 'selected' : ''].filter(Boolean).join(' ')
      return '<div class="' + cls + '" onclick="selectLog(' + i + ')">' +
        '<span class="method-badge ' + log.method + '">' + log.method + '</span>' +
        '<span class="route">' + esc(log.route) + '</span>' +
        '<span class="' + statusClass(log.status) + '">' + log.status + '</span>' +
        '<span class="duration">' + log.duration + 'ms</span>' +
        '</div>'
    }).join('')
    document.getElementById('rows').innerHTML = rows
  }

  function selectLog(i) {
    selected = i
    renderList()
    const log = logs[i]
    if (!log) return
    const isEnc = !log.excluded
    const d = document.getElementById('detail')
    const reqPlain = fmt(log.request?.plainBody)
    const reqEnc = truncate(log.request?.encryptedBody)
    const resPlain = fmt(log.response?.plainBody)
    const resEnc = truncate(log.response?.encryptedBody)
    const fp = log.fingerprint ?? {}
    d.innerHTML = '<div class="detail-header">' +
      '<div class="detail-title">' +
        '<span class="method-badge ' + log.method + '">' + log.method + '</span>' +
        '<span>' + esc(log.route) + '</span>' +
        '<span class="' + statusClass(log.status) + '">' + log.status + '</span>' +
        '<span class="tag ' + (isEnc ? 'tag-enc' : 'tag-excl') + '">' + (isEnc ? '🔒 Encrypted' : '○ Plain') + '</span>' +
        (log.error ? '<span class="tag tag-err">' + esc(log.error) + '</span>' : '') +
      '</div>' +
      '<div class="detail-meta">' +
        '<span>' + log.timestamp + '</span>' +
        '<span>' + log.duration + 'ms</span>' +
        (log.request?.ip ? '<span>IP: ' + esc(log.request.ip) + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<div class="cols">' +
      '<div class="section"><div class="section-title"><span>Request Body (Plain)</span></div><div class="code-block"><pre>' + reqPlain + '</pre></div></div>' +
      '<div class="section"><div class="section-title"><span>Response Body (Plain)</span></div><div class="code-block"><pre>' + resPlain + '</pre></div></div>' +
    '</div>' +
    '<div class="cols">' +
      '<div class="section"><div class="section-title"><span>Request Encrypted</span><button class="copy-btn" onclick="copy(' + JSON.stringify(log.request?.encryptedBody ?? '') + ')">Copy</button></div><div class="code-block"><pre>' + reqEnc + '</pre></div></div>' +
      '<div class="section"><div class="section-title"><span>Response Encrypted</span><button class="copy-btn" onclick="copy(' + JSON.stringify(log.response?.encryptedBody ?? '') + ')">Copy</button></div><div class="code-block"><pre>' + resEnc + '</pre></div></div>' +
    '</div>' +
    '<div class="section"><div class="section-title"><span>Fingerprint</span></div>' +
      '<div class="fp-row"><span class="fp-key">Hash</span><span class="fp-val">' + esc(fp.value ?? '—') + '</span></div>' +
      '<div class="fp-row"><span class="fp-key">IP Match</span><span class="fp-val">' + (fp.ipMatch ? '✅' : '—') + '</span></div>' +
      '<div class="fp-row"><span class="fp-key">UA Match</span><span class="fp-val">' + (fp.uaMatch ? '✅' : '❌') + '</span></div>' +
    '</div>'
  }

  function fmt(v) {
    if (v === null || v === undefined) return '<span style="color:var(--text2)">—</span>'
    try { return esc(JSON.stringify(v, null, 2)) } catch { return esc(String(v)) }
  }
  function truncate(s) {
    if (!s) return '<span style="color:var(--text2)">—</span>'
    return esc(s.length > 120 ? s.slice(0, 120) + '…' : s)
  }
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }
  function copy(text) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
  function clearLogs() {
    fetch('/ciph-devtools/logs', { method: 'DELETE' }).then(() => {
      logs = []; selected = null
      document.getElementById('rows').innerHTML = ''
      document.getElementById('detail').innerHTML = '<div class="detail-empty">← Select a request to inspect</div>'
      document.getElementById('count').textContent = '0 requests'
    })
  }
  window.clearLogs = clearLogs
  window.selectLog = selectLog
  window.copy = copy
  connect()
</script>
</body>
</html>`
}

export { CiphDevtoolsServerOptions, CiphDevtoolsStats } from './types'
export { ciphDevServer } from './hono/ciphDevServer'
export type { CiphDevServerConfig } from './hono/ciphDevServer'

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

    // CORS preflight
    if (method === 'OPTIONS') {
      this.writeJson(res, 204, {}, origin)
      return
    }

    // Inspector HTML UI at root
    if (url.pathname === '/' && method === 'GET') {
      const host = req.headers.host ?? `localhost:${this.port}`
      const wsUrl = `ws://${host}${BASE_PATH}`
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(buildInspectorHtml(wsUrl))
      return
    }

    if (url.pathname === `${BASE_PATH}/logs`) {
      if (method === 'GET') {
        this.writeJson(res, 200, { logs: this.getLogs(), total: this.logs.length, maxLogs: this.maxLogs }, origin)
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
    // Always allow same-origin (browser opening inspector served by this server)
    const sameOrigin = `http://localhost:${this.port}`
    if (origin === sameOrigin) return true
    if (this.cors.length === 0) return false
    if (this.cors.includes('*')) return true
    return this.cors.includes(origin)
  }
}
