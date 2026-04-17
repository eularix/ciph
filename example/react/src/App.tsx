import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import { useCiph } from '@ciph/react'
import './App.css'

type ApiResponse = {
  received?: { message: string; timestamp: string }
  message?: string
  timestamp?: string
  error?: string
}

type Employee = {
  id: number
  name: string
  role: string
  dept: string
  salary: number
  joined: string
  status: 'active' | 'inactive'
}

type Status = 'idle' | 'success' | 'error'

function App() {
  const ciph = useCiph()
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [empLoading, setEmpLoading] = useState(false)
  const [empError, setEmpError] = useState<string | null>(null)

  const testCiph = async () => {
    setLoading(true)
    setResponse(null)
    setStatus('idle')
    try {
      const res = await ciph.post<ApiResponse>('/api/echo', {
        message: 'Hello from Ciph v2 (ECDH)!',
        timestamp: new Date().toISOString(),
      })
      setResponse(res.data)
      setStatus('success')
    } catch (error) {
      setResponse({ error: (error as Error).message || 'Request failed' })
      setStatus('error')
    }
    setLoading(false)
  }

  const fetchEmployees = async () => {
    setEmpLoading(true)
    setEmpError(null)
    try {
      const res = await ciph.get<{ data: Employee[]; total: number }>('/api/employees')
      setEmployees(res.data.data)
    } catch (error) {
      setEmpError((error as Error).message || 'Failed to fetch employees')
    }
    setEmpLoading(false)
  }

  useEffect(() => {
    fetchEmployees()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1>Ciph Example</h1>
          <p style={{ color: 'var(--text-2)', marginBottom: '24px' }}>
            Click the button to send an encrypted POST request to the backend.
            <br />
            Body is AES-256-GCM encrypted — plain text never touches the network.
          </p>
          <button className="counter" onClick={testCiph} disabled={loading}>
            {loading ? 'Encrypting & sending…' : 'Test Ciph → POST /api/echo'}
          </button>
        </div>

        {response && (
          <div style={{
            width: '100%',
            maxWidth: '520px',
            padding: '20px 24px',
            background: status === 'error' ? '#fff1f2' : '#f0fdf4',
            border: `1px solid ${status === 'error' ? '#fecdd3' : '#bbf7d0'}`,
            borderRadius: '10px',
            textAlign: 'left',
          }}>
            <p style={{
              margin: '0 0 12px',
              fontWeight: 600,
              fontSize: '14px',
              color: status === 'error' ? '#dc2626' : '#16a34a',
            }}>
              {status === 'error'
                ? '❌ Error'
                : '✅ Response received (decrypted by @ciph/react — ECDH v2)'}
            </p>
            <pre style={{
              margin: 0,
              fontSize: '13px',
              lineHeight: 1.6,
              overflowX: 'auto',
              color: '#111827',
              background: 'transparent',
            }}>
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}

        {/* Employees table */}
        <div style={{ width: '100%', maxWidth: '860px', marginTop: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Employees <span style={{ color: 'var(--text-2)', fontWeight: 400, fontSize: '13px' }}>GET /api/employees (encrypted)</span>
            </h2>
            <button
              onClick={fetchEmployees}
              disabled={empLoading}
              style={{ padding: '5px 12px', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }}
            >
              {empLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {empError && (
            <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '8px' }}>{empError}</p>
          )}

          {!empLoading && employees.length > 0 && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['ID', 'Name', 'Role', 'Dept', 'Salary', 'Joined', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, i) => (
                    <tr key={emp.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '9px 14px', color: '#6b7280' }}>{emp.id}</td>
                      <td style={{ padding: '9px 14px', fontWeight: 500, color: '#111827' }}>{emp.name}</td>
                      <td style={{ padding: '9px 14px', color: '#374151' }}>{emp.role}</td>
                      <td style={{ padding: '9px 14px', color: '#374151' }}>{emp.dept}</td>
                      <td style={{ padding: '9px 14px', color: '#374151' }}>${emp.salary.toLocaleString()}</td>
                      <td style={{ padding: '9px 14px', color: '#6b7280' }}>{emp.joined}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          background: emp.status === 'active' ? '#dcfce7' : '#f3f4f6',
                          color: emp.status === 'active' ? '#16a34a' : '#6b7280'
                        }}>
                          {emp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {empLoading && (
            <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: '13px', padding: '20px 0' }}>Loading encrypted data…</p>
          )}
        </div>
      </section>

      <div className="ticks" />

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon" />
          </svg>
          <h2>Debug</h2>
          <p>Use Ciph devtools to inspect encrypted traffic in plain text.</p>
          <ul>
            <li>
              <a href="http://localhost:4321" target="_blank" rel="noopener noreferrer">
                Backend Inspector (port 4321)
              </a>
            </li>
          </ul>
        </div>
      </section>
    </>
  )
}

export default App