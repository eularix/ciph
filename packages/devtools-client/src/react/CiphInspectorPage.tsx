import { useEffect, useState, useCallback } from 'react'
import type { CiphLogEntry } from '../types.js'

const BROADCAST_CHANNEL = 'ciph-devtools'

function statusColor(status: number): string {
  if (status >= 500) return '#f85149'
  if (status >= 400) return '#d29922'
  return '#3fb950'
}

function methodBg(method: string): { background: string; color: string } {
  const map: Record<string, { background: string; color: string }> = {
    GET:    { background: '#0d1b2e', color: '#58a6ff' },
    POST:   { background: '#0d2010', color: '#3fb950' },
    PUT:    { background: '#1e1500', color: '#d29922' },
    PATCH:  { background: '#1a0d2e', color: '#bc8cff' },
    DELETE: { background: '#2e0d0d', color: '#f85149' },
  }
  return map[method] ?? { background: '#1c2230', color: '#e6edf3' }
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—'
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

function truncate(s: string | undefined, n = 120): string {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

const S = {
  page: {
    margin: 0, padding: 0, background: '#0f1117', color: '#e6edf3',
    fontFamily: "'Menlo','Monaco','Consolas',monospace", fontSize: 13,
    height: '100vh', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
  },
  header: {
    background: '#161b22', borderBottom: '1px solid #30363d',
    padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
  },
  dot: (live: boolean) => ({
    width: 8, height: 8, borderRadius: '50%',
    background: live ? '#3fb950' : '#f85149',
    boxShadow: live ? '0 0 6px #3fb950' : 'none',
    flexShrink: 0,
  }),
  badge: {
    background: '#1c2230', border: '1px solid #30363d', borderRadius: 10,
    padding: '2px 8px', fontSize: 11, color: '#8b949e',
  },
  btn: {
    padding: '5px 12px', borderRadius: 6, border: '1px solid #30363d',
    background: '#1c2230', color: '#8b949e', cursor: 'pointer', fontSize: 12,
    fontFamily: 'inherit',
  },
  main: { display: 'flex', flex: 1, overflow: 'hidden' },
  listWrap: {
    width: 400, borderRight: '1px solid #30363d', display: 'flex',
    flexDirection: 'column' as const, overflow: 'hidden', flexShrink: 0,
  },
  listHead: {
    position: 'sticky' as const, top: 0, background: '#161b22',
    borderBottom: '1px solid #30363d', padding: '8px 12px',
    display: 'grid', gridTemplateColumns: '60px 1fr 50px 50px',
    gap: 8, fontSize: 11, color: '#8b949e', textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  },
  listScroll: { overflowY: 'auto' as const, flex: 1 },
  row: (selected: boolean, isErr: boolean) => ({
    padding: '9px 12px', display: 'grid', gridTemplateColumns: '60px 1fr 50px 50px',
    gap: 8, borderBottom: '1px solid #30363d', cursor: 'pointer', alignItems: 'center',
    background: selected ? '#1c2230' : 'transparent',
    borderLeft: selected ? '2px solid #58a6ff' : isErr ? '2px solid #f85149' : '2px solid transparent',
  }),
  detail: { flex: 1, overflowY: 'auto' as const, padding: 20 },
  codeBlock: {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 6,
    padding: 12, overflowX: 'auto' as const, marginBottom: 4,
  },
  pre: { margin: 0, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const, color: '#e6edf3' },
  cols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  sectionTitle: {
    fontSize: 11, color: '#8b949e', textTransform: 'uppercase' as const,
    letterSpacing: '0.5px', marginBottom: 6, display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
  },
  copyBtn: {
    fontSize: 10, padding: '2px 6px', cursor: 'pointer', border: '1px solid #30363d',
    background: '#0f1117', color: '#8b949e', borderRadius: 4, fontFamily: 'inherit',
  },
}

export function CiphInspectorPage() {
  const [logs, setLogs] = useState<CiphLogEntry[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return

    const ch = new BroadcastChannel(BROADCAST_CHANNEL)
    setLive(true)

    ch.onmessage = (ev: MessageEvent<CiphLogEntry>) => {
      setLogs(prev => {
        const next = [ev.data, ...prev]
        if (next.length > 500) next.pop()
        return next
      })
      setSelected(prev => prev === null ? 0 : prev)
    }

    return () => {
      ch.close()
      setLive(false)
    }
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    setSelected(null)
  }, [])

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }, [])

  const selectedLog = selected !== null ? logs[selected] : null

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.dot(live)} />
        <span style={{ fontSize: 15, fontWeight: 600 }}>🔒 Ciph Inspector</span>
        <span style={{ fontSize: 11, color: '#8b949e' }}>{live ? 'Live — listening for requests' : 'Waiting for BroadcastChannel…'}</span>
        <div style={{ flex: 1 }} />
        <span style={S.badge}>{logs.length} request{logs.length !== 1 ? 's' : ''}</span>
        <button style={S.btn} onClick={clearLogs}>Clear</button>
      </div>

      {/* Body */}
      <div style={S.main}>
        {/* Log list */}
        <div style={S.listWrap}>
          <div style={S.listHead}>
            <span>Method</span><span>Route</span><span>Status</span><span>Time</span>
          </div>
          <div style={S.listScroll}>
            {logs.length === 0 && (
              <div style={{ padding: '24px 16px', color: '#8b949e', fontSize: 13 }}>
                {live
                  ? 'Make requests from the app tab — they will appear here.'
                  : 'BroadcastChannel not available in this browser.'}
              </div>
            )}
            {logs.map((entry, i) => {
              const { log } = entry
              const isErr = log.status >= 400
              const mStyle = methodBg(log.method)
              return (
                <div
                  key={entry.id}
                  style={S.row(selected === i, isErr)}
                  onClick={() => setSelected(i)}
                >
                  <span style={{ ...mStyle, fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 4, textAlign: 'center' }}>
                    {log.method}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{log.route}</span>
                  <span style={{ color: statusColor(log.status), fontSize: 12, fontWeight: 600 }}>{log.status}</span>
                  <span style={{ color: '#8b949e', fontSize: 11 }}>{log.duration}ms</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div style={S.detail}>
          {!selectedLog && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8b949e', fontSize: 14 }}>
              ← Select a request to inspect
            </div>
          )}
          {selectedLog && (() => {
            const { log } = selectedLog
            const reqPlain = fmt(log.request.plainBody)
            const resPlain = fmt(log.response?.plainBody)
            const reqEnc: string = (log.request as { encryptedBody?: string }).encryptedBody ?? ''
            const resEnc: string = (log.response as { encryptedBody?: string })?.encryptedBody ?? ''
            const fp = (log as { fingerprint?: { value?: string; ipMatch?: boolean; uaMatch?: boolean } }).fingerprint ?? {}
            const mStyle = methodBg(log.method)

            return (
              <div>
                {/* Title row */}
                <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #30363d' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ ...mStyle, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{log.method}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{log.route}</span>
                    <span style={{ color: statusColor(log.status), fontWeight: 600 }}>{log.status}</span>
                    {!log.excluded && <span style={{ background: '#0d1b2e', color: '#58a6ff', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>🔒 Encrypted</span>}
                    {log.excluded && <span style={{ background: '#1c2230', color: '#8b949e', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>○ Plain</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#8b949e' }}>
                    <span>{selectedLog.timestamp}</span>
                    <span>{log.duration}ms</span>
                    <span>{selectedLog.source}</span>
                  </div>
                </div>

                {/* Bodies */}
                <div style={S.cols}>
                  <div>
                    <div style={S.sectionTitle}><span>Request Body (Plain)</span></div>
                    <div style={S.codeBlock}><pre style={S.pre}>{reqPlain}</pre></div>
                  </div>
                  <div>
                    <div style={S.sectionTitle}><span>Response Body (Plain)</span></div>
                    <div style={S.codeBlock}><pre style={S.pre}>{resPlain}</pre></div>
                  </div>
                </div>

                <div style={S.cols}>
                  <div>
                    <div style={S.sectionTitle}>
                      <span>Request Encrypted</span>
                      <button style={S.copyBtn} onClick={() => copy(reqEnc)}>Copy</button>
                    </div>
                    <div style={S.codeBlock}><pre style={S.pre}>{truncate(reqEnc)}</pre></div>
                  </div>
                  <div>
                    <div style={S.sectionTitle}>
                      <span>Response Encrypted</span>
                      <button style={S.copyBtn} onClick={() => copy(resEnc)}>Copy</button>
                    </div>
                    <div style={S.codeBlock}><pre style={S.pre}>{truncate(resEnc)}</pre></div>
                  </div>
                </div>

                {/* Fingerprint */}
                <div style={{ marginBottom: 16 }}>
                  <div style={S.sectionTitle}><span>Fingerprint</span></div>
                  {[
                    ['Hash', fp.value ?? '—'],
                    ['IP Match', fp.ipMatch !== undefined ? (fp.ipMatch ? '✅' : '❌') : '—'],
                    ['UA Match', fp.uaMatch !== undefined ? (fp.uaMatch ? '✅' : '❌') : '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12 }}>
                      <span style={{ color: '#58a6ff', minWidth: 100 }}>{k}</span>
                      <span style={{ color: '#e6edf3', wordBreak: 'break-all' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
