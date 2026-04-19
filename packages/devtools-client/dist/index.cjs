// @ciph/devtools-client v0.2.0-beta.1
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CiphDevtools: () => CiphDevtools,
  CiphDevtoolsClient: () => CiphDevtoolsClient,
  CiphInspectorPage: () => CiphInspectorPage
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var BROADCAST_CHANNEL = "ciph-devtools";
var CiphDevtoolsClient = class {
  maxLogs;
  filter;
  logs = [];
  logCallbacks = [];
  clientUnsubscribe;
  serverUnsubscribe;
  connected = false;
  autoConnect;
  channel = null;
  constructor(options = {}) {
    this.maxLogs = options.maxLogs ?? 500;
    this.filter = options.filter;
    this.autoConnect = options.autoConnect ?? true;
    if (this.autoConnect) {
      this.connect();
    }
  }
  connect() {
    if (this.connected) return;
    const root = globalThis;
    const clientEmitter = root.__ciphClientEmitter__;
    if (clientEmitter?.on) {
      this.clientUnsubscribe = clientEmitter.on("log", (log) => {
        const clientLog = log;
        const entry = {
          id: clientLog.id,
          source: "client",
          timestamp: clientLog.timestamp,
          log: clientLog
        };
        this.addLog(entry);
      });
    }
    const serverEmitter = root.ciphServerEmitter;
    if (serverEmitter?.on) {
      this.serverUnsubscribe = serverEmitter.on("log", (log) => {
        const serverLog = log;
        const entry = {
          id: serverLog.id,
          source: "server",
          timestamp: serverLog.timestamp,
          log: serverLog
        };
        this.addLog(entry);
      });
    }
    this.connected = true;
  }
  disconnect() {
    this.clientUnsubscribe?.();
    this.serverUnsubscribe?.();
    this.clientUnsubscribe = void 0;
    this.serverUnsubscribe = void 0;
    this.connected = false;
  }
  addLog(entry) {
    if (this.filter?.(entry) === false) return;
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    if (typeof BroadcastChannel !== "undefined") {
      if (!this.channel) {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL);
      }
      this.channel.postMessage(entry);
    }
    for (const cb of this.logCallbacks) {
      cb(entry);
    }
  }
  getLogs() {
    return [...this.logs];
  }
  clearLogs() {
    this.logs = [];
  }
  onLog(callback) {
    this.logCallbacks.push(callback);
    return () => {
      const index = this.logCallbacks.indexOf(callback);
      if (index >= 0) {
        this.logCallbacks.splice(index, 1);
      }
    };
  }
  getStats() {
    if (this.logs.length === 0) {
      return {
        totalRequests: 0,
        totalErrors: 0,
        avgDuration: 0,
        encryptedCount: 0,
        excludedCount: 0,
        errorBreakdown: {}
      };
    }
    let totalDuration = 0;
    let totalErrors = 0;
    let encryptedCount = 0;
    let excludedCount = 0;
    const errorBreakdown = {};
    for (const entry of this.logs) {
      const log = entry.log;
      totalDuration += log.duration;
      if (log.status >= 400) {
        totalErrors += 1;
      }
      if (log.excluded) {
        excludedCount += 1;
      } else {
        encryptedCount += 1;
      }
      if ("error" in log && log.error) {
        const errorCode = log.error;
        errorBreakdown[errorCode] = (errorBreakdown[errorCode] ?? 0) + 1;
      }
    }
    return {
      totalRequests: this.logs.length,
      totalErrors,
      avgDuration: Math.round(totalDuration / this.logs.length),
      encryptedCount,
      excludedCount,
      errorBreakdown
    };
  }
  isConnected() {
    return this.connected;
  }
};

// src/react/CiphDevtools.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function DevtoolsComponent(props) {
  const {
    defaultOpen = false,
    maxLogs,
    filter,
    disabled = false,
    inspectorUrl = "/ciph-inspector"
  } = props;
  const [isOpen, setIsOpen] = (0, import_react.useState)(defaultOpen);
  const [logs, setLogs] = (0, import_react.useState)([]);
  const client = (0, import_react.useMemo)(() => new CiphDevtoolsClient({
    ...maxLogs !== void 0 && { maxLogs },
    ...filter !== void 0 && { filter }
  }), [maxLogs, filter]);
  (0, import_react.useEffect)(() => {
    if (disabled) return;
    client.connect();
    setLogs(client.getLogs());
    const unsubscribe = client.onLog(() => {
      setLogs(client.getLogs());
    });
    return () => {
      unsubscribe();
      client.disconnect();
    };
  }, [client, disabled]);
  if (disabled || false) {
    return null;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { position: "fixed", bottom: 20, right: 20, zIndex: 9999, fontFamily: "system-ui" }, children: [
    isOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { position: "absolute", bottom: 50, right: 0, width: 450, height: 600, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", overflow: "auto", display: "flex", flexDirection: "column" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 12, borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { margin: 0, fontSize: 16 }, children: "Ciph Security Inspector" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              onClick: () => window.open(inspectorUrl, "_blank", "noopener,noreferrer"),
              style: { padding: "4px 8px", fontSize: 12, cursor: "pointer" },
              title: "Open full inspector in new tab",
              children: "\u2197 Full Inspector"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => client.clearLogs(), style: { padding: "4px 8px", fontSize: 12, cursor: "pointer" }, children: "Clear" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 12, flex: 1, overflow: "auto" }, children: [
        logs.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { color: "#6b7280", fontSize: 14 }, children: "No requests captured yet." }),
        logs.map((log) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: 12, padding: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 8 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { style: { color: log.log.status >= 400 ? "#ef4444" : "#10b981", fontSize: 14 }, children: [
              log.log.method,
              " ",
              log.log.route
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: "#6b7280" }, children: log.source })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, background: "#f3f4f6", padding: 8, borderRadius: 4, overflowX: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: { margin: 0 }, children: JSON.stringify(log.log.request.plainBody, null, 2) || "No body" }) })
        ] }, log.id))
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setIsOpen(!isOpen), style: { padding: "10px 16px", background: "#111827", color: "white", borderRadius: 24, border: "none", cursor: "pointer", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontWeight: 600 }, children: "\u{1F6E1}\uFE0F Ciph Inspector" })
  ] });
}
var CiphDevtools = false ? () => null : DevtoolsComponent;

// src/react/CiphInspectorPage.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var BROADCAST_CHANNEL2 = "ciph-devtools";
function statusColor(status) {
  if (status >= 500) return "#f85149";
  if (status >= 400) return "#d29922";
  return "#3fb950";
}
function methodBg(method) {
  const map = {
    GET: { background: "#0d1b2e", color: "#58a6ff" },
    POST: { background: "#0d2010", color: "#3fb950" },
    PUT: { background: "#1e1500", color: "#d29922" },
    PATCH: { background: "#1a0d2e", color: "#bc8cff" },
    DELETE: { background: "#2e0d0d", color: "#f85149" }
  };
  return map[method] ?? { background: "#1c2230", color: "#e6edf3" };
}
function fmt(v) {
  if (v === null || v === void 0) return "\u2014";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
function truncate(s, n = 120) {
  if (!s) return "\u2014";
  return s.length > n ? s.slice(0, n) + "\u2026" : s;
}
var S = {
  page: {
    margin: 0,
    padding: 0,
    background: "#0f1117",
    color: "#e6edf3",
    fontFamily: "'Menlo','Monaco','Consolas',monospace",
    fontSize: 13,
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  header: {
    background: "#161b22",
    borderBottom: "1px solid #30363d",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0
  },
  dot: (live) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: live ? "#3fb950" : "#f85149",
    boxShadow: live ? "0 0 6px #3fb950" : "none",
    flexShrink: 0
  }),
  badge: {
    background: "#1c2230",
    border: "1px solid #30363d",
    borderRadius: 10,
    padding: "2px 8px",
    fontSize: 11,
    color: "#8b949e"
  },
  btn: {
    padding: "5px 12px",
    borderRadius: 6,
    border: "1px solid #30363d",
    background: "#1c2230",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit"
  },
  main: { display: "flex", flex: 1, overflow: "hidden" },
  listWrap: {
    width: 400,
    borderRight: "1px solid #30363d",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    flexShrink: 0
  },
  listHead: {
    position: "sticky",
    top: 0,
    background: "#161b22",
    borderBottom: "1px solid #30363d",
    padding: "8px 12px",
    display: "grid",
    gridTemplateColumns: "60px 1fr 50px 50px",
    gap: 8,
    fontSize: 11,
    color: "#8b949e",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  listScroll: { overflowY: "auto", flex: 1 },
  row: (selected, isErr) => ({
    padding: "9px 12px",
    display: "grid",
    gridTemplateColumns: "60px 1fr 50px 50px",
    gap: 8,
    borderBottom: "1px solid #30363d",
    cursor: "pointer",
    alignItems: "center",
    background: selected ? "#1c2230" : "transparent",
    borderLeft: selected ? "2px solid #58a6ff" : isErr ? "2px solid #f85149" : "2px solid transparent"
  }),
  detail: { flex: 1, overflowY: "auto", padding: 20 },
  codeBlock: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 6,
    padding: 12,
    overflowX: "auto",
    marginBottom: 4
  },
  pre: { margin: 0, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#e6edf3" },
  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    color: "#8b949e",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 6,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  copyBtn: {
    fontSize: 10,
    padding: "2px 6px",
    cursor: "pointer",
    border: "1px solid #30363d",
    background: "#0f1117",
    color: "#8b949e",
    borderRadius: 4,
    fontFamily: "inherit"
  }
};
function CiphInspectorPage() {
  const [logs, setLogs] = (0, import_react2.useState)([]);
  const [selected, setSelected] = (0, import_react2.useState)(null);
  const [live, setLive] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(BROADCAST_CHANNEL2);
    setLive(true);
    ch.onmessage = (ev) => {
      setLogs((prev) => {
        const next = [ev.data, ...prev];
        if (next.length > 500) next.pop();
        return next;
      });
      setSelected((prev) => prev === null ? 0 : prev);
    };
    return () => {
      ch.close();
      setLive(false);
    };
  }, []);
  const clearLogs = (0, import_react2.useCallback)(() => {
    setLogs([]);
    setSelected(null);
  }, []);
  const copy = (0, import_react2.useCallback)((text) => {
    navigator.clipboard.writeText(text).catch(() => {
    });
  }, []);
  const selectedLog = selected !== null ? logs[selected] : null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: S.page, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: S.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: S.dot(live) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 15, fontWeight: 600 }, children: "\u{1F512} Ciph Inspector" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 11, color: "#8b949e" }, children: live ? "Live \u2014 listening for requests" : "Waiting for BroadcastChannel\u2026" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { flex: 1 } }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: S.badge, children: [
        logs.length,
        " request",
        logs.length !== 1 ? "s" : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { style: S.btn, onClick: clearLogs, children: "Clear" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: S.main, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: S.listWrap, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: S.listHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Method" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Route" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Status" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Time" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: S.listScroll, children: [
          logs.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { padding: "24px 16px", color: "#8b949e", fontSize: 13 }, children: live ? "Make requests from the app tab \u2014 they will appear here." : "BroadcastChannel not available in this browser." }),
          logs.map((entry, i) => {
            const { log } = entry;
            const isErr = log.status >= 400;
            const mStyle = methodBg(log.method);
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "div",
              {
                style: S.row(selected === i, isErr),
                onClick: () => setSelected(i),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { ...mStyle, fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 4, textAlign: "center" }, children: log.method }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }, children: log.route }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: statusColor(log.status), fontSize: 12, fontWeight: 600 }, children: log.status }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { color: "#8b949e", fontSize: 11 }, children: [
                    log.duration,
                    "ms"
                  ] })
                ]
              },
              entry.id
            );
          })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: S.detail, children: [
        !selectedLog && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#8b949e", fontSize: 14 }, children: "\u2190 Select a request to inspect" }),
        selectedLog && (() => {
          const { log } = selectedLog;
          const reqPlain = fmt(log.request.plainBody);
          const resPlain = fmt(log.response?.plainBody);
          const reqEnc = log.request.encryptedBody ?? "";
          const resEnc = log.response?.encryptedBody ?? "";
          const fp = log.fingerprint ?? {};
          const mStyle = methodBg(log.method);
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #30363d" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { ...mStyle, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }, children: log.method }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontWeight: 600, fontSize: 14 }, children: log.route }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: statusColor(log.status), fontWeight: 600 }, children: log.status }),
                !log.excluded && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { background: "#0d1b2e", color: "#58a6ff", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600 }, children: "\u{1F512} Encrypted" }),
                log.excluded && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { background: "#1c2230", color: "#8b949e", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600 }, children: "\u25CB Plain" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 16, fontSize: 11, color: "#8b949e" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: selectedLog.timestamp }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
                  log.duration,
                  "ms"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: selectedLog.source })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: S.cols, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: S.sectionTitle, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Request Body (Plain)" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: S.codeBlock, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { style: S.pre, children: reqPlain }) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: S.sectionTitle, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Response Body (Plain)" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: S.codeBlock, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { style: S.pre, children: resPlain }) })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: S.cols, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: S.sectionTitle, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Request Encrypted" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { style: S.copyBtn, onClick: () => copy(reqEnc), children: "Copy" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: S.codeBlock, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { style: S.pre, children: truncate(reqEnc) }) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: S.sectionTitle, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Response Encrypted" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { style: S.copyBtn, onClick: () => copy(resEnc), children: "Copy" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: S.codeBlock, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { style: S.pre, children: truncate(resEnc) }) })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginBottom: 16 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: S.sectionTitle, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Fingerprint" }) }),
              [
                ["Hash", fp.value ?? "\u2014"],
                ["IP Match", fp.ipMatch !== void 0 ? fp.ipMatch ? "\u2705" : "\u274C" : "\u2014"],
                ["UA Match", fp.uaMatch !== void 0 ? fp.uaMatch ? "\u2705" : "\u274C" : "\u2014"]
              ].map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8, padding: "4px 0", fontSize: 12 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "#58a6ff", minWidth: 100 }, children: k }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "#e6edf3", wordBreak: "break-all" }, children: v })
              ] }, k))
            ] })
          ] });
        })()
      ] })
    ] })
  ] });
}
//# sourceMappingURL=index.cjs.map