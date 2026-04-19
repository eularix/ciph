"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/devtools/CiphDevtoolsPanel.ts
var CiphDevtoolsPanel_exports = {};
__export(CiphDevtoolsPanel_exports, {
  mountDevtoolsPanel: () => mountDevtoolsPanel
});
function mountDevtoolsPanel(options = {}) {
  if (_mounted) return;
  _mounted = true;
  const host = document.createElement("div");
  host.id = "ciph-devtools-host";
  document.body.appendChild(host);
  const app = (0, import_vue.createApp)(DevtoolsPanelComponent, { options });
  app.mount(host);
}
function statusColor(s) {
  if (s >= 500) return "#f85149";
  if (s >= 400) return "#d29922";
  if (s >= 200) return "#3fb950";
  return "#8b949e";
}
function methodColors(m) {
  const map = {
    GET: { bg: "#0d1b2e", text: "#58a6ff" },
    POST: { bg: "#0d2010", text: "#3fb950" },
    PUT: { bg: "#1e1500", text: "#d29922" },
    PATCH: { bg: "#1a0d2e", text: "#bc8cff" },
    DELETE: { bg: "#2e0d0d", text: "#f85149" }
  };
  return map[m] ?? { bg: "#1c2230", text: "#8b949e" };
}
function fmtBody(v) {
  if (v === null || v === void 0) return "\u2014";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
function trunc(s) {
  if (!s) return "\u2014";
  return s.length > 120 ? s.slice(0, 120) + "\u2026" : s;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(v, hi));
}
function snapToEdge(cx, cy) {
  const W = window.innerWidth, H = window.innerHeight;
  const min = Math.min(cx, W - cx, cy, H - cy);
  if (min === H - cy) return { side: "bottom", offset: clamp(cx - 45, 8, W - 100) };
  if (min === cy) return { side: "top", offset: clamp(cx - 45, 8, W - 100) };
  if (min === cx) return { side: "left", offset: clamp(cy - 18, 8, H - 44) };
  return { side: "right", offset: clamp(cy - 18, 8, H - 44) };
}
function renderPanelInner(c, entries, selected, sel, isRequesting, hasClient, onSelect, onClear, onClose, onReRequest) {
  const detailPairs = sel ? [
    ["Request (Plain)", fmtBody(sel.log.request.plainBody)],
    ["Response (Plain)", fmtBody(sel.log.response.plainBody)]
  ] : [];
  const encPairs = sel ? [
    ["Request Encrypted", trunc(sel.log.request.encryptedBody)],
    ["Response Encrypted", trunc(sel.log.response.encryptedBody)]
  ] : [];
  const mc = sel ? methodColors(sel.log.method) : null;
  return (0, import_vue.h)("div", { style: { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" } }, [
    // Header
    (0, import_vue.h)("div", { style: { background: c.bg2, borderBottom: `1px solid ${c.border}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 } }, [
      (0, import_vue.h)("span", { style: { fontSize: "13px", fontWeight: 700, letterSpacing: "0.5px" } }, "\u{1F6E1}\uFE0F Ciph Inspector"),
      (0, import_vue.h)(
        "span",
        { style: { fontSize: "10px", background: c.bg3, border: `1px solid ${c.border}`, borderRadius: "10px", padding: "2px 8px", color: c.text2 } },
        `${entries.length} request${entries.length !== 1 ? "s" : ""}`
      ),
      (0, import_vue.h)("span", { style: { fontSize: "10px", color: c.text2, background: "#0d2010", border: "1px solid #3fb95033", borderRadius: "6px", padding: "2px 6px" } }, "vue \u2726"),
      (0, import_vue.h)("div", { style: { flex: 1 } }),
      (0, import_vue.h)("button", { onClick: onClear, style: { padding: "3px 10px", borderRadius: "6px", border: `1px solid ${c.border}`, background: c.bg3, color: c.text2, cursor: "pointer", fontSize: "11px", fontFamily: "inherit" } }, "Clear"),
      (0, import_vue.h)("button", { onClick: onClose, style: { padding: "3px 8px", borderRadius: "6px", border: `1px solid ${c.border}`, background: c.bg3, color: c.text2, cursor: "pointer", fontSize: "11px", fontFamily: "inherit" } }, "\u2715")
    ]),
    // Body row
    (0, import_vue.h)("div", { style: { display: "flex", flex: 1, overflow: "hidden" } }, [
      // Log list
      (0, import_vue.h)("div", { style: { width: "300px", borderRight: `1px solid ${c.border}`, overflowY: "auto", flexShrink: 0 } }, [
        (0, import_vue.h)(
          "div",
          { style: { position: "sticky", top: 0, background: c.bg2, borderBottom: `1px solid ${c.border}`, padding: "6px 10px", display: "grid", gridTemplateColumns: "52px 1fr 44px 42px", gap: "6px", color: c.text2, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" } },
          [(0, import_vue.h)("span", "Method"), (0, import_vue.h)("span", "Route"), (0, import_vue.h)("span", "Status"), (0, import_vue.h)("span", "ms")]
        ),
        entries.length === 0 ? (0, import_vue.h)("div", { style: { padding: "20px", color: c.text2, fontSize: "12px", textAlign: "center" } }, "No requests yet. Make an API call to see logs.") : entries.map((e, i) => {
          const em = methodColors(e.log.method);
          return (0, import_vue.h)("div", {
            key: e.id,
            onClick: () => onSelect(i),
            style: {
              padding: "7px 10px",
              display: "grid",
              gridTemplateColumns: "52px 1fr 44px 42px",
              gap: "6px",
              borderBottom: `1px solid ${c.border}`,
              borderLeft: `2px solid ${selected === i ? "#58a6ff" : e.log.status >= 400 ? "#f85149" : "transparent"}`,
              cursor: "pointer",
              background: selected === i ? c.bg3 : "transparent",
              alignItems: "center"
            }
          }, [
            (0, import_vue.h)("span", { style: { fontSize: "9px", fontWeight: 700, padding: "2px 4px", borderRadius: "4px", background: em.bg, color: em.text, textAlign: "center" } }, e.log.method),
            (0, import_vue.h)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: c.text, fontSize: "11px" } }, e.log.route),
            (0, import_vue.h)("span", { style: { color: statusColor(e.log.status), fontWeight: 600, fontSize: "11px" } }, e.log.status || "\u2026"),
            (0, import_vue.h)("span", { style: { color: c.text2, fontSize: "10px" } }, `${e.log.duration}ms`)
          ]);
        })
      ]),
      // Detail pane
      (0, import_vue.h)(
        "div",
        { style: { flex: 1, overflowY: "auto", padding: "14px" } },
        !sel ? [(0, import_vue.h)("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: c.text2, fontSize: "13px" } }, "\u2190 Select a request to inspect")] : [
          (0, import_vue.h)("div", { style: { marginBottom: "14px", paddingBottom: "10px", borderBottom: `1px solid ${c.border}` } }, [
            (0, import_vue.h)("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" } }, [
              (0, import_vue.h)("span", { style: { fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: mc.bg, color: mc.text } }, sel.log.method),
              (0, import_vue.h)("span", { style: { fontWeight: 600, fontSize: "13px" } }, sel.log.route),
              (0, import_vue.h)("span", { style: { fontWeight: 700, color: statusColor(sel.log.status) } }, sel.log.status || "\u2026"),
              (0, import_vue.h)(
                "span",
                { style: { fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: sel.log.excluded ? c.bg3 : "#0d1b2e", color: sel.log.excluded ? c.text2 : "#58a6ff" } },
                sel.log.excluded ? "\u25CB Plain" : "\u{1F512} Encrypted"
              ),
              hasClient ? (0, import_vue.h)("button", {
                disabled: isRequesting,
                onClick: onReRequest,
                style: { marginLeft: "auto", padding: "3px 10px", borderRadius: "6px", border: `1px solid ${c.border}`, background: isRequesting ? c.bg2 : "#0d2010", color: isRequesting ? c.text2 : "#3fb950", cursor: isRequesting ? "not-allowed" : "pointer", fontSize: "11px", fontFamily: "inherit" }
              }, isRequesting ? "Sending..." : "\u21BB Re-request") : null
            ]),
            (0, import_vue.h)("div", { style: { color: c.text2, fontSize: "10px", display: "flex", gap: "12px" } }, [
              (0, import_vue.h)("span", sel.log.timestamp),
              (0, import_vue.h)("span", `${sel.log.duration}ms`),
              (0, import_vue.h)("span", `fp: ${sel.log.fingerprint.value ? sel.log.fingerprint.value.slice(0, 12) + "\u2026" : "\u2014"}`)
            ])
          ]),
          (0, import_vue.h)(
            "div",
            { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" } },
            detailPairs.map(
              ([label, content]) => (0, import_vue.h)("div", { key: label }, [
                (0, import_vue.h)("div", { style: { fontSize: "10px", color: c.text2, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" } }, label),
                (0, import_vue.h)(
                  "div",
                  { style: { background: c.bg2, border: `1px solid ${c.border}`, borderRadius: "6px", padding: "10px", overflowX: "auto" } },
                  (0, import_vue.h)("pre", { style: { margin: 0, color: c.text, fontSize: "11px", lineHeight: "1.6", whiteSpace: "pre-wrap", wordBreak: "break-all" } }, content)
                )
              ])
            )
          ),
          (0, import_vue.h)(
            "div",
            { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } },
            encPairs.map(
              ([label, content]) => (0, import_vue.h)("div", { key: label }, [
                (0, import_vue.h)("div", { style: { fontSize: "10px", color: c.text2, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" } }, label),
                (0, import_vue.h)(
                  "div",
                  { style: { background: c.bg2, border: `1px solid ${c.border}`, borderRadius: "6px", padding: "10px", overflowX: "auto" } },
                  (0, import_vue.h)("pre", { style: { margin: 0, color: c.text2, fontSize: "11px", lineHeight: "1.6", whiteSpace: "pre-wrap", wordBreak: "break-all" } }, content)
                )
              ])
            )
          )
        ]
      )
    ])
  ]);
}
var import_vue, _mounted, COLORS, DevtoolsPanelComponent;
var init_CiphDevtoolsPanel = __esm({
  "src/devtools/CiphDevtoolsPanel.ts"() {
    "use strict";
    import_vue = require("vue");
    _mounted = false;
    COLORS = {
      bg: "#0f1117",
      bg2: "#161b22",
      bg3: "#1c2230",
      border: "#30363d",
      text: "#e6edf3",
      text2: "#8b949e"
    };
    DevtoolsPanelComponent = (0, import_vue.defineComponent)({
      name: "CiphDevtoolsPanel",
      props: {
        options: { type: Object, required: true }
      },
      setup(props) {
        const maxLogs = props.options.maxLogs ?? 500;
        const position = (0, import_vue.ref)(props.options.position ?? "bottom-right");
        const open = (0, import_vue.ref)(props.options.defaultOpen ?? false);
        const entries = (0, import_vue.ref)([]);
        const selected = (0, import_vue.ref)(null);
        const isRequesting = (0, import_vue.ref)(false);
        const btnSnap = (0, import_vue.ref)(null);
        const liveDragXY = (0, import_vue.ref)(null);
        const panelSize = (0, import_vue.ref)(position.value === "left" || position.value === "right" ? 500 : 350);
        const panelResizing = (0, import_vue.ref)(false);
        const logsBuffer = [];
        const btnDrag = { active: false, hasMoved: false };
        const isDocked = (0, import_vue.computed)(() => !position.value.includes("-"));
        const sel = (0, import_vue.computed)(
          () => selected.value !== null ? entries.value[selected.value] ?? null : null
        );
        const toggleBtnStyle = (0, import_vue.computed)(() => {
          const base = { position: "fixed", zIndex: 1000001 };
          if (liveDragXY.value) return { ...base, left: `${liveDragXY.value.x}px`, top: `${liveDragXY.value.y}px`, cursor: "grabbing" };
          if (btnSnap.value) {
            const s = btnSnap.value;
            const pad = "16px";
            if (s.side === "bottom") return { ...base, bottom: pad, left: `${s.offset}px` };
            if (s.side === "top") return { ...base, top: pad, left: `${s.offset}px` };
            if (s.side === "left") return { ...base, left: pad, top: `${s.offset}px` };
            return { ...base, right: pad, top: `${s.offset}px` };
          }
          const pos = position.value;
          if (pos === "bottom-right") return { ...base, bottom: "20px", right: "20px" };
          if (pos === "bottom-left") return { ...base, bottom: "20px", left: "20px" };
          if (pos === "top-right") return { ...base, top: "20px", right: "20px" };
          if (pos === "top-left") return { ...base, top: "20px", left: "20px" };
          if (pos === "bottom") return { ...base, bottom: "20px", left: "50%", transform: "translateX(-50%)" };
          if (pos === "top") return { ...base, top: "20px", left: "50%", transform: "translateX(-50%)" };
          if (pos === "left") return { ...base, left: "20px", bottom: "30%" };
          return { ...base, right: "20px", bottom: "30%" };
        });
        const floatingPanelStyle = (0, import_vue.computed)(() => {
          const W = window.innerWidth, H = window.innerHeight;
          const PW = 860, PH = 560;
          const pos = position.value;
          const snap = btnSnap.value;
          const side = snap?.side ?? (pos.includes("bottom") ? "bottom" : pos.includes("top") ? "top" : pos === "left" ? "left" : "right");
          const base = { position: "fixed", width: `${PW}px`, height: `${PH}px`, zIndex: 999998 };
          if (side === "bottom") {
            const l = snap?.offset ?? W - 100;
            return { ...base, bottom: "60px", left: `${clamp(l - PW + 100, 8, W - PW - 8)}px` };
          }
          if (side === "top") {
            const l = snap?.offset ?? W - 100;
            return { ...base, top: "60px", left: `${clamp(l - PW + 100, 8, W - PW - 8)}px` };
          }
          if (side === "left") {
            const t2 = snap?.offset ?? H - 44;
            return { ...base, left: "60px", top: `${clamp(t2 - PH + 44, 8, H - PH - 8)}px` };
          }
          const t = snap?.offset ?? H - 44;
          return { ...base, right: "60px", top: `${clamp(t - PH + 44, 8, H - PH - 8)}px` };
        });
        const dockedPanelStyle = (0, import_vue.computed)(() => {
          const pos = position.value;
          const sz = `${panelSize.value}px`;
          const base = { position: "fixed", zIndex: 999998 };
          if (pos === "bottom") return { ...base, bottom: 0, left: 0, right: 0, height: sz };
          if (pos === "top") return { ...base, top: 0, left: 0, right: 0, height: sz };
          if (pos === "left") return { ...base, top: 0, bottom: 0, left: 0, width: sz };
          return { ...base, top: 0, bottom: 0, right: 0, width: sz };
        });
        function onBtnMouseDown(e) {
          if (e.button !== 0) return;
          e.preventDefault();
          btnDrag.active = true;
          btnDrag.hasMoved = false;
        }
        function onPanelResizeMouseDown(e) {
          e.preventDefault();
          panelResizing.value = true;
        }
        function onMouseMove(e) {
          if (panelResizing.value) {
            const pos = position.value;
            if (pos === "bottom") panelSize.value = Math.max(200, window.innerHeight - e.clientY);
            else if (pos === "top") panelSize.value = Math.max(200, e.clientY);
            else if (pos === "right") panelSize.value = Math.max(300, window.innerWidth - e.clientX);
            else if (pos === "left") panelSize.value = Math.max(300, e.clientX);
            return;
          }
          if (!btnDrag.active) return;
          btnDrag.hasMoved = true;
          liveDragXY.value = { x: e.clientX - 45, y: e.clientY - 18 };
        }
        function onMouseUp(e) {
          if (panelResizing.value) {
            panelResizing.value = false;
            return;
          }
          if (!btnDrag.active) return;
          btnDrag.active = false;
          if (btnDrag.hasMoved) {
            btnSnap.value = snapToEdge(e.clientX, e.clientY);
            liveDragXY.value = null;
          } else {
            liveDragXY.value = null;
            open.value = !open.value;
          }
        }
        let unsub;
        (0, import_vue.onMounted)(() => {
          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
          const emitter = globalThis.__ciphClientEmitter__;
          if (!emitter) return;
          unsub = emitter.on("log", (log) => {
            logsBuffer.unshift({ id: log.id, log, receivedAt: Date.now() });
            if (logsBuffer.length > maxLogs) logsBuffer.length = maxLogs;
            entries.value = [...logsBuffer];
          });
        });
        (0, import_vue.onUnmounted)(() => {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
          unsub?.();
        });
        function clearLogs() {
          logsBuffer.length = 0;
          entries.value = [];
          selected.value = null;
        }
        async function reRequest() {
          const entry = sel.value;
          if (!entry || isRequesting.value || !props.options.client) return;
          isRequesting.value = true;
          try {
            const client = props.options.client;
            const m = entry.log.method.toLowerCase();
            const isBodyMethod = ["post", "put", "patch", "delete"].includes(m);
            if (isBodyMethod) {
              await client[m]?.(entry.log.route, entry.log.request.plainBody, { headers: entry.log.request.headers });
            } else {
              await client[m]?.(entry.log.route, { headers: entry.log.request.headers });
            }
          } finally {
            isRequesting.value = false;
          }
        }
        const c = COLORS;
        const panelCommon = {
          background: c.bg,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Menlo','Monaco','Consolas',monospace",
          fontSize: "12px",
          color: c.text
        };
        const wordmarkSvg = (0, import_vue.h)("svg", { width: 48, height: 18, viewBox: "0 0 140 53", fill: "none", "aria-label": "Ciph" }, [
          (0, import_vue.h)("path", { d: "M53.95 0C60.8535 6.18481e-05 66.45 5.59648 66.45 12.5C66.45 17.9216 62.998 22.5361 58.1723 24.2677C57.6991 24.4375 57.3892 24.9076 57.4619 25.405L61.2026 50.995C61.2908 51.5985 60.823 52.1396 60.2131 52.1396H47.6868C47.077 52.1396 46.6092 51.5985 46.6974 50.995L50.4371 25.405C50.5098 24.9075 50.2 24.4375 49.7268 24.2677C44.9014 22.5359 41.45 17.9214 41.45 12.5C41.45 5.59644 47.0464 0 53.95 0Z", fill: "white" }),
          (0, import_vue.h)("path", { d: "M78.45 52.05C77.3454 52.05 76.45 51.1546 76.45 50.05V16.5C76.45 15.3954 77.3454 14.5 78.45 14.5H82.1483C83.2137 14.5 84.0921 15.3352 84.1458 16.3993L84.3022 19.5019C84.3255 19.9642 83.8841 20.3102 83.4408 20.1772C83.1069 20.0771 82.9014 19.7358 83.0119 19.4052C83.3023 18.5368 83.815 17.735 84.55 17C85.45 16.1 86.5833 15.3833 87.95 14.85C89.35 14.2833 90.8167 14 92.35 14C94.6167 14 96.6333 14.6 98.4 15.8C100.167 16.9667 101.55 18.5833 102.55 20.65C103.583 22.6833 104.1 25.05 104.1 27.75C104.1 30.4167 103.583 32.7833 102.55 34.85C101.55 36.9167 100.15 38.55 98.35 39.75C96.5833 40.9167 94.55 41.5 92.25 41.5C90.75 41.5 89.3167 41.2167 87.95 40.65C86.5833 40.0833 85.4333 39.3167 84.5 38.35C83.7677 37.5915 83.2303 36.7817 82.8879 35.9207C82.7285 35.5197 82.9567 35.084 83.3602 34.9313C83.911 34.7229 84.5 35.1298 84.5 35.7187V50.05C84.5 51.1546 83.6046 52.05 82.5 52.05H78.45ZM90.3 34.75C91.5 34.75 92.55 34.4667 93.45 33.9C94.35 33.3 95.05 32.4833 95.55 31.45C96.05 30.4167 96.3 29.1833 96.3 27.75C96.3 26.35 96.05 25.1333 95.55 24.1C95.05 23.0333 94.35 22.2167 93.45 21.65C92.5833 21.05 91.5333 20.75 90.3 20.75C89.0667 20.75 88 21.0333 87.1 21.6C86.2 22.1667 85.5 22.9833 85 24.05C84.5 25.1167 84.25 26.35 84.25 27.75C84.25 29.1833 84.5 30.4167 85 31.45C85.5 32.4833 86.2 33.3 87.1 33.9C88 34.4667 89.0667 34.75 90.3 34.75Z", fill: "white" }),
          (0, import_vue.h)("path", { d: "M18.15 52.2C15.5167 52.2 13.0833 51.7667 10.85 50.9C8.65 50 6.73333 48.75 5.1 47.15C3.46667 45.5167 2.2 43.6 1.3 41.4C0.433333 39.1667 0 36.7167 0 34.05C0 31.45 0.466667 29.05 1.4 26.85C2.33333 24.65 3.61667 22.75 5.25 21.15C6.91667 19.5167 8.86667 18.25 11.1 17.35C13.3667 16.45 15.8333 16 18.5 16C20.1667 16 21.8 16.2167 23.4 16.65C25 17.0833 26.4833 17.7333 27.85 18.6C28.7261 19.1215 29.524 19.7083 30.2434 20.3604C30.9798 21.0277 30.9648 22.1551 30.3109 22.9034L27.6908 25.9014C26.917 26.7867 25.5578 26.8011 24.6204 26.0912C24.417 25.9372 24.2102 25.7902 24 25.65C23.2333 25.0833 22.3833 24.65 21.45 24.35C20.5167 24.05 19.5167 23.9 18.45 23.9C17.1167 23.9 15.85 24.15 14.65 24.65C13.4833 25.1167 12.45 25.8 11.55 26.7C10.6833 27.5667 10 28.6333 9.5 29.9C9 31.1667 8.75 32.5833 8.75 34.15C8.75 35.6833 9 37.0833 9.5 38.35C10 39.5833 10.7 40.65 11.6 41.55C12.5 42.45 13.5833 43.1333 14.85 43.6C16.15 44.0667 17.5833 44.3 19.15 44.3C20.2167 44.3 21.2333 44.15 22.2 43.85C23.1667 43.55 24.05 43.15 24.85 42.65C24.9287 42.5996 25.0066 42.5486 25.0835 42.497C26.1666 41.7711 27.7257 41.9212 28.4213 43.024L30.3459 46.0752C30.822 46.8299 30.7501 47.8232 30.058 48.3864C29.4121 48.9119 28.6594 49.3998 27.8 49.85C26.4333 50.5833 24.9 51.1667 23.2 51.6C21.5333 52 19.85 52.2 18.15 52.2Z", fill: "white" }),
          (0, import_vue.h)("path", { d: "M115.75 52C114.839 52 114.1 51.2613 114.1 50.35V17C114.1 15.8954 114.995 15 116.1 15H119.95C121.055 15 121.95 15.8954 121.95 17V30.4151C121.95 30.6767 121.788 30.9109 121.543 31.0027C121.055 31.1855 120.589 30.734 120.821 30.2681C121.191 29.5279 121.684 28.8385 122.3 28.2C123.267 27.2 124.417 26.4 125.75 25.8C127.083 25.2 128.483 24.9 129.95 24.9C131.95 24.9 133.633 25.3167 135 26.15C136.367 26.95 137.4 28.1667 138.1 29.8C138.8 31.4 139.15 33.3667 139.15 35.7V50C139.15 51.1046 138.255 52 137.15 52H133.1C131.995 52 131.1 51.1046 131.1 50V36.35C131.1 35.2833 130.95 34.4 130.65 33.7C130.35 33 129.883 32.4833 129.25 32.15C128.65 31.7833 127.9 31.6167 127 31.65C126.3 31.65 125.65 31.7667 125.05 32C124.45 32.2 123.933 32.5167 123.5 32.95C123.067 33.35 122.717 33.8167 122.45 34.35C122.217 34.8833 122.1 35.4667 122.1 36.1V50C122.1 51.1046 121.205 52 120.1 52H118.15C117.217 52 116.417 52 115.75 52Z", fill: "white" })
        ]);
        return () => {
          const entrs = entries.value;
          const selVal = sel.value;
          const selIdx = selected.value;
          const isOpen = open.value;
          const docked = isDocked.value;
          const panelContent = renderPanelInner(
            c,
            entrs,
            selIdx,
            selVal,
            isRequesting.value,
            !!props.options.client,
            (i) => {
              selected.value = i;
            },
            clearLogs,
            () => {
              open.value = false;
            },
            reRequest
          );
          const resizeHandle = (0, import_vue.h)("div", {
            onMousedown: onPanelResizeMouseDown,
            style: {
              position: "absolute",
              zIndex: 999999,
              cursor: position.value === "top" || position.value === "bottom" ? "ns-resize" : "ew-resize",
              ...position.value === "bottom" ? { top: "-2px", left: 0, right: 0, height: "6px" } : {},
              ...position.value === "top" ? { bottom: "-2px", left: 0, right: 0, height: "6px" } : {},
              ...position.value === "left" ? { top: 0, bottom: 0, right: "-2px", width: "6px" } : {},
              ...position.value === "right" ? { top: 0, bottom: 0, left: "-2px", width: "6px" } : {}
            }
          });
          const border = {
            borderTop: position.value === "bottom" ? `1px solid ${c.border}` : void 0,
            borderBottom: position.value === "top" ? `1px solid ${c.border}` : void 0,
            borderRight: position.value === "left" ? `1px solid ${c.border}` : void 0,
            borderLeft: position.value === "right" ? `1px solid ${c.border}` : void 0
          };
          return (0, import_vue.h)("div", {}, [
            // Docked panel
            isOpen && docked ? (0, import_vue.h)("div", { style: { ...dockedPanelStyle.value, ...panelCommon, boxShadow: "0 0 40px rgba(0,0,0,0.6)", ...border } }, [resizeHandle, panelContent]) : null,
            // Floating panel
            isOpen && !docked ? (0, import_vue.h)("div", { style: { ...floatingPanelStyle.value, ...panelCommon, border: `1px solid ${c.border}`, borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" } }, [panelContent]) : null,
            // Toggle button
            (0, import_vue.h)("button", {
              onMousedown: onBtnMouseDown,
              style: {
                ...toggleBtnStyle.value,
                padding: "8px 14px 8px 10px",
                background: isOpen ? "#161b22" : "#0d1117",
                borderRadius: "9999px",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                userSelect: "none",
                cursor: liveDragXY.value ? "grabbing" : "grab"
              },
              title: "Drag to move \xB7 Click to toggle"
            }, [
              wordmarkSvg,
              entrs.length > 0 ? (0, import_vue.h)("span", { style: { background: "rgba(88,166,255,0.15)", color: "#58a6ff", border: "1px solid rgba(88,166,255,0.3)", borderRadius: "9999px", padding: "1px 7px", fontSize: "10px", fontFamily: "monospace", fontWeight: 600 } }, String(entrs.length)) : null
            ])
          ]);
        };
      }
    });
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CIPH_CLIENT_KEY: () => CIPH_CLIENT_KEY,
  CiphError: () => import_core2.CiphError,
  CiphPlugin: () => CiphPlugin,
  autoInitClientEmitter: () => autoInitClientEmitter,
  createClient: () => createClient,
  emitClientLog: () => emitClientLog,
  useCiph: () => useCiph
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var import_axios = __toESM(require("axios"));
var import_core = require("@ciph/core");

// src/devtools/emitter.ts
var _channel;
function autoInitClientEmitter() {
  if (typeof globalThis.__ciphClientEmitter__ !== "undefined") return;
  const listeners = [];
  if (typeof BroadcastChannel !== "undefined" && !_channel) {
    _channel = new BroadcastChannel("ciph-devtools-logs");
    _channel.onmessage = (event) => {
      if (event.data?.type === "ciph-log" && event.data.log) {
        globalThis.__ciphClientEmitter__?.emit("log", event.data.log, true);
      }
    };
  }
  globalThis.__ciphClientEmitter__ = {
    emit(event, log, isBroadcast = false) {
      if (event === "log") {
        for (const l of listeners) l(log);
        if (!isBroadcast && _channel) {
          _channel.postMessage({ type: "ciph-log", log });
        }
      }
    },
    on(event, listener) {
      if (event === "log") {
        listeners.push(listener);
        return () => {
          const i = listeners.indexOf(listener);
          if (i >= 0) listeners.splice(i, 1);
        };
      }
      return () => {
      };
    }
  };
}
function emitClientLog(log) {
  globalThis.__ciphClientEmitter__?.emit("log", log);
}

// src/client.ts
function isCiphWirePayload(v) {
  return typeof v === "object" && v !== null && v.status === "encrypted" && typeof v.data === "string";
}
function normalizePath(url) {
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return url.split("?")[0] ?? "/";
  }
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function globToRegex(glob) {
  const n = glob.startsWith("/") ? glob : `/${glob}`;
  return new RegExp(`^${escapeRegex(n).replace(/\\\*/g, ".*")}$`);
}
function isExcluded(url, routes) {
  const path = normalizePath(url);
  return routes.some((r) => globToRegex(r).test(path));
}
function parseCiphHeaders(headers) {
  const coinsUsed = headers["x-coins-used"];
  const coinsRemaining = headers["x-coins-remaining"];
  const modelUsed = headers["x-model-used"];
  const result = {};
  if (typeof coinsUsed === "string" && coinsUsed.trim().length > 0) {
    const n = Number(coinsUsed);
    if (Number.isFinite(n)) result.coinsUsed = n;
  }
  if (typeof coinsRemaining === "string" && coinsRemaining.trim().length > 0) {
    const n = Number(coinsRemaining);
    if (Number.isFinite(n)) result.coinsRemaining = n;
  }
  if (typeof modelUsed === "string") result.modelUsed = modelUsed;
  return result;
}
function toRecordHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.join(", ");
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  }
  return out;
}
function makeCiphResponse(response) {
  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: toRecordHeaders(response.headers),
    ciph: parseCiphHeaders(response.headers)
  };
}
async function buildDeviceComponents(options, extraFields) {
  const components = {};
  if (typeof navigator !== "undefined") {
    components.userAgent = navigator.userAgent;
  } else {
    components.userAgent = "node";
  }
  const includeScreen = options?.includeScreen ?? true;
  if (includeScreen && typeof screen !== "undefined") {
    components.screen = `${screen.width}x${screen.height}`;
  }
  const includeTimezone = options?.includeTimezone ?? true;
  if (includeTimezone && typeof Intl !== "undefined") {
    components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  }
  for (const [k, v] of Object.entries(options?.customFields ?? {})) {
    components[k] = v;
  }
  for (const [k, v] of Object.entries(extraFields ?? {})) {
    components[k] = v;
  }
  return components;
}
async function initSession(session, serverPublicKey, options, extraFields) {
  const keyPair = await (0, import_core.generateKeyPair)();
  session.keyPair = keyPair;
  const rawShared = await (0, import_core.deriveECDHBits)(keyPair.privateKey, serverPublicKey);
  const sessionKey = await (0, import_core.deriveSessionKey)(rawShared);
  session.sessionKey = sessionKey;
  const components = await buildDeviceComponents(options, extraFields);
  const fpResult = await (0, import_core.generateFingerprint)(components);
  session.fingerprintHash = fpResult.fingerprint;
  return {
    sessionKey,
    fingerprintHash: fpResult.fingerprint,
    publicKey: keyPair.publicKey
  };
}
function invalidateSession(session) {
  session.keyPair = null;
  session.sessionKey = null;
  session.fingerprintHash = null;
}
function createClient(config) {
  const excludeRoutes = config.excludeRoutes ?? ["/health"];
  const onFingerprintMismatch = config.onFingerprintMismatch ?? "retry";
  const fallbackToPlain = config.fallbackToPlain ?? false;
  const session = {
    keyPair: null,
    sessionKey: null,
    fingerprintHash: null
  };
  const instance = import_axios.default.create({
    baseURL: config.baseURL,
    ...config.headers !== void 0 && { headers: config.headers }
  });
  instance.interceptors.request.use(
    async (incoming) => {
      const req = incoming;
      const url = req.url ?? "/";
      const excluded = isExcluded(url, excludeRoutes);
      req._ciphExcluded = excluded;
      req._ciphStartedAt = Date.now();
      if (!req._ciphRetried) {
        req._ciphPlainBody = req.data ?? null;
      }
      if (excluded || req.encrypt === false) {
        return req;
      }
      let sessionKey = session.sessionKey;
      let fingerprintHash = session.fingerprintHash;
      let clientPublicKey = session.keyPair?.publicKey;
      const wasSessionCached = !!(sessionKey && fingerprintHash && clientPublicKey);
      if (!wasSessionCached) {
        const s = await initSession(
          session,
          config.serverPublicKey,
          config.fingerprintOptions,
          req.fingerprintFields
        );
        sessionKey = s.sessionKey;
        fingerprintHash = s.fingerprintHash;
        clientPublicKey = s.publicKey;
      }
      req._ciphSessionKey = sessionKey;
      req._ciphFingerprintHash = fingerprintHash;
      const fpComponents = await buildDeviceComponents(
        config.fingerprintOptions,
        req.fingerprintFields
      );
      const encryptedFp = await (0, import_core.encrypt)(JSON.stringify(fpComponents), sessionKey);
      req.headers.set("X-Client-PublicKey", clientPublicKey);
      req.headers.set("X-Fingerprint", encryptedFp.ciphertext);
      const method = (req.method ?? "get").toUpperCase();
      const hasBody = method !== "GET" && method !== "HEAD" && typeof req.data !== "undefined" && req.data !== null;
      if (!hasBody) {
        req._ciphEncryptedBody = null;
        emitClientLog(buildClientLog(req, null, null, fingerprintHash ?? "", wasSessionCached, false));
        return req;
      }
      if (typeof req._ciphPlainBody === "string" && req.headers.get("Content-Type") === "text/plain") {
        req._ciphEncryptedBody = req._ciphPlainBody;
        return req;
      }
      try {
        const requestKey = await (0, import_core.deriveRequestKey)(sessionKey, fingerprintHash);
        const plain = typeof req.data === "string" ? req.data : JSON.stringify(req.data);
        const encrypted = await (0, import_core.encrypt)(plain, requestKey);
        req.data = encrypted.ciphertext;
        req._ciphEncryptedBody = encrypted.ciphertext;
        req.headers.set("Content-Type", "text/plain");
        emitClientLog(buildClientLog(req, req._ciphPlainBody, encrypted.ciphertext, fingerprintHash ?? "", wasSessionCached, false));
      } catch (error) {
        if (fallbackToPlain) {
          req._ciphEncryptedBody = null;
          return req;
        }
        throw new import_core.CiphError("CIPH004", "Request body encryption failed", error);
      }
      return req;
    }
  );
  instance.interceptors.response.use(
    async (response) => {
      const req = response.config;
      if (req._ciphExcluded) return response;
      const rawData = response.data;
      const isWirePayload = isCiphWirePayload(rawData);
      const encryptedBody = isWirePayload ? rawData.data : typeof rawData === "string" ? rawData : null;
      if (!encryptedBody) return response;
      const sessionKey = req._ciphSessionKey ?? session.sessionKey;
      const fingerprintHash = req._ciphFingerprintHash ?? session.fingerprintHash;
      if (!sessionKey || !fingerprintHash) {
        throw new import_core.CiphError("CIPH001", "Missing session key for response decryption");
      }
      try {
        const requestKey = await (0, import_core.deriveRequestKey)(sessionKey, fingerprintHash);
        const decrypted = await (0, import_core.decrypt)(encryptedBody, requestKey);
        const plainData = JSON.parse(decrypted.plaintext);
        req._ciphPlainResponse = plainData;
        response.data = plainData;
        emitClientLog(buildClientLog(
          req,
          req._ciphPlainBody ?? null,
          encryptedBody,
          fingerprintHash,
          true,
          req._ciphRetried ?? false,
          response.status,
          plainData,
          encryptedBody
        ));
      } catch (error) {
        if (fallbackToPlain) return response;
        throw new import_core.CiphError("CIPH004", "Response decryption failed", error);
      }
      return response;
    },
    async (error) => {
      const response = error.response;
      const req = error.config;
      const code = response?.data?.code;
      const isMismatch = response?.status === 401 && code === "CIPH003";
      const excluded = req?._ciphExcluded ?? false;
      if (!excluded && isMismatch && req && !req._ciphRetried) {
        if (onFingerprintMismatch === "throw") {
          throw new import_core.CiphError("CIPH003", "Fingerprint mismatch", error);
        }
        if (onFingerprintMismatch === "ignore") {
          throw error;
        }
        invalidateSession(session);
        const s = await initSession(
          session,
          config.serverPublicKey,
          config.fingerprintOptions,
          req.fingerprintFields
        );
        req._ciphRetried = true;
        req._ciphSessionKey = s.sessionKey;
        req._ciphFingerprintHash = s.fingerprintHash;
        const fpComponents = await buildDeviceComponents(
          config.fingerprintOptions,
          req.fingerprintFields
        );
        const encryptedFp = await (0, import_core.encrypt)(JSON.stringify(fpComponents), s.sessionKey);
        req.headers.set("X-Client-PublicKey", s.publicKey);
        req.headers.set("X-Fingerprint", encryptedFp.ciphertext);
        const method = (req.method ?? "get").toUpperCase();
        const hasBody = method !== "GET" && method !== "HEAD" && typeof req._ciphPlainBody !== "undefined" && req._ciphPlainBody !== null;
        if (hasBody && req.encrypt !== false) {
          const requestKey = await (0, import_core.deriveRequestKey)(s.sessionKey, s.fingerprintHash);
          const plain = typeof req._ciphPlainBody === "string" ? req._ciphPlainBody : JSON.stringify(req._ciphPlainBody);
          const encrypted = await (0, import_core.encrypt)(plain, requestKey);
          req.data = encrypted.ciphertext;
          req.headers.set("Content-Type", "text/plain");
        }
        try {
          return await instance.request(req);
        } catch (retryErr) {
          if (import_axios.default.isAxiosError(retryErr)) {
            throw new import_core.CiphError("CIPH003", "Fingerprint mismatch after retry", retryErr);
          }
          throw retryErr;
        }
      }
      throw error;
    }
  );
  return {
    async get(url, cfg) {
      return makeCiphResponse(await instance.get(url, cfg));
    },
    async post(url, data, cfg) {
      return makeCiphResponse(await instance.post(url, data, cfg));
    },
    async put(url, data, cfg) {
      return makeCiphResponse(await instance.put(url, data, cfg));
    },
    async patch(url, data, cfg) {
      return makeCiphResponse(await instance.patch(url, data, cfg));
    },
    async delete(url, cfg) {
      return makeCiphResponse(await instance.delete(url, cfg));
    }
  };
}
function buildClientLog(req, plainBody, encryptedBody, fingerprintHash, cached, retried, status = 0, plainResponse = null, encryptedResponse = null) {
  const headers = {};
  req.headers?.forEach?.((v, k) => {
    headers[k] = v;
  });
  return {
    id: crypto.randomUUID(),
    method: (req.method ?? "GET").toUpperCase(),
    route: req.url ?? "/",
    status,
    duration: req._ciphStartedAt ? Date.now() - req._ciphStartedAt : 0,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    request: {
      plainBody,
      encryptedBody,
      headers
    },
    response: {
      plainBody: plainResponse,
      encryptedBody: encryptedResponse
    },
    fingerprint: {
      value: fingerprintHash,
      cached,
      retried
    },
    excluded: req._ciphExcluded ?? false,
    error: null
  };
}

// src/plugin.ts
var import_vue2 = require("vue");
var CIPH_CLIENT_KEY = /* @__PURE__ */ Symbol("ciph-client");
var CiphPlugin = {
  install(app, options) {
    const { devtools: devtoolsConfig, ...clientConfig } = options;
    const client = createClient(clientConfig);
    app.provide(CIPH_CLIENT_KEY, client);
    const nodeEnv = typeof globalThis !== "undefined" && "process" in globalThis && globalThis.process?.env?.["NODE_ENV"] || "";
    const isProduction = nodeEnv === "production";
    if (!isProduction) {
      autoInitClientEmitter();
      const dtConfig = devtoolsConfig === false ? void 0 : devtoolsConfig;
      const devtoolsEnabled = dtConfig?.enabled ?? true;
      if (devtoolsEnabled) {
        const dt = dtConfig;
        const panelOptions = {
          ...dt?.maxLogs !== void 0 && { maxLogs: dt.maxLogs },
          ...dt?.defaultOpen !== void 0 && { defaultOpen: dt.defaultOpen },
          ...dt?.position !== void 0 && { position: dt.position },
          client
        };
        app.mixin({
          mounted() {
            if (this.$parent !== null) return;
            Promise.resolve().then(() => (init_CiphDevtoolsPanel(), CiphDevtoolsPanel_exports)).then(({ mountDevtoolsPanel: mountDevtoolsPanel2 }) => {
              mountDevtoolsPanel2(panelOptions);
            }).catch(() => {
            });
          }
        });
      }
    }
  }
};
function useCiph() {
  const client = (0, import_vue2.inject)(CIPH_CLIENT_KEY);
  if (!client) {
    throw new Error(
      "[ciph] useCiph() called without CiphPlugin installed. Call app.use(CiphPlugin, { baseURL, serverPublicKey }) in main.ts."
    );
  }
  return client;
}

// src/index.ts
var import_core2 = require("@ciph/core");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CIPH_CLIENT_KEY,
  CiphError,
  CiphPlugin,
  autoInitClientEmitter,
  createClient,
  emitClientLog,
  useCiph
});
//# sourceMappingURL=index.js.map