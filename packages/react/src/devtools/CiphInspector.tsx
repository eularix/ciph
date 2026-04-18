import { useEffect, useRef, useState } from "react"
import type { CiphClientLog } from "@ciph/core"
import { useCiph } from "../context"

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string
  log: CiphClientLog
  receivedAt: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: number): string {
  if (status >= 500) return "#f85149"
  if (status >= 400) return "#d29922"
  if (status >= 200) return "#3fb950"
  return "#8b949e"
}

function methodColor(method: string): { bg: string; text: string } {
  const m: Record<string, { bg: string; text: string }> = {
    GET:    { bg: "#0d1b2e", text: "#58a6ff" },
    POST:   { bg: "#0d2010", text: "#3fb950" },
    PUT:    { bg: "#1e1500", text: "#d29922" },
    PATCH:  { bg: "#1a0d2e", text: "#bc8cff" },
    DELETE: { bg: "#2e0d0d", text: "#f85149" },
  }
  return m[method] ?? { bg: "#1c2230", text: "#8b949e" }
}

function fmtBody(v: unknown): string {
  if (v === null || v === undefined) return "—"
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

function trunc(s: string | null | undefined): string {
  if (!s) return "—"
  return s.length > 120 ? s.slice(0, 120) + "…" : s
}

// ─── Inspector ────────────────────────────────────────────────────────────────

export interface CiphInspectorProps {
  maxLogs?: number
}

function Inspector({ maxLogs = 500 }: CiphInspectorProps) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)
  const logsRef = useRef<LogEntry[]>([])

  // Attempt to grab client. If we are not within CiphProvider, skip re-request
  let client: ReturnType<typeof useCiph> | undefined
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    client = useCiph()
  } catch {
    // Ignore
  }

  useEffect(() => {
    // We expect the global client emitter (which now syncs using BroadcastChannel cross-tab) 
    // to be available.
    const emitter = (globalThis as { __ciphClientEmitter__?: { on: (event: string, cb: (log: CiphClientLog) => void) => () => void } }).__ciphClientEmitter__
    if (!emitter) return

    const unsub = emitter.on("log", (log) => {
      const entry: LogEntry = { id: log.id, log, receivedAt: Date.now() }
      logsRef.current = [entry, ...logsRef.current].slice(0, maxLogs)
      setEntries([...logsRef.current])
    })

    return unsub
  }, [maxLogs])

  const sel = selected !== null ? entries[selected] : null

  const colors = {
    bg: "#0f1117", bg2: "#161b22", bg3: "#1c2230",
    border: "#30363d", text: "#e6edf3", text2: "#8b949e",
  }

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: colors.bg,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily: "'Menlo','Monaco','Consolas',monospace",
      fontSize: 13,
      color: colors.text,
      margin: 0,
    }}>
      {/* Header */}
      <div style={{ background: colors.bg2, borderBottom: `1px solid ${colors.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>🛡️ Ciph Inspector</span>
        <span style={{ fontSize: 11, background: colors.bg3, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "2px 8px", color: colors.text2 }}>
          {entries.length} request{entries.length !== 1 ? "s" : ""}
        </span>
        <span style={{ fontSize: 11, color: colors.text2, background: "#0d2010", border: "1px solid #3fb95033", borderRadius: 6, padding: "2px 6px" }}>client-only ✦</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { logsRef.current = []; setEntries([]); setSelected(null) }}
          style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.bg3, color: colors.text2, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}
        >Clear</button>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Log list */}
        <div style={{ width: 400, borderRight: `1px solid ${colors.border}`, overflowY: "auto", flexShrink: 0 }}>
          <div style={{ position: "sticky", top: 0, background: colors.bg2, borderBottom: `1px solid ${colors.border}`, padding: "8px 12px", display: "grid", gridTemplateColumns: "60px 1fr 50px 46px", gap: 8, color: colors.text2, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>Method</span><span>Route</span><span>Status</span><span>ms</span>
          </div>
          {entries.length === 0 && (
            <div style={{ padding: 30, color: colors.text2, fontSize: 13, textAlign: "center", lineHeight: 1.5 }}>
              No requests yet.<br />Trigger API calls from other tabs.<br />
              <span style={{ fontSize: 11, color: "#58a6ff" }}>(Cross-tab sync is active)</span>
            </div>
          )}
          {entries.map((e, i) => {
            const mc = methodColor(e.log.method)
            const isSel = selected === i
            return (
              <div
                key={e.id}
                onClick={() => setSelected(i)}
                style={{
                  padding: "9px 12px",
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 50px 46px",
                  gap: 8,
                  borderBottom: `1px solid ${colors.border}`,
                  borderLeft: `2px solid ${isSel ? "#58a6ff" : e.log.status >= 400 ? "#f85149" : "transparent"}`,
                  cursor: "pointer",
                  background: isSel ? colors.bg3 : "transparent",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 4px", borderRadius: 4, background: mc.bg, color: mc.text, textAlign: "center" }}>
                  {e.log.method}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: colors.text, fontSize: 12 }}>
                  {e.log.route}
                </span>
                <span style={{ color: statusColor(e.log.status), fontWeight: 600, fontSize: 12 }}>{e.log.status || "…"}</span>
                <span style={{ color: colors.text2, fontSize: 11 }}>{e.log.duration}ms</span>
              </div>
            )
          })}
        </div>

        {/* Detail pane */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {!sel ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: colors.text2, fontSize: 14 }}>
              ← Select a request to inspect
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  {(() => { const mc = methodColor(sel.log.method); return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: mc.bg, color: mc.text }}>{sel.log.method}</span> })()}
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{sel.log.route}</span>
                  <span style={{ fontWeight: 700, color: statusColor(sel.log.status), fontSize: 13 }}>{sel.log.status || "…"}</span>
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: sel.log.excluded ? colors.bg3 : "#0d1b2e", color: sel.log.excluded ? colors.text2 : "#58a6ff" }}>
                    {sel.log.excluded ? "○ Plain" : "🔒 Encrypted"}
                  </span>
                  {client && (
                    <button
                      disabled={isRequesting}
                      onClick={async () => {
                        if (isRequesting) return
                        setIsRequesting(true)
                        try {
                          const m = sel.log.method.toLowerCase()
                          const isBodyMethod = ["post", "put", "patch", "delete"].includes(m)
                          if (isBodyMethod) {
                            await (client as any)[m](sel.log.route, sel.log.request.plainBody, {
                              headers: sel.log.request.headers,
                            })
                          } else {
                            await (client as any)[m](sel.log.route, {
                              headers: sel.log.request.headers,
                            })
                          }
                        } finally {
                          setIsRequesting(false)
                        }
                      }}
                      style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 6, border: `1px solid ${colors.border}`, background: isRequesting ? colors.bg2 : "#0d2010", color: isRequesting ? colors.text2 : "#3fb950", cursor: isRequesting ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit" }}
                    >
                      {isRequesting ? "Sending..." : "↻ Re-request"}
                    </button>
                  )}
                </div>
                <div style={{ color: colors.text2, fontSize: 12, display: "flex", gap: 16 }}>
                  <span>{sel.log.timestamp}</span>
                  <span>{sel.log.duration}ms</span>
                  <span>fp: {sel.log.fingerprint.value ? sel.log.fingerprint.value.slice(0, 16) + "…" : "—"}</span>
                </div>
              </div>

              {/* Body columns */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                {[
                  ["Request (Plain)", fmtBody(sel.log.request.plainBody)],
                  ["Response (Plain)", fmtBody(sel.log.response.plainBody)],
                ].map(([label, content]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
                    <div style={{ background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 12, overflowX: "auto" }}>
                      <pre style={{ margin: 0, color: colors.text, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{content}</pre>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  ["Request Encrypted", trunc(sel.log.request.encryptedBody)],
                  ["Response Encrypted", trunc(sel.log.response.encryptedBody)],
                ].map(([label, content]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
                    <div style={{ background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 12, overflowX: "auto" }}>
                      <pre style={{ margin: 0, color: colors.text2, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{content}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Tree-shakes entire component in production
export const CiphInspector = process.env.NODE_ENV === "production"
  ? () => null
  : Inspector
