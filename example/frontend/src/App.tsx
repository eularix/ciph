import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import { ciph } from './lib/ciph'
import './App.css'

type ApiResponse = {
  received?: { message: string; timestamp: string }
  message?: string
  timestamp?: string
  error?: string
}

type Status = 'idle' | 'success' | 'error'

function App() {
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status>('idle')

  const testCiph = async () => {
    setLoading(true)
    setResponse(null)
    setStatus('idle')
    try {
      const res = await ciph.post<ApiResponse>('/api/echo', {
        message: 'Hello from frontend!',
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
                : '✅ Response received (decrypted by @ciph/client)'}
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