import { useEffect, useRef, useState } from "react"
import type { CiphClientLog } from "@ciph/core"

import type { CiphClient } from "../client"

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string
  log: CiphClientLog
  receivedAt: number
}

export interface CiphDevtoolsPanelProps {
  maxLogs?: number
  defaultOpen?: boolean
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "bottom" | "top" | "left" | "right"
  client?: CiphClient
}

type EdgeSide = "top" | "bottom" | "left" | "right"
interface BtnSnap { side: EdgeSide; offset: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: number): string {
  if (status >= 500) return "#f87171"
  if (status >= 400) return "#fb923c"
  if (status >= 200) return "#4ade80"
  return "#a1a5b7"
}

function methodColor(method: string): { bg: string; text: string } {
  const m: Record<string, { bg: string; text: string }> = {
    GET:    { bg: "rgba(96,165,250,0.15)", text: "#60a5fa" },
    POST:   { bg: "rgba(74,222,128,0.15)", text: "#4ade80" },
    PUT:    { bg: "rgba(251,146,60,0.15)", text: "#fb923c" },
    PATCH:  { bg: "rgba(216,180,254,0.15)", text: "#d8b4fe" },
    DELETE: { bg: "rgba(248,113,113,0.15)", text: "#f87171" },
  }
  return m[method] ?? { bg: "rgba(156,164,200,0.1)", text: "#a1a5b7" }
}

function fmtBody(v: unknown): string {
  if (v === null || v === undefined) return "—"
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

function trunc(s: string | null | undefined): string {
  if (!s) return "—"
  return s.length > 120 ? s.slice(0, 120) + "…" : s
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(v, hi))
}

/** Snap a drag point to the nearest screen edge, returning edge+offset. */
function snapToEdge(clientX: number, clientY: number): BtnSnap {
  const W = window.innerWidth
  const H = window.innerHeight
  const dl = clientX
  const dr = W - clientX
  const dt = clientY
  const db = H - clientY
  const min = Math.min(dl, dr, dt, db)
  if (min === db) return { side: "bottom", offset: clamp(clientX - 45, 8, W - 100) }
  if (min === dt) return { side: "top",    offset: clamp(clientX - 45, 8, W - 100) }
  if (min === dl) return { side: "left",   offset: clamp(clientY - 18, 8, H - 44) }
  return                 { side: "right",  offset: clamp(clientY - 18, 8, H - 44) }
}

/** CSS for toggle button from snapped edge position. */
function btnStyleFromSnap(snap: BtnSnap): React.CSSProperties {
  const base: React.CSSProperties = { position: "fixed", zIndex: 1000001 }
  const pad = 16
  if (snap.side === "bottom") return { ...base, bottom: pad, left: snap.offset }
  if (snap.side === "top")    return { ...base, top:    pad, left: snap.offset }
  if (snap.side === "left")   return { ...base, left:   pad, top:  snap.offset }
  return                             { ...base, right:  pad, top:  snap.offset }
}

/** Default button position from the `position` prop (before user drags). */
function defaultBtnStyle(pos: string = "bottom-right"): React.CSSProperties {
  const base: React.CSSProperties = { position: "fixed", zIndex: 1000001 }
  if (pos === "bottom-right") return { ...base, bottom: 20, right: 20 }
  if (pos === "bottom-left")  return { ...base, bottom: 20, left:  20 }
  if (pos === "top-right")    return { ...base, top:    20, right: 20 }
  if (pos === "top-left")     return { ...base, top:    20, left:  20 }
  if (pos === "bottom")       return { ...base, bottom: 20, left: "50%", transform: "translateX(-50%)" }
  if (pos === "top")          return { ...base, top:    20, left: "50%", transform: "translateX(-50%)" }
  if (pos === "left")         return { ...base, left:   20, bottom: "30%" }
  if (pos === "right")        return { ...base, right:  20, bottom: "30%" }
  return { ...base, bottom: 20, right: 20 }
}

/** Floating panel (non-docked) position — anchored near the button snap. */
function floatingPanelStyle(snap: BtnSnap | null, pos: string): React.CSSProperties {
  const PANEL_W = 860
  const PANEL_H = 560
  const base: React.CSSProperties = { position: "fixed", width: PANEL_W, height: PANEL_H, zIndex: 999998 }
  const W = typeof window !== "undefined" ? window.innerWidth  : 1440
  const H = typeof window !== "undefined" ? window.innerHeight : 900
  const side: EdgeSide = snap?.side
    ?? (pos.includes("bottom") ? "bottom" : pos.includes("top") ? "top" : pos === "left" ? "left" : "right")

  if (side === "bottom") {
    const btnLeft = snap?.offset ?? W - 100
    return { ...base, bottom: 60, left: clamp(btnLeft - PANEL_W + 100, 8, W - PANEL_W - 8) }
  }
  if (side === "top") {
    const btnLeft = snap?.offset ?? W - 100
    return { ...base, top: 60, left: clamp(btnLeft - PANEL_W + 100, 8, W - PANEL_W - 8) }
  }
  if (side === "left") {
    const btnTop = snap?.offset ?? H - 44
    return { ...base, left: 60, top: clamp(btnTop - PANEL_H + 44, 8, H - PANEL_H - 8) }
  }
  // right
  const btnTop = snap?.offset ?? H - 44
  return { ...base, right: 60, top: clamp(btnTop - PANEL_H + 44, 8, H - PANEL_H - 8) }
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function DevtoolsPanel({
  maxLogs = 500,
  defaultOpen = false,
  position = "bottom-right",
  client,
}: CiphDevtoolsPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)

  // Docked panel resize
  const isDocked = !position.includes("-")
  const [panelSize, setPanelSize] = useState(() => position === "left" || position === "right" ? 500 : 350)
  const panelDragRef = useRef(false)

  // Toggle button drag-to-snap
  const [btnSnap, setBtnSnap] = useState<BtnSnap | null>(null)
  const [liveDragXY, setLiveDragXY] = useState<{ x: number; y: number } | null>(null)
  const btnDragRef = useRef<{ active: boolean; hasMoved: boolean }>({ active: false, hasMoved: false })

  const logsRef = useRef<LogEntry[]>([])

  // ── Docked panel resize ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isDocked) return
    const onMouseMove = (e: MouseEvent) => {
      if (!panelDragRef.current) return
      if (position === "bottom") setPanelSize(Math.max(200, window.innerHeight - e.clientY))
      else if (position === "top") setPanelSize(Math.max(200, e.clientY))
      else if (position === "right") setPanelSize(Math.max(300, window.innerWidth - e.clientX))
      else if (position === "left") setPanelSize(Math.max(300, e.clientX))
    }
    const onMouseUp = () => { panelDragRef.current = false }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [isDocked, position])

  // ── Toggle button edge-drag ───────────────────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!btnDragRef.current.active) return
      btnDragRef.current.hasMoved = true
      setLiveDragXY({ x: e.clientX - 45, y: e.clientY - 18 })
    }
    const onMouseUp = (e: MouseEvent) => {
      if (!btnDragRef.current.active) return
      btnDragRef.current.active = false
      if (btnDragRef.current.hasMoved) {
        setBtnSnap(snapToEdge(e.clientX, e.clientY))
        setLiveDragXY(null)
      } else {
        // click — no drag movement
        setLiveDragXY(null)
        setOpen(o => !o)
      }
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [])

  // ── Log subscription ──────────────────────────────────────────────────────
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

  const sel: LogEntry | null = (selected !== null ? entries[selected] : null) ?? null

  const colors = {
    bg: "#0a0e27", bg2: "#0f1423", bg3: "#151b3a", bg4: "#1a1f4f",
    border: "#2d3e7a", border2: "#1a2555", text: "#f0f4ff", text2: "#9ca4c8",
  }

  // Compute toggle button style
  const toggleBtnStyle: React.CSSProperties = liveDragXY
    ? { position: "fixed", left: liveDragXY.x, top: liveDragXY.y, zIndex: 1000001, cursor: "grabbing" }
    : btnSnap
      ? btnStyleFromSnap(btnSnap)
      : defaultBtnStyle(position)

  return (
    <>
      {/* Docked panel */}
      {open && isDocked && (
        <div style={{
          position: "fixed",
          ...(position === "bottom" ? { bottom: 0, left: 0, right: 0, height: panelSize } : {}),
          ...(position === "top"    ? { top: 0, left: 0, right: 0, height: panelSize } : {}),
          ...(position === "left"   ? { top: 0, bottom: 0, left: 0, width: panelSize } : {}),
          ...(position === "right"  ? { top: 0, bottom: 0, right: 0, width: panelSize } : {}),
          zIndex: 999998,
          boxShadow: "0 0 32px rgba(0,0,0,0.4)",
          background: colors.bg,
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif",
          fontSize: 13, color: colors.text,
          borderTop:    position === "bottom" ? `1px solid ${colors.border}` : undefined,
          borderBottom: position === "top"    ? `1px solid ${colors.border}` : undefined,
          borderRight:  position === "left"   ? `1px solid ${colors.border}` : undefined,
          borderLeft:   position === "right"  ? `1px solid ${colors.border}` : undefined,
        }}>
          {/* Resize handle */}
          <div
            onMouseDown={(e) => { e.preventDefault(); panelDragRef.current = true }}
            style={{
              position: "absolute", zIndex: 999999,
              cursor: position === "top" || position === "bottom" ? "ns-resize" : "ew-resize",
              ...(position === "bottom" ? { top: -2, left: 0, right: 0, height: 6 } : {}),
              ...(position === "top"    ? { bottom: -2, left: 0, right: 0, height: 6 } : {}),
              ...(position === "left"   ? { top: 0, bottom: 0, right: -2, width: 6 } : {}),
              ...(position === "right"  ? { top: 0, bottom: 0, left: -2, width: 6 } : {}),
            }}
          />
          <PanelContent
            colors={colors}
            entries={entries}
            selected={selected}
            setSelected={setSelected}
            sel={sel}
            onClear={() => { logsRef.current = []; setEntries([]); setSelected(null) }}
            onClose={() => setOpen(false)}

            client={client}
            isRequesting={isRequesting}
            setIsRequesting={setIsRequesting}
          />
        </div>
      )}

      {/* Floating panel (non-docked) */}
      {open && !isDocked && (
        <div style={{
          ...floatingPanelStyle(btnSnap, position),
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif",
          fontSize: 13, color: colors.text,
        }}>
          <PanelContent
            colors={colors}
            entries={entries}
            selected={selected}
            setSelected={setSelected}
            sel={sel}
            onClear={() => { logsRef.current = []; setEntries([]); setSelected(null) }}
            onClose={() => setOpen(false)}

            client={client}
            isRequesting={isRequesting}
            setIsRequesting={setIsRequesting}
          />
        </div>
      )}

      {/* Toggle button — draggable, snaps to screen edge */}
      <button
        onMouseDown={(e) => {
          if (e.button !== 0) return
          e.preventDefault()
          btnDragRef.current = { active: true, hasMoved: false }
        }}
        style={{
          ...toggleBtnStyle,
          padding: "8px 14px 8px 10px",
          background: open ? "rgba(25, 25, 63, 0.8)" : "rgba(10, 14, 39, 0.8)",
          backdropFilter: "blur(8px)",
          borderRadius: 9999,
          border: "1px solid rgba(99,102,241,0.3)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          userSelect: "none",
          cursor: liveDragXY ? "grabbing" : "grab",
          transition: "all 0.2s ease",
        }}
        title="Drag to move · Click to toggle"
      >
        {/* Ciph wordmark SVG */}
        <svg width="48" height="18" viewBox="0 0 140 53" fill="none" aria-label="Ciph">
          <path d="M53.95 0C60.8535 6.18481e-05 66.45 5.59648 66.45 12.5C66.45 17.9216 62.998 22.5361 58.1723 24.2677C57.6991 24.4375 57.3892 24.9076 57.4619 25.405L61.2026 50.995C61.2908 51.5985 60.823 52.1396 60.2131 52.1396H47.6868C47.077 52.1396 46.6092 51.5985 46.6974 50.995L50.4371 25.405C50.5098 24.9075 50.2 24.4375 49.7268 24.2677C44.9014 22.5359 41.45 17.9214 41.45 12.5C41.45 5.59644 47.0464 0 53.95 0Z" fill="white"/>
          <path d="M78.45 52.05C77.3454 52.05 76.45 51.1546 76.45 50.05V16.5C76.45 15.3954 77.3454 14.5 78.45 14.5H82.1483C83.2137 14.5 84.0921 15.3352 84.1458 16.3993L84.3022 19.5019C84.3255 19.9642 83.8841 20.3102 83.4408 20.1772C83.1069 20.0771 82.9014 19.7358 83.0119 19.4052C83.3023 18.5368 83.815 17.735 84.55 17C85.45 16.1 86.5833 15.3833 87.95 14.85C89.35 14.2833 90.8167 14 92.35 14C94.6167 14 96.6333 14.6 98.4 15.8C100.167 16.9667 101.55 18.5833 102.55 20.65C103.583 22.6833 104.1 25.05 104.1 27.75C104.1 30.4167 103.583 32.7833 102.55 34.85C101.55 36.9167 100.15 38.55 98.35 39.75C96.5833 40.9167 94.55 41.5 92.25 41.5C90.75 41.5 89.3167 41.2167 87.95 40.65C86.5833 40.0833 85.4333 39.3167 84.5 38.35C83.7677 37.5915 83.2303 36.7817 82.8879 35.9207C82.7285 35.5197 82.9567 35.084 83.3602 34.9313C83.911 34.7229 84.5 35.1298 84.5 35.7187V50.05C84.5 51.1546 83.6046 52.05 82.5 52.05H78.45ZM90.3 34.75C91.5 34.75 92.55 34.4667 93.45 33.9C94.35 33.3 95.05 32.4833 95.55 31.45C96.05 30.4167 96.3 29.1833 96.3 27.75C96.3 26.35 96.05 25.1333 95.55 24.1C95.05 23.0333 94.35 22.2167 93.45 21.65C92.5833 21.05 91.5333 20.75 90.3 20.75C89.0667 20.75 88 21.0333 87.1 21.6C86.2 22.1667 85.5 22.9833 85 24.05C84.5 25.1167 84.25 26.35 84.25 27.75C84.25 29.1833 84.5 30.4167 85 31.45C85.5 32.4833 86.2 33.3 87.1 33.9C88 34.4667 89.0667 34.75 90.3 34.75Z" fill="white"/>
          <path d="M18.15 52.2C15.5167 52.2 13.0833 51.7667 10.85 50.9C8.65 50 6.73333 48.75 5.1 47.15C3.46667 45.5167 2.2 43.6 1.3 41.4C0.433333 39.1667 0 36.7167 0 34.05C0 31.45 0.466667 29.05 1.4 26.85C2.33333 24.65 3.61667 22.75 5.25 21.15C6.91667 19.5167 8.86667 18.25 11.1 17.35C13.3667 16.45 15.8333 16 18.5 16C20.1667 16 21.8 16.2167 23.4 16.65C25 17.0833 26.4833 17.7333 27.85 18.6C28.7261 19.1215 29.524 19.7083 30.2434 20.3604C30.9798 21.0277 30.9648 22.1551 30.3109 22.9034L27.6908 25.9014C26.917 26.7867 25.5578 26.8011 24.6204 26.0912C24.417 25.9372 24.2102 25.7902 24 25.65C23.2333 25.0833 22.3833 24.65 21.45 24.35C20.5167 24.05 19.5167 23.9 18.45 23.9C17.1167 23.9 15.85 24.15 14.65 24.65C13.4833 25.1167 12.45 25.8 11.55 26.7C10.6833 27.5667 10 28.6333 9.5 29.9C9 31.1667 8.75 32.5833 8.75 34.15C8.75 35.6833 9 37.0833 9.5 38.35C10 39.5833 10.7 40.65 11.6 41.55C12.5 42.45 13.5833 43.1333 14.85 43.6C16.15 44.0667 17.5833 44.3 19.15 44.3C20.2167 44.3 21.2333 44.15 22.2 43.85C23.1667 43.55 24.05 43.15 24.85 42.65C24.9287 42.5996 25.0066 42.5486 25.0835 42.497C26.1666 41.7711 27.7257 41.9212 28.4213 43.024L30.3459 46.0752C30.822 46.8299 30.7501 47.8232 30.058 48.3864C29.4121 48.9119 28.6594 49.3998 27.8 49.85C26.4333 50.5833 24.9 51.1667 23.2 51.6C21.5333 52 19.85 52.2 18.15 52.2Z" fill="white"/>
          <path d="M115.75 52C114.839 52 114.1 51.2613 114.1 50.35V17C114.1 15.8954 114.995 15 116.1 15H119.95C121.055 15 121.95 15.8954 121.95 17V30.4151C121.95 30.6767 121.788 30.9109 121.543 31.0027C121.055 31.1855 120.589 30.734 120.821 30.2681C121.191 29.5279 121.684 28.8385 122.3 28.2C123.267 27.2 124.417 26.4 125.75 25.8C127.083 25.2 128.483 24.9 129.95 24.9C131.95 24.9 133.633 25.3167 135 26.15C136.367 26.95 137.4 28.1667 138.1 29.8C138.8 31.4 139.15 33.3667 139.15 35.7V50C139.15 51.1046 138.255 52 137.15 52H133.1C131.995 52 131.1 51.1046 131.1 50V36.35C131.1 35.2833 130.95 34.4 130.65 33.7C130.35 33 129.883 32.4833 129.25 32.15C128.65 31.7833 127.9 31.6167 127 31.65C126.3 31.65 125.65 31.7667 125.05 32C124.45 32.2 123.933 32.5167 123.5 32.95C123.067 33.35 122.717 33.8167 122.45 34.35C122.217 34.8833 122.1 35.4667 122.1 36.1V50C122.1 51.1046 121.205 52 120.1 52H118.15C117.217 52 116.417 52 115.75 52Z" fill="white"/>
        </svg>
        {entries.length > 0 && (
          <span style={{ background: "rgba(99,102,241,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 9999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
            {entries.length}
          </span>
        )}
      </button>
    </>
  )
}

// ─── Panel content (shared between docked & floating) ─────────────────────────

interface PanelContentProps {
  colors: { bg: string; bg2: string; bg3: string; border: string; text: string; text2: string }
  entries: LogEntry[]
  selected: number | null
  setSelected: (i: number) => void
  sel: LogEntry | null
  onClear: () => void
  onClose: () => void
  client: CiphClient | undefined
  isRequesting: boolean
  setIsRequesting: (v: boolean) => void
}

function PanelContent({ colors, entries, selected, setSelected, sel, onClear, onClose, client, isRequesting, setIsRequesting }: PanelContentProps) {
  return (
    <>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${colors.bg2} 0%, ${colors.bg3} 100%)`, borderBottom: `1px solid ${colors.border}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>🛡️ Ciph</span>
        <span style={{ fontSize: 11, background: colors.bg3, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "3px 8px", color: colors.text2, fontWeight: 500 }}>
          {entries.length} {entries.length === 1 ? "request" : "requests"}
        </span>
        <span style={{ fontSize: 10, color: colors.text2, background: "rgba(99,102,241,0.1)", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "3px 7px", fontWeight: 500 }}>client</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClear}
          style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg3, color: colors.text2, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500, transition: "all 0.2s ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = colors.text; e.currentTarget.style.borderColor = "#6366f1" }}
          onMouseLeave={(e) => { e.currentTarget.style.color = colors.text2; e.currentTarget.style.borderColor = colors.border }}
        >Clear</button>
        <button
          onClick={onClose}
          style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg3, color: colors.text2, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500, transition: "all 0.2s ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = colors.text; e.currentTarget.style.borderColor = "#f87171" }}
          onMouseLeave={(e) => { e.currentTarget.style.color = colors.text2; e.currentTarget.style.borderColor = colors.border }}
        >✕</button>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Log list */}
        <div style={{ width: "480px", borderRight: `1px solid ${colors.border}`, overflowY: "auto", flexShrink: 0 }}>
          <div style={{ position: "sticky", top: 0, background: colors.bg2, borderBottom: `1px solid ${colors.border}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: "12px", color: colors.text2, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
            <span style={{ minWidth: "60px" }}>Method</span><span style={{ flex: 1, minWidth: "200px" }}>Route</span><span style={{ minWidth: "50px", textAlign: "center" }}>Status</span><span style={{ minWidth: "50px", textAlign: "right" }}>Time</span>
          </div>
          {entries.length === 0 && (
            <div style={{ padding: 24, color: colors.text2, fontSize: 13, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ opacity: 0.5, fontSize: 24 }}>○</div>
              <div>No requests yet.<br /><span style={{ fontSize: 11, color: colors.text2, opacity: 0.7 }}>Make an API call to see logs</span></div>
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
                  padding: "11px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderBottom: `1px solid ${colors.border2}`,
                  borderLeft: `3px solid ${isSel ? "#60a5fa" : e.log.status >= 400 ? (e.log.status >= 500 ? "#f87171" : "#fb923c") : "transparent"}`,
                  cursor: "pointer",
                  background: isSel ? colors.bg4 : "transparent",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = colors.bg3 }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent" }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 6px", borderRadius: 6, background: mc.bg, color: mc.text, textAlign: "center", minWidth: 60 }}>
                  {e.log.method}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: colors.text, fontSize: 12, flex: 1, minWidth: 200 }}>
                  {e.log.route}
                </span>
                <span style={{ color: statusColor(e.log.status), fontWeight: 600, fontSize: 12, textAlign: "center", minWidth: 50 }}>{e.log.status || "…"}</span>
                <span style={{ color: colors.text2, fontSize: 12, textAlign: "right", minWidth: 50 }}>{e.log.duration}ms</span>
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
              <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {(() => { const mc = methodColor(sel.log.method); return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: mc.bg, color: mc.text }}>{sel.log.method}</span> })()}
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{sel.log.route}</span>
                  <span style={{ fontWeight: 700, color: statusColor(sel.log.status) }}>{sel.log.status || "…"}</span>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: sel.log.excluded ? colors.bg3 : "#0d1b2e", color: sel.log.excluded ? colors.text2 : "#58a6ff" }}>
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
                            await (client as any)[m](sel.log.route, sel.log.request.plainBody, { headers: sel.log.request.headers })
                          } else {
                            await (client as any)[m](sel.log.route, { headers: sel.log.request.headers })
                          }
                        } finally {
                          setIsRequesting(false)
                        }
                      }}
                      style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: isRequesting ? colors.bg2 : "#0d2010", color: isRequesting ? colors.text2 : "#3fb950", cursor: isRequesting ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "inherit" }}
                    >
                      {isRequesting ? "Sending..." : "↻ Re-request"}
                    </button>
                  )}
                </div>
                <div style={{ color: colors.text2, fontSize: 10, display: "flex", gap: 12 }}>
                  <span>{sel.log.timestamp}</span>
                  <span>{sel.log.duration}ms</span>
                  <span>fp: {sel.log.fingerprint.value ? sel.log.fingerprint.value.slice(0, 12) + "…" : "—"}</span>
                </div>
              </div>

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
    </>
  )
}

// Tree-shakes entire component in production
export const CiphDevtoolsPanel = process.env.NODE_ENV === "production"
  ? () => null
  : DevtoolsPanel
