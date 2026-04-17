import { useEffect, useRef, useState } from "react"
import type { CiphClientLog } from "@ciph/core"

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string
  log: CiphClientLog
  receivedAt: number
}

export interface CiphDevtoolsPanelProps {
  maxLogs?: number
  defaultOpen?: boolean
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
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

function positionStyle(pos: CiphDevtoolsPanelProps["position"] = "bottom-right"): React.CSSProperties {
  const base: React.CSSProperties = { position: "fixed", zIndex: 999999 }
  if (pos === "bottom-right") return { ...base, bottom: 20, right: 20 }
  if (pos === "bottom-left")  return { ...base, bottom: 20, left: 20 }
  if (pos === "top-right")    return { ...base, top: 20, right: 20 }
  return { ...base, top: 20, left: 20 }
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function DevtoolsPanel({ maxLogs = 500, defaultOpen = false, position = "bottom-right" }: CiphDevtoolsPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const logsRef = useRef<LogEntry[]>([])

  useEffect(() => {
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
    <div style={positionStyle(position)}>
      {open && (
        <div style={{
          position: "absolute",
          bottom: position.startsWith("bottom") ? 50 : undefined,
          top: position.startsWith("top") ? 50 : undefined,
          right: position.endsWith("right") ? 0 : undefined,
          left: position.endsWith("left") ? 0 : undefined,
          width: 860,
          height: 560,
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Menlo','Monaco','Consolas',monospace",
          fontSize: 12,
          color: colors.text,
        }}>
          {/* Header */}
          <div style={{ background: colors.bg2, borderBottom: `1px solid ${colors.border}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>🛡️ Ciph Inspector</span>
            <span style={{ fontSize: 10, background: colors.bg3, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "2px 8px", color: colors.text2 }}>
              {entries.length} request{entries.length !== 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: 10, color: colors.text2, background: "#0d2010", border: "1px solid #3fb95033", borderRadius: 6, padding: "2px 6px" }}>client-only ✦</span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => { logsRef.current = []; setEntries([]); setSelected(null) }}
              style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.bg3, color: colors.text2, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}
            >Clear</button>
            <button
              onClick={() => setOpen(false)}
              style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.bg3, color: colors.text2, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}
            >✕</button>
          </div>

          {/* Body */}
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* Log list */}
            <div style={{ width: 300, borderRight: `1px solid ${colors.border}`, overflowY: "auto", flexShrink: 0 }}>
              <div style={{ position: "sticky", top: 0, background: colors.bg2, borderBottom: `1px solid ${colors.border}`, padding: "6px 10px", display: "grid", gridTemplateColumns: "52px 1fr 44px 42px", gap: 6, color: colors.text2, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <span>Method</span><span>Route</span><span>Status</span><span>ms</span>
              </div>
              {entries.length === 0 && (
                <div style={{ padding: 20, color: colors.text2, fontSize: 12, textAlign: "center" }}>
                  No requests yet.<br />Make an API call to see logs.
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
                      padding: "7px 10px",
                      display: "grid",
                      gridTemplateColumns: "52px 1fr 44px 42px",
                      gap: 6,
                      borderBottom: `1px solid ${colors.border}`,
                      borderLeft: `2px solid ${isSel ? "#58a6ff" : e.log.status >= 400 ? "#f85149" : "transparent"}`,
                      cursor: "pointer",
                      background: isSel ? colors.bg3 : "transparent",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 4px", borderRadius: 4, background: mc.bg, color: mc.text, textAlign: "center" }}>
                      {e.log.method}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: colors.text, fontSize: 11 }}>
                      {e.log.route}
                    </span>
                    <span style={{ color: statusColor(e.log.status), fontWeight: 600, fontSize: 11 }}>{e.log.status || "…"}</span>
                    <span style={{ color: colors.text2, fontSize: 10 }}>{e.log.duration}ms</span>
                  </div>
                )
              })}
            </div>

            {/* Detail pane */}
            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              {!sel ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: colors.text2, fontSize: 13 }}>
                  ← Select a request to inspect
                </div>
              ) : (
                <>
                  {/* Detail header */}
                  <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      {(() => { const mc = methodColor(sel.log.method); return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: mc.bg, color: mc.text }}>{sel.log.method}</span> })()}
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{sel.log.route}</span>
                      <span style={{ fontWeight: 700, color: statusColor(sel.log.status) }}>{sel.log.status || "…"}</span>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: sel.log.excluded ? colors.bg3 : "#0d1b2e", color: sel.log.excluded ? colors.text2 : "#58a6ff" }}>
                        {sel.log.excluded ? "○ Plain" : "🔒 Encrypted"}
                      </span>
                    </div>
                    <div style={{ color: colors.text2, fontSize: 10, display: "flex", gap: 12 }}>
                      <span>{sel.log.timestamp}</span>
                      <span>{sel.log.duration}ms</span>
                      <span>fp: {sel.log.fingerprint.value ? sel.log.fingerprint.value.slice(0, 12) + "…" : "—"}</span>
                    </div>
                  </div>

                  {/* Body columns */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    {[
                      ["Request (Plain)", fmtBody(sel.log.request.plainBody)],
                      ["Response (Plain)", fmtBody(sel.log.response.plainBody)],
                    ].map(([label, content]) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
                        <div style={{ background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 10, overflowX: "auto" }}>
                          <pre style={{ margin: 0, color: colors.text, fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{content}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      ["Request Encrypted", trunc(sel.log.request.encryptedBody)],
                      ["Response Encrypted", trunc(sel.log.response.encryptedBody)],
                    ].map(([label, content]) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
                        <div style={{ background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 10, overflowX: "auto" }}>
                          <pre style={{ margin: 0, color: colors.text2, fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{content}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "9px 16px",
          background: open ? "#161b22" : "#0d1117",
          color: "#e6edf3",
          borderRadius: 24,
          border: "1px solid #30363d",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: 0.3,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "'Menlo','Monaco','Consolas',monospace",
        }}
      >
        🛡️ Ciph
        {entries.length > 0 && (
          <span style={{ background: "#58a6ff22", color: "#58a6ff", border: "1px solid #58a6ff44", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>
            {entries.length}
          </span>
        )}
      </button>
    </div>
  )
}

// Tree-shakes entire component in production
export const CiphDevtoolsPanel = process.env.NODE_ENV === "production"
  ? () => null
  : DevtoolsPanel
