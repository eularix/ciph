import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ciph } from '@ciph/hono'

const app = new Hono()

// CORS — allow frontend dev origin
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Client-PublicKey', 'X-Fingerprint'],
  exposeHeaders: [],
  credentials: false,
}))

// v2 ECDH — uses privateKey from env (no shared secret on frontend)
// Devtools inspector auto-starts at http://localhost:4321 in development
app.use('/*', ciph({
  privateKey: process.env.CIPH_PRIVATE_KEY!,
}))

app.post('/api/echo', async (c) => {
  const body = await c.req.json()
  return c.json({
    received: body,
    message: 'Request encrypted/decrypted successfully!',
    timestamp: new Date().toISOString()
  })
})

app.get('/api/health', (c) => c.json({ status: 'ok' }))

const EMPLOYEES = [
  { id: 1, name: 'Dimas Maulana', role: 'Lead Engineer', dept: 'Engineering', salary: 120000, joined: '2022-01-15', status: 'active' },
  { id: 2, name: 'John Smith', role: 'Backend Dev', dept: 'Engineering', salary: 95000, joined: '2022-03-10', status: 'active' },
  { id: 3, name: 'Sarah Lee', role: 'Product Manager', dept: 'Product', salary: 110000, joined: '2021-08-20', status: 'active' },
  { id: 4, name: 'Ali Hassan', role: 'DevOps Engineer', dept: 'Infrastructure', salary: 105000, joined: '2023-02-01', status: 'active' },
  { id: 5, name: 'Maria Garcia', role: 'UX Designer', dept: 'Design', salary: 90000, joined: '2022-07-14', status: 'active' },
  { id: 6, name: 'Tom Chen', role: 'Data Analyst', dept: 'Analytics', salary: 85000, joined: '2023-05-22', status: 'active' },
  { id: 7, name: 'Nina Patel', role: 'Frontend Dev', dept: 'Engineering', salary: 92000, joined: '2021-11-03', status: 'inactive' },
  { id: 8, name: 'Lucas Müller', role: 'Security Engineer', dept: 'Security', salary: 115000, joined: '2020-09-18', status: 'active' },
]

app.get('/api/users', (c) => {
  return c.json({
    data: [{ id: 1, name: 'Dimas' }, { id: 2, name: 'John' }]
  })
})

app.get('/api/employees', (c) => {
  return c.json({ data: EMPLOYEES, total: EMPLOYEES.length })
})

export default {
  port: 4008,
  fetch: app.fetch
}