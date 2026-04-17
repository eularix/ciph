import { Hono } from 'hono'
import { ciph } from '@ciph/hono'
import { CiphDevtoolsServer } from '@ciph/devtools-server'
import { EventEmitter } from 'events'

// ✅ Setup emitter manual sebelum apapun
if (!globalThis.ciphServerEmitter) {
  globalThis.ciphServerEmitter = new EventEmitter()
}

const app = new Hono()

app.use('/*', ciph({
  secret: process.env.CIPH_SECRET!
}))

if (process.env.NODE_ENV !== 'production') {
  const devtools = new CiphDevtoolsServer({ port: 4321 })
  await devtools.start()
}

app.post('/api/echo', async (c) => {
  const body = await c.req.json()
  return c.json({
    received: body,
    message: 'Request encrypted/decrypted successfully!',
    timestamp: new Date().toISOString()
  })
})

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.get('/api/users', (c) => {
  return c.json({
    data: [{ id: 1, name: 'Dimas' }, { id: 2, name: 'John' }]
  })
})

export default {
  port: 4008,
  fetch: app.fetch
}