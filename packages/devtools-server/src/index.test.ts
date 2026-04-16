import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EventEmitter } from 'node:events'
import http from 'node:http'
import WebSocket from 'ws'
import { CiphDevtoolsServer } from './index'
import type { CiphServerLog } from '@ciph/core'

declare global {
  // eslint-disable-next-line no-var
  var ciphServerEmitter: EventEmitter | undefined
}

function makeLog(id: string, route = '/employees'): CiphServerLog {
  return {
    id,
    method: 'GET',
    route,
    status: 200,
    duration: 12,
    timestamp: new Date().toISOString(),
    request: {
      plainBody: { id },
      encryptedBody: 'enc-req',
      headers: { 'content-type': 'text/plain' },
      ip: '127.0.0.1',
      userAgent: 'vitest'
    },
    response: {
      plainBody: { ok: true },
      encryptedBody: 'enc-res'
    },
    fingerprint: {
      value: 'fp',
      ipMatch: true,
      uaMatch: true
    },
    excluded: false,
    error: null
  }
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer()
    srv.listen(0, () => {
      const addr = srv.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to get free port'))
        return
      }
      const { port } = addr
      srv.close((err) => {
        if (err) {
          reject(err)
          return
        }
        resolve(port)
      })
    })
  })
}

async function httpJson<T>(url: string, init?: RequestInit): Promise<{ status: number; json: T; headers: Headers }> {
  const res = await fetch(url, init)
  const json = (await res.json()) as T
  return { status: res.status, json, headers: res.headers }
}

describe('CiphDevtoolsServer', () => {
  let server: CiphDevtoolsServer
  let port: number

  beforeEach(async () => {
    globalThis.ciphServerEmitter = new EventEmitter()
    port = await findFreePort()
    server = new CiphDevtoolsServer({
      port,
      maxLogs: 3,
      cors: ['http://allowed.local']
    })
    await server.start()
  })

  afterEach(async () => {
    await server.stop()
    globalThis.ciphServerEmitter = undefined
  })

  it('start/stop lifecycle works', async () => {
    const stats = server.getStats()
    expect(stats.uptimeMs).toBeGreaterThanOrEqual(0)

    await server.stop()
    await server.start()

    const statsAfterRestart = server.getStats()
    expect(statsAfterRestart.uptimeMs).toBeGreaterThanOrEqual(0)
  })

  it('collects logs from emitter', () => {
    globalThis.ciphServerEmitter?.emit('log', makeLog('1'))
    globalThis.ciphServerEmitter?.emit('log', makeLog('2'))

    const logs = server.getLogs()
    expect(logs).toHaveLength(2)
    expect(logs[0]?.id).toBe('2')
    expect(logs[1]?.id).toBe('1')
  })

  it('applies circular buffer (maxLogs)', () => {
    globalThis.ciphServerEmitter?.emit('log', makeLog('1'))
    globalThis.ciphServerEmitter?.emit('log', makeLog('2'))
    globalThis.ciphServerEmitter?.emit('log', makeLog('3'))
    globalThis.ciphServerEmitter?.emit('log', makeLog('4'))

    const logs = server.getLogs()
    expect(logs).toHaveLength(3)
    expect(logs.map((l) => l.id)).toEqual(['4', '3', '2'])
  })

  it('GET /ciph-devtools/logs returns buffered logs', async () => {
    globalThis.ciphServerEmitter?.emit('log', makeLog('a'))
    globalThis.ciphServerEmitter?.emit('log', makeLog('b'))

    const { status, json } = await httpJson<{ logs: CiphServerLog[]; total: number; maxLogs: number }>(
      `http://127.0.0.1:${port}/ciph-devtools/logs`
    )

    expect(status).toBe(200)
    expect(json.total).toBe(2)
    expect(json.maxLogs).toBe(3)
    expect(json.logs[0]?.id).toBe('b')
  })

  it('DELETE /ciph-devtools/logs clears buffer', async () => {
    globalThis.ciphServerEmitter?.emit('log', makeLog('a'))

    const del = await httpJson<{ ok: boolean }>(`http://127.0.0.1:${port}/ciph-devtools/logs`, {
      method: 'DELETE'
    })
    expect(del.status).toBe(200)
    expect(del.json.ok).toBe(true)

    const get = await httpJson<{ total: number }>(`http://127.0.0.1:${port}/ciph-devtools/logs`)
    expect(get.json.total).toBe(0)
  })

  it('GET /ciph-devtools/stats returns accurate stats', async () => {
    globalThis.ciphServerEmitter?.emit('log', makeLog('x'))
    const { status, json } = await httpJson<{ totalLogs: number; maxLogs: number; activeConnections: number; uptimeMs: number }>(
      `http://127.0.0.1:${port}/ciph-devtools/stats`
    )

    expect(status).toBe(200)
    expect(json.totalLogs).toBe(1)
    expect(json.maxLogs).toBe(3)
    expect(json.activeConnections).toBe(0)
    expect(json.uptimeMs).toBeGreaterThanOrEqual(0)
  })

  it('broadcasts logs over websocket endpoint', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ciph-devtools`, {
      headers: { Origin: 'http://allowed.local' }
    })

    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', reject)
    })

    const messagePromise = new Promise<CiphServerLog>((resolve, reject) => {
      ws.once('message', (data) => {
        try {
          resolve(JSON.parse(data.toString()) as CiphServerLog)
        } catch (error) {
          reject(error)
        }
      })
      ws.once('error', reject)
    })

    globalThis.ciphServerEmitter?.emit('log', makeLog('ws-1'))
    const payload = await messagePromise

    expect(payload.id).toBe('ws-1')

    ws.close()
    await new Promise<void>((resolve) => ws.once('close', () => resolve()))
  })

  it('applies CORS headers for allowed origin', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/ciph-devtools/logs`, {
      headers: { Origin: 'http://allowed.local' }
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://allowed.local')
  })

  it('does not apply CORS headers for disallowed origin', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/ciph-devtools/logs`, {
      headers: { Origin: 'http://blocked.local' }
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})
