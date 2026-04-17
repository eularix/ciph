// @ciph/devtools-client v0.1.0
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
  CiphDevtoolsClient: () => CiphDevtoolsClient
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var CiphDevtoolsClient = class {
  maxLogs;
  filter;
  logs = [];
  logCallbacks = [];
  clientUnsubscribe;
  serverUnsubscribe;
  connected = false;
  autoConnect;
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
    disabled = false
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
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => client.clearLogs(), style: { padding: "4px 8px", fontSize: 12, cursor: "pointer" }, children: "Clear" })
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
//# sourceMappingURL=index.cjs.map