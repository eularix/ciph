// Mounts the Ciph devtools panel as a standalone Vue app.
// Entire file is dead-code-eliminated in production builds.
import {
  createApp,
  defineComponent,
  ref,
  computed,
  onMounted,
  onUnmounted,
  h,
  type CSSProperties,
} from "vue"
import type { CiphClientLog } from "@ciph/core"
import type { CiphClient } from "../client"
import type { CiphDevtoolsConfig } from "../plugin"

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DevtoolsPanelOptions extends CiphDevtoolsConfig {
  client?: CiphClient
}

let _mounted = false

export function mountDevtoolsPanel(options: DevtoolsPanelOptions = {}): void {
  if (_mounted) return
  _mounted = true

  const host = document.createElement("div")
  host.id = "ciph-devtools-host"
  document.body.appendChild(host)

  const app = createApp(DevtoolsPanelComponent, { options })
  app.mount(host)
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface LogEntry { id: string; log: CiphClientLog; receivedAt: number }
type EdgeSide = "top" | "bottom" | "left" | "right"
interface BtnSnap { side: EdgeSide; offset: number }

type Colors = typeof COLORS
const COLORS = {
  bg: "#0a0e27", bg2: "#0f1423", bg3: "#151b3a", bg4: "#1a1f4f",
  border: "#2d3e7a", border2: "#1a2555", text: "#f0f4ff", text2: "#9ca4c8",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: number): string {
  if (s >= 500) return "#f87171"
  if (s >= 400) return "#fb923c"
  if (s >= 200) return "#4ade80"
  return "#a1a5b7"
}

function methodColors(m: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    GET:    { bg: "rgba(96,165,250,0.15)", text: "#60a5fa" },
    POST:   { bg: "rgba(74,222,128,0.15)", text: "#4ade80" },
    PUT:    { bg: "rgba(251,146,60,0.15)", text: "#fb923c" },
    PATCH:  { bg: "rgba(216,180,254,0.15)", text: "#d8b4fe" },
    DELETE: { bg: "rgba(248,113,113,0.15)", text: "#f87171" },
  }
  return map[m] ?? { bg: "rgba(156,164,200,0.1)", text: "#a1a5b7" }
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

function snapToEdge(cx: number, cy: number): BtnSnap {
  const W = window.innerWidth, H = window.innerHeight
  const min = Math.min(cx, W - cx, cy, H - cy)
  if (min === H - cy) return { side: "bottom", offset: clamp(cx - 45, 8, W - 100) }
  if (min === cy)     return { side: "top",    offset: clamp(cx - 45, 8, W - 100) }
  if (min === cx)     return { side: "left",   offset: clamp(cy - 18, 8, H - 44) }
  return                     { side: "right",  offset: clamp(cy - 18, 8, H - 44) }
}

// ─── Panel inner (log list + detail) ─────────────────────────────────────────

function renderPanelInner(
  c: Colors,
  entries: LogEntry[],
  selected: number | null,
  sel: LogEntry | null,
  isRequesting: boolean,
  hasClient: boolean,
  onSelect: (i: number) => void,
  onClear: () => void,
  onClose: () => void,
  onReRequest: () => void,
): ReturnType<typeof h> {
  const detailPairs: [string, string][] = sel ? [
    ["Request (Plain)", fmtBody(sel.log.request.plainBody)],
    ["Response (Plain)", fmtBody(sel.log.response.plainBody)],
  ] : []
  const encPairs: [string, string][] = sel ? [
    ["Request Encrypted", trunc(sel.log.request.encryptedBody)],
    ["Response Encrypted", trunc(sel.log.response.encryptedBody)],
  ] : []

  const mc = sel ? methodColors(sel.log.method) : null

  return h("div", { style: { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" } }, [
    // Header
    h("div", { style: { background: `linear-gradient(135deg, ${c.bg2} 0%, ${c.bg3} 100%)`, borderBottom: `1px solid ${c.border}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 } as CSSProperties }, [
      h("span", { style: { fontSize: "14px", fontWeight: 700, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } }, "🛡️ Ciph"),
      h("span", { style: { fontSize: "11px", background: c.bg3, border: `1px solid ${c.border}`, borderRadius: "10px", padding: "3px 8px", color: c.text2, fontWeight: 500 } as CSSProperties },
        `${entries.length} ${entries.length === 1 ? "request" : "requests"}`),
      h("span", { style: { fontSize: "10px", color: c.text2, background: "rgba(99,102,241,0.1)", border: `1px solid ${c.border}`, borderRadius: "6px", padding: "3px 7px", fontWeight: 500 } as CSSProperties }, "vue"),
      h("div", { style: { flex: 1 } }),
      h("button", { onClick: onClear, style: { padding: "6px 12px", borderRadius: "8px", border: `1px solid ${c.border}`, background: c.bg3, color: c.text2, cursor: "pointer", fontSize: "12px", fontFamily: "inherit", fontWeight: 500, transition: "all 0.2s ease" } as CSSProperties }, "Clear"),
      h("button", { onClick: onClose, style: { padding: "6px 10px", borderRadius: "8px", border: `1px solid ${c.border}`, background: c.bg3, color: c.text2, cursor: "pointer", fontSize: "12px", fontFamily: "inherit", fontWeight: 500, transition: "all 0.2s ease" } as CSSProperties }, "✕"),
    ]),
    // Body row
    h("div", { style: { display: "flex", flex: 1, overflow: "hidden" } }, [
      // Log list
      h("div", { style: { width: "480px", borderRight: `1px solid ${c.border}`, overflowY: "auto", flexShrink: 0 } as CSSProperties }, [
        h("div", { style: { position: "sticky", top: 0, background: c.bg2, borderBottom: `1px solid ${c.border}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: "12px", color: c.text2, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 } as CSSProperties },
          [h("span", { style: { minWidth: "60px" } }, "Method"), h("span", { style: { flex: 1, minWidth: "200px" } }, "Route"), h("span", { style: { minWidth: "50px", textAlign: "center" } }, "Status"), h("span", { style: { minWidth: "50px", textAlign: "right" } }, "Time")]),
        entries.length === 0
          ? h("div", { style: { padding: "24px", color: c.text2, fontSize: "13px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" } as CSSProperties }, [
              h("div", { style: { opacity: 0.5, fontSize: "24px" } }, "○"),
              h("div", [
                "No requests yet.",
                h("br"),
                h("span", { style: { fontSize: "11px", color: c.text2, opacity: 0.7 } }, "Make an API call to see logs"),
              ]),
            ])
          : entries.map((e, i) => {
              const em = methodColors(e.log.method)
              return h("div", {
                key: e.id,
                onClick: () => onSelect(i),
                style: {
                  padding: "11px 14px", display: "flex", alignItems: "center",
                  gap: "12px", borderBottom: `1px solid ${c.border2}`,
                  borderLeft: `3px solid ${selected === i ? "#60a5fa" : e.log.status >= 400 ? (e.log.status >= 500 ? "#f87171" : "#fb923c") : "transparent"}`,
                  cursor: "pointer", background: selected === i ? c.bg4 : "transparent",
                  transition: "all 0.15s ease",
                } as CSSProperties,
              }, [
                h("span", { style: { fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "6px", background: em.bg, color: em.text, textAlign: "center", minWidth: "60px" } as CSSProperties }, e.log.method),
                h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: c.text, fontSize: "12px", flex: 1, minWidth: "200px" } as CSSProperties }, e.log.route),
                h("span", { style: { color: statusColor(e.log.status), fontWeight: 600, fontSize: "12px", textAlign: "center", minWidth: "50px" } as CSSProperties }, String(e.log.status || "…")),
                h("span", { style: { color: c.text2, fontSize: "12px", textAlign: "right", minWidth: "50px" } as CSSProperties }, `${e.log.duration}ms`),
              ])
            }),
      ]),
      // Detail pane
      h("div", { style: { flex: 1, overflowY: "auto", padding: "20px" } as CSSProperties },
        !sel
          ? [h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: c.text2, fontSize: "13px" } as CSSProperties }, "← Select a request to inspect")]
          : [
              h("div", { style: { marginBottom: "20px", paddingBottom: "14px", borderBottom: `1px solid ${c.border}` } as CSSProperties }, [
                h("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" } }, [
                  h("span", { style: { fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "6px", background: mc!.bg, color: mc!.text } as CSSProperties }, sel.log.method),
                  h("span", { style: { fontWeight: 700, fontSize: "14px" } }, sel.log.route),
                  h("span", { style: { fontWeight: 700, color: statusColor(sel.log.status) } as CSSProperties }, String(sel.log.status || "…")),
                  h("span", { style: { fontSize: "10px", padding: "3px 8px", borderRadius: "6px", background: sel.log.excluded ? "rgba(156,164,200,0.1)" : "rgba(96,165,250,0.15)", color: sel.log.excluded ? c.text2 : "#60a5fa", fontWeight: 600 } as CSSProperties },
                    sel.log.excluded ? "○ Passthrough" : "🔒 Encrypted"),
                  hasClient
                    ? h("button", {
                        disabled: isRequesting, onClick: onReRequest,
                        style: { marginLeft: "auto", padding: "6px 12px", borderRadius: "8px", border: `1px solid ${c.border}`, background: isRequesting ? c.bg2 : "rgba(74,222,128,0.1)", color: isRequesting ? c.text2 : "#4ade80", cursor: isRequesting ? "not-allowed" : "pointer", fontSize: "12px", fontFamily: "inherit", fontWeight: 500 } as CSSProperties,
                      }, isRequesting ? "Sending..." : "↻ Re-request")
                    : null,
                ]),
                h("div", { style: { color: c.text2, fontSize: "11px", display: "flex", gap: "14px", flexWrap: "wrap" } }, [
                  h("span", sel.log.timestamp),
                  h("span", `Duration: ${sel.log.duration}ms`),
                  sel.log.fingerprint.value ? h("span", `Hash: ${sel.log.fingerprint.value.slice(0, 12)}…`) : null,
                ]),
              ]),
              h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" } },
                detailPairs.map(([label, content]) =>
                  h("div", { key: label }, [
                    h("div", { style: { fontSize: "10px", color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", fontWeight: 700 } as CSSProperties }, label.includes("Request") ? "🔓 Request Data" : "🔓 Response Data"),
                    h("div", { style: { background: c.bg2, border: `1px solid ${c.border}`, borderRadius: "10px", padding: "12px", overflowX: "auto" } as CSSProperties },
                      h("pre", { style: { margin: 0, color: c.text, fontSize: "12px", lineHeight: "1.6", whiteSpace: "pre-wrap", wordBreak: "break-all" } as CSSProperties }, content)),
                  ])
                )
              ),
              h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" } },
                encPairs.map(([label, content]) =>
                  h("div", { key: label }, [
                    h("div", { style: { fontSize: "10px", color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", fontWeight: 700 } as CSSProperties }, label.includes("Request") ? "🔐 Request Encrypted" : "🔐 Response Encrypted"),
                    h("div", { style: { background: c.bg2, border: `1px solid ${c.border}`, borderRadius: "10px", padding: "12px", overflowX: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } as CSSProperties }, [
                      h("pre", { style: { margin: 0, color: c.text2, fontSize: "12px", lineHeight: "1.6", whiteSpace: "pre-wrap", wordBreak: "break-all", flex: 1 } as CSSProperties }, content),
                      h("button", {
                        onClick: () => navigator.clipboard.writeText(content).catch(() => {}),
                        style: { padding: "6px 10px", borderRadius: "6px", border: `1px solid ${c.border}`, background: c.bg3, color: c.text2, cursor: "pointer", fontSize: "11px", fontFamily: "inherit", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 } as CSSProperties,
                      }, "📋 Copy"),
                    ]),
                  ])
                )
              ),
            ]
      ),
    ]),
  ])
}

// ─── Main panel component ─────────────────────────────────────────────────────

const DevtoolsPanelComponent = defineComponent({
  name: "CiphDevtoolsPanel",
  props: {
    options: { type: Object as () => DevtoolsPanelOptions, required: true },
  },
  setup(props) {
    const maxLogs = props.options.maxLogs ?? 500
    const position = ref(props.options.position ?? "bottom-right")
    const open = ref(props.options.defaultOpen ?? false)
    const entries = ref<LogEntry[]>([])
    const selected = ref<number | null>(null)
    const isRequesting = ref(false)
    const btnSnap = ref<BtnSnap | null>(null)
    const liveDragXY = ref<{ x: number; y: number } | null>(null)
    const panelSize = ref(position.value === "left" || position.value === "right" ? 500 : 350)
    const panelResizing = ref(false)

    const logsBuffer: LogEntry[] = []
    const btnDrag = { active: false, hasMoved: false }

    const isDocked = computed(() => !position.value.includes("-"))
    const sel = computed<LogEntry | null>(() =>
      selected.value !== null ? (entries.value[selected.value] ?? null) : null
    )

    const toggleBtnStyle = computed((): CSSProperties => {
      const base: CSSProperties = { position: "fixed", zIndex: 1000001 }
      if (liveDragXY.value) return { ...base, left: `${liveDragXY.value.x}px`, top: `${liveDragXY.value.y}px`, cursor: "grabbing" }
      if (btnSnap.value) {
        const s = btnSnap.value
        const pad = "16px"
        if (s.side === "bottom") return { ...base, bottom: pad, left: `${s.offset}px` }
        if (s.side === "top")    return { ...base, top:    pad, left: `${s.offset}px` }
        if (s.side === "left")   return { ...base, left:   pad, top:  `${s.offset}px` }
        return                          { ...base, right:  pad, top:  `${s.offset}px` }
      }
      const pos = position.value
      if (pos === "bottom-right") return { ...base, bottom: "20px", right: "20px" }
      if (pos === "bottom-left")  return { ...base, bottom: "20px", left:  "20px" }
      if (pos === "top-right")    return { ...base, top:    "20px", right: "20px" }
      if (pos === "top-left")     return { ...base, top:    "20px", left:  "20px" }
      if (pos === "bottom")       return { ...base, bottom: "20px", left: "50%", transform: "translateX(-50%)" }
      if (pos === "top")          return { ...base, top:    "20px", left: "50%", transform: "translateX(-50%)" }
      if (pos === "left")         return { ...base, left:   "20px", bottom: "30%" }
      return                             { ...base, right:  "20px", bottom: "30%" }
    })

    const floatingPanelStyle = computed((): CSSProperties => {
      const W = window.innerWidth, H = window.innerHeight
      const PW = 860, PH = 560
      const pos = position.value
      const snap = btnSnap.value
      const side: EdgeSide = snap?.side
        ?? (pos.includes("bottom") ? "bottom" : pos.includes("top") ? "top" : pos === "left" ? "left" : "right")
      const base: CSSProperties = { position: "fixed", width: `${PW}px`, height: `${PH}px`, zIndex: 999998 }
      if (side === "bottom") { const l = snap?.offset ?? W - 100; return { ...base, bottom: "60px", left: `${clamp(l - PW + 100, 8, W - PW - 8)}px` } }
      if (side === "top")    { const l = snap?.offset ?? W - 100; return { ...base, top: "60px", left: `${clamp(l - PW + 100, 8, W - PW - 8)}px` } }
      if (side === "left")   { const t = snap?.offset ?? H - 44; return { ...base, left: "60px", top: `${clamp(t - PH + 44, 8, H - PH - 8)}px` } }
      const t = snap?.offset ?? H - 44
      return { ...base, right: "60px", top: `${clamp(t - PH + 44, 8, H - PH - 8)}px` }
    })

    const dockedPanelStyle = computed((): CSSProperties => {
      const pos = position.value
      const sz = `${panelSize.value}px`
      const base: CSSProperties = { position: "fixed", zIndex: 999998 }
      if (pos === "bottom") return { ...base, bottom: 0, left: 0, right: 0, height: sz }
      if (pos === "top")    return { ...base, top: 0, left: 0, right: 0, height: sz }
      if (pos === "left")   return { ...base, top: 0, bottom: 0, left: 0, width: sz }
      return                       { ...base, top: 0, bottom: 0, right: 0, width: sz }
    })

    function onBtnMouseDown(e: MouseEvent): void {
      if (e.button !== 0) return
      e.preventDefault()
      btnDrag.active = true
      btnDrag.hasMoved = false
    }

    function onPanelResizeMouseDown(e: MouseEvent): void {
      e.preventDefault()
      panelResizing.value = true
    }

    function onMouseMove(e: MouseEvent): void {
      if (panelResizing.value) {
        const pos = position.value
        if (pos === "bottom") panelSize.value = Math.max(200, window.innerHeight - e.clientY)
        else if (pos === "top")   panelSize.value = Math.max(200, e.clientY)
        else if (pos === "right") panelSize.value = Math.max(300, window.innerWidth - e.clientX)
        else if (pos === "left")  panelSize.value = Math.max(300, e.clientX)
        return
      }
      if (!btnDrag.active) return
      btnDrag.hasMoved = true
      liveDragXY.value = { x: e.clientX - 45, y: e.clientY - 18 }
    }

    function onMouseUp(e: MouseEvent): void {
      if (panelResizing.value) { panelResizing.value = false; return }
      if (!btnDrag.active) return
      btnDrag.active = false
      if (btnDrag.hasMoved) {
        btnSnap.value = snapToEdge(e.clientX, e.clientY)
        liveDragXY.value = null
      } else {
        liveDragXY.value = null
        open.value = !open.value
      }
    }

    let unsub: (() => void) | undefined

    onMounted(() => {
      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
      const emitter = (globalThis as { __ciphClientEmitter__?: { on: (e: string, cb: (log: CiphClientLog) => void) => () => void } }).__ciphClientEmitter__
      if (!emitter) return
      unsub = emitter.on("log", (log) => {
        logsBuffer.unshift({ id: log.id, log, receivedAt: Date.now() })
        if (logsBuffer.length > maxLogs) logsBuffer.length = maxLogs
        entries.value = [...logsBuffer]
      })
    })

    onUnmounted(() => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      unsub?.()
    })

    function clearLogs(): void { logsBuffer.length = 0; entries.value = []; selected.value = null }

    async function reRequest(): Promise<void> {
      const entry = sel.value
      if (!entry || isRequesting.value || !props.options.client) return
      isRequesting.value = true
      try {
        const client = props.options.client as Record<string, (...a: unknown[]) => Promise<unknown>>
        const m = entry.log.method.toLowerCase()
        const isBodyMethod = ["post", "put", "patch", "delete"].includes(m)
        if (isBodyMethod) {
          await client[m]?.(entry.log.route, entry.log.request.plainBody, { headers: entry.log.request.headers })
        } else {
          await client[m]?.(entry.log.route, { headers: entry.log.request.headers })
        }
      } finally {
        isRequesting.value = false
      }
    }

    const c = COLORS
    const panelCommon: CSSProperties = {
      background: c.bg,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      fontFamily: "'Menlo','Monaco','Consolas',monospace",
      fontSize: "12px", color: c.text,
    }

    const wordmarkSvg = h("svg", { width: 48, height: 18, viewBox: "0 0 140 53", fill: "none", "aria-label": "Ciph" }, [
      h("path", { d: "M53.95 0C60.8535 6.18481e-05 66.45 5.59648 66.45 12.5C66.45 17.9216 62.998 22.5361 58.1723 24.2677C57.6991 24.4375 57.3892 24.9076 57.4619 25.405L61.2026 50.995C61.2908 51.5985 60.823 52.1396 60.2131 52.1396H47.6868C47.077 52.1396 46.6092 51.5985 46.6974 50.995L50.4371 25.405C50.5098 24.9075 50.2 24.4375 49.7268 24.2677C44.9014 22.5359 41.45 17.9214 41.45 12.5C41.45 5.59644 47.0464 0 53.95 0Z", fill: "white" }),
      h("path", { d: "M78.45 52.05C77.3454 52.05 76.45 51.1546 76.45 50.05V16.5C76.45 15.3954 77.3454 14.5 78.45 14.5H82.1483C83.2137 14.5 84.0921 15.3352 84.1458 16.3993L84.3022 19.5019C84.3255 19.9642 83.8841 20.3102 83.4408 20.1772C83.1069 20.0771 82.9014 19.7358 83.0119 19.4052C83.3023 18.5368 83.815 17.735 84.55 17C85.45 16.1 86.5833 15.3833 87.95 14.85C89.35 14.2833 90.8167 14 92.35 14C94.6167 14 96.6333 14.6 98.4 15.8C100.167 16.9667 101.55 18.5833 102.55 20.65C103.583 22.6833 104.1 25.05 104.1 27.75C104.1 30.4167 103.583 32.7833 102.55 34.85C101.55 36.9167 100.15 38.55 98.35 39.75C96.5833 40.9167 94.55 41.5 92.25 41.5C90.75 41.5 89.3167 41.2167 87.95 40.65C86.5833 40.0833 85.4333 39.3167 84.5 38.35C83.7677 37.5915 83.2303 36.7817 82.8879 35.9207C82.7285 35.5197 82.9567 35.084 83.3602 34.9313C83.911 34.7229 84.5 35.1298 84.5 35.7187V50.05C84.5 51.1546 83.6046 52.05 82.5 52.05H78.45ZM90.3 34.75C91.5 34.75 92.55 34.4667 93.45 33.9C94.35 33.3 95.05 32.4833 95.55 31.45C96.05 30.4167 96.3 29.1833 96.3 27.75C96.3 26.35 96.05 25.1333 95.55 24.1C95.05 23.0333 94.35 22.2167 93.45 21.65C92.5833 21.05 91.5333 20.75 90.3 20.75C89.0667 20.75 88 21.0333 87.1 21.6C86.2 22.1667 85.5 22.9833 85 24.05C84.5 25.1167 84.25 26.35 84.25 27.75C84.25 29.1833 84.5 30.4167 85 31.45C85.5 32.4833 86.2 33.3 87.1 33.9C88 34.4667 89.0667 34.75 90.3 34.75Z", fill: "white" }),
      h("path", { d: "M18.15 52.2C15.5167 52.2 13.0833 51.7667 10.85 50.9C8.65 50 6.73333 48.75 5.1 47.15C3.46667 45.5167 2.2 43.6 1.3 41.4C0.433333 39.1667 0 36.7167 0 34.05C0 31.45 0.466667 29.05 1.4 26.85C2.33333 24.65 3.61667 22.75 5.25 21.15C6.91667 19.5167 8.86667 18.25 11.1 17.35C13.3667 16.45 15.8333 16 18.5 16C20.1667 16 21.8 16.2167 23.4 16.65C25 17.0833 26.4833 17.7333 27.85 18.6C28.7261 19.1215 29.524 19.7083 30.2434 20.3604C30.9798 21.0277 30.9648 22.1551 30.3109 22.9034L27.6908 25.9014C26.917 26.7867 25.5578 26.8011 24.6204 26.0912C24.417 25.9372 24.2102 25.7902 24 25.65C23.2333 25.0833 22.3833 24.65 21.45 24.35C20.5167 24.05 19.5167 23.9 18.45 23.9C17.1167 23.9 15.85 24.15 14.65 24.65C13.4833 25.1167 12.45 25.8 11.55 26.7C10.6833 27.5667 10 28.6333 9.5 29.9C9 31.1667 8.75 32.5833 8.75 34.15C8.75 35.6833 9 37.0833 9.5 38.35C10 39.5833 10.7 40.65 11.6 41.55C12.5 42.45 13.5833 43.1333 14.85 43.6C16.15 44.0667 17.5833 44.3 19.15 44.3C20.2167 44.3 21.2333 44.15 22.2 43.85C23.1667 43.55 24.05 43.15 24.85 42.65C24.9287 42.5996 25.0066 42.5486 25.0835 42.497C26.1666 41.7711 27.7257 41.9212 28.4213 43.024L30.3459 46.0752C30.822 46.8299 30.7501 47.8232 30.058 48.3864C29.4121 48.9119 28.6594 49.3998 27.8 49.85C26.4333 50.5833 24.9 51.1667 23.2 51.6C21.5333 52 19.85 52.2 18.15 52.2Z", fill: "white" }),
      h("path", { d: "M115.75 52C114.839 52 114.1 51.2613 114.1 50.35V17C114.1 15.8954 114.995 15 116.1 15H119.95C121.055 15 121.95 15.8954 121.95 17V30.4151C121.95 30.6767 121.788 30.9109 121.543 31.0027C121.055 31.1855 120.589 30.734 120.821 30.2681C121.191 29.5279 121.684 28.8385 122.3 28.2C123.267 27.2 124.417 26.4 125.75 25.8C127.083 25.2 128.483 24.9 129.95 24.9C131.95 24.9 133.633 25.3167 135 26.15C136.367 26.95 137.4 28.1667 138.1 29.8C138.8 31.4 139.15 33.3667 139.15 35.7V50C139.15 51.1046 138.255 52 137.15 52H133.1C131.995 52 131.1 51.1046 131.1 50V36.35C131.1 35.2833 130.95 34.4 130.65 33.7C130.35 33 129.883 32.4833 129.25 32.15C128.65 31.7833 127.9 31.6167 127 31.65C126.3 31.65 125.65 31.7667 125.05 32C124.45 32.2 123.933 32.5167 123.5 32.95C123.067 33.35 122.717 33.8167 122.45 34.35C122.217 34.8833 122.1 35.4667 122.1 36.1V50C122.1 51.1046 121.205 52 120.1 52H118.15C117.217 52 116.417 52 115.75 52Z", fill: "white" }),
    ])

    return () => {
      const entrs = entries.value
      const selVal = sel.value
      const selIdx = selected.value
      const isOpen = open.value
      const docked = isDocked.value

      const panelContent = renderPanelInner(
        c, entrs, selIdx, selVal,
        isRequesting.value, !!props.options.client,
        (i) => { selected.value = i },
        clearLogs,
        () => { open.value = false },
        reRequest,
      )

      const resizeHandle = h("div", {
        onMousedown: onPanelResizeMouseDown,
        style: {
          position: "absolute", zIndex: 999999,
          cursor: position.value === "top" || position.value === "bottom" ? "ns-resize" : "ew-resize",
          ...(position.value === "bottom" ? { top: "-2px", left: 0, right: 0, height: "6px" } : {}),
          ...(position.value === "top"    ? { bottom: "-2px", left: 0, right: 0, height: "6px" } : {}),
          ...(position.value === "left"   ? { top: 0, bottom: 0, right: "-2px", width: "6px" } : {}),
          ...(position.value === "right"  ? { top: 0, bottom: 0, left: "-2px", width: "6px" } : {}),
        } as CSSProperties,
      })

      const border: CSSProperties = {
        borderTop:    position.value === "bottom" ? `1px solid ${c.border}` : undefined,
        borderBottom: position.value === "top"    ? `1px solid ${c.border}` : undefined,
        borderRight:  position.value === "left"   ? `1px solid ${c.border}` : undefined,
        borderLeft:   position.value === "right"  ? `1px solid ${c.border}` : undefined,
      }

      return h("div", {}, [
        // Docked panel
        isOpen && docked
          ? h("div", { style: { ...dockedPanelStyle.value, ...panelCommon, boxShadow: "0 0 40px rgba(0,0,0,0.6)", ...border } as CSSProperties }, [resizeHandle, panelContent])
          : null,

        // Floating panel
        isOpen && !docked
          ? h("div", { style: { ...floatingPanelStyle.value, ...panelCommon, border: `1px solid ${c.border}`, borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" } as CSSProperties }, [panelContent])
          : null,

        // Toggle button
        h("button", {
          onMousedown: onBtnMouseDown,
          style: {
            ...toggleBtnStyle.value,
            padding: "8px 14px 8px 10px",
            background: isOpen ? "#161b22" : "#0d1117",
            borderRadius: "9999px",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", gap: "8px",
            userSelect: "none",
            cursor: liveDragXY.value ? "grabbing" : "grab",
          } as CSSProperties,
          title: "Drag to move · Click to toggle",
        }, [
          wordmarkSvg,
          entrs.length > 0
            ? h("span", { style: { background: "rgba(88,166,255,0.15)", color: "#58a6ff", border: "1px solid rgba(88,166,255,0.3)", borderRadius: "9999px", padding: "1px 7px", fontSize: "10px", fontFamily: "monospace", fontWeight: 600 } as CSSProperties }, String(entrs.length))
            : null,
        ]),
      ])
    }
  },
})
