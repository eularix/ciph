import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { CiphServerLog } from '@ciph/core'
import { basicAuth } from 'hono/basic-auth'

export interface CiphDevServerConfig {
  secret: string
  maxLogs?: number
  password?: string
  disabled?: boolean
}

export function ciphDevServer(config: CiphDevServerConfig): Hono {
  const app = new Hono()

  if (config.disabled || process.env.NODE_ENV === 'production') {
    app.all('/*', (c) => c.json({ message: 'Not Found' }, 404))
    return app
  }

  if (config.password) {
    app.use('/*', basicAuth({ username: 'admin', password: config.password }))
  }

  const maxLogs = config.maxLogs ?? 500
  let logs: CiphServerLog[] = []
  const listeners = new Set<(log: CiphServerLog) => void>()
  let emitterSubscribed = false

  // Lazy subscription: emitter may not exist yet when ciphDevServer() is called.
  // Subscribe on first use so we catch the emitter even if ciph() runs after ciphDevServer().
  function ensureEmitterSubscribed(): void {
    if (emitterSubscribed) return
    const g = globalThis as { ciphServerEmitter?: { on: (e: string, l: (log: CiphServerLog) => void) => void } }
    const emitter = g.ciphServerEmitter
    if (!emitter?.on) return
    emitterSubscribed = true
    emitter.on('log', (log: CiphServerLog) => {
      logs.unshift(log)
      if (logs.length > maxLogs) logs.pop()
      for (const listener of listeners) listener(log)
    })
  }

  app.get('/', (c) => {
    return c.html(`<!DOCTYPE html><html><body><h1>Ciph Devtools Server</h1><p>Listening for Ciph logs...</p></body></html>`)
  })

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.get('/logs', (c) => {
    ensureEmitterSubscribed()
    return c.json({
      logs,
      total: logs.length,
      maxLogs,
    })
  })

  app.delete('/logs', (c) => {
    logs = []
    return c.json({ ok: true })
  })

  app.get('/stream', (c) => {
    ensureEmitterSubscribed()
    return streamSSE(c, async (stream) => {
      const listener = (log: CiphServerLog) => {
        stream.writeSSE({
          event: 'ciph-log',
          data: JSON.stringify(log),
        })
      }
      listeners.add(listener)
      
      stream.onAbort(() => {
        listeners.delete(listener)
      })

      // Simple keepalive loop since hono streaming requires yielding or sleeping
      while (true) {
        await stream.sleep(30000)
        try {
          await stream.writeSSE({ data: '', event: 'keepalive' })
        } catch { 
          break
        }
      }
    })
  })

  return app
}
