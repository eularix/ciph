import { useEffect, useState, useMemo } from 'react'
import { CiphDevtoolsClient } from '../client.js'
import type { CiphDevtoolsOptions, CiphLogEntry } from '../types.js'

export interface CiphDevtoolsProps extends CiphDevtoolsOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  defaultOpen?: boolean
  shortcut?: string | null
  disabled?: boolean
  inspectorUrl?: string
}

function DevtoolsComponent(props: CiphDevtoolsProps) {
  const {
    defaultOpen = false,
    maxLogs,
    filter,
    disabled = false,
    inspectorUrl = '/ciph-inspector',
  } = props

  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [logs, setLogs] = useState<CiphLogEntry[]>([])

  const client = useMemo(() => new CiphDevtoolsClient({
    ...(maxLogs !== undefined && { maxLogs }),
    ...(filter !== undefined && { filter }),
  }), [maxLogs, filter])


  useEffect(() => {
    if (disabled) return
    client.connect()
    
    // Initial logs load
    setLogs(client.getLogs())

    const unsubscribe = client.onLog(() => {
      setLogs(client.getLogs())
    })

    return () => {
      unsubscribe()
      client.disconnect()
    }
  }, [client, disabled])

  if (disabled || process.env.NODE_ENV === 'production') {
    return null
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, fontFamily: 'system-ui' }}>
      {isOpen && (
        <div style={{ position: 'absolute', bottom: 50, right: 0, width: 450, height: 600, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Ciph Security Inspector</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => window.open(inspectorUrl, '_blank', 'noopener,noreferrer')}
                style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                title="Open full inspector in new tab"
              >
                ↗ Full Inspector
              </button>
              <button onClick={() => client.clearLogs()} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
          <div style={{ padding: 12, flex: 1, overflow: 'auto' }}>
            {logs.length === 0 && <p style={{ color: '#6b7280', fontSize: 14 }}>No requests captured yet.</p>}
            {logs.map(log => (
              <div key={log.id} style={{ marginBottom: 12, padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong style={{ color: log.log.status >= 400 ? '#ef4444' : '#10b981', fontSize: 14 }}>{log.log.method} {log.log.route}</strong>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{log.source}</span>
                </div>
                <div style={{ fontSize: 13, background: '#f3f4f6', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
                  <pre style={{ margin: 0 }}>{JSON.stringify(log.log.request.plainBody, null, 2) || 'No body'}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={() => setIsOpen(!isOpen)} style={{ padding: '10px 16px', background: '#111827', color: 'white', borderRadius: 24, border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600 }}>
        🛡️ Ciph Inspector
      </button>
    </div>
  )
}

// Tree-shakes the entire component body in production
export const CiphDevtools = process.env.NODE_ENV === 'production'
  ? () => null
  : DevtoolsComponent
