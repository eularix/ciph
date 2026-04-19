"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CiphError: () => import_core2.CiphError,
  CiphInspector: () => CiphInspector,
  CiphProvider: () => CiphProvider,
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

// src/context.tsx
var import_react2 = require("react");

// src/devtools/CiphDevtoolsPanel.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function statusColor(status) {
  if (status >= 500) return "#f87171";
  if (status >= 400) return "#fb923c";
  if (status >= 200) return "#4ade80";
  return "#a1a5b7";
}
function methodColor(method) {
  const m = {
    GET: { bg: "rgba(96,165,250,0.15)", text: "#60a5fa" },
    POST: { bg: "rgba(74,222,128,0.15)", text: "#4ade80" },
    PUT: { bg: "rgba(251,146,60,0.15)", text: "#fb923c" },
    PATCH: { bg: "rgba(216,180,254,0.15)", text: "#d8b4fe" },
    DELETE: { bg: "rgba(248,113,113,0.15)", text: "#f87171" }
  };
  return m[method] ?? { bg: "rgba(156,164,200,0.1)", text: "#a1a5b7" };
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
function snapToEdge(clientX, clientY) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dl = clientX;
  const dr = W - clientX;
  const dt = clientY;
  const db = H - clientY;
  const min = Math.min(dl, dr, dt, db);
  if (min === db) return { side: "bottom", offset: clamp(clientX - 45, 8, W - 100) };
  if (min === dt) return { side: "top", offset: clamp(clientX - 45, 8, W - 100) };
  if (min === dl) return { side: "left", offset: clamp(clientY - 18, 8, H - 44) };
  return { side: "right", offset: clamp(clientY - 18, 8, H - 44) };
}
function btnStyleFromSnap(snap) {
  const base = { position: "fixed", zIndex: 1000001 };
  const pad = 16;
  if (snap.side === "bottom") return { ...base, bottom: pad, left: snap.offset };
  if (snap.side === "top") return { ...base, top: pad, left: snap.offset };
  if (snap.side === "left") return { ...base, left: pad, top: snap.offset };
  return { ...base, right: pad, top: snap.offset };
}
function defaultBtnStyle(pos = "bottom-right") {
  const base = { position: "fixed", zIndex: 1000001 };
  if (pos === "bottom-right") return { ...base, bottom: 20, right: 20 };
  if (pos === "bottom-left") return { ...base, bottom: 20, left: 20 };
  if (pos === "top-right") return { ...base, top: 20, right: 20 };
  if (pos === "top-left") return { ...base, top: 20, left: 20 };
  if (pos === "bottom") return { ...base, bottom: 20, left: "50%", transform: "translateX(-50%)" };
  if (pos === "top") return { ...base, top: 20, left: "50%", transform: "translateX(-50%)" };
  if (pos === "left") return { ...base, left: 20, bottom: "30%" };
  if (pos === "right") return { ...base, right: 20, bottom: "30%" };
  return { ...base, bottom: 20, right: 20 };
}
function floatingPanelStyle(snap, pos) {
  const PANEL_W = 860;
  const PANEL_H = 560;
  const base = { position: "fixed", width: PANEL_W, height: PANEL_H, zIndex: 999998 };
  const W = typeof window !== "undefined" ? window.innerWidth : 1440;
  const H = typeof window !== "undefined" ? window.innerHeight : 900;
  const side = snap?.side ?? (pos.includes("bottom") ? "bottom" : pos.includes("top") ? "top" : pos === "left" ? "left" : "right");
  if (side === "bottom") {
    const btnLeft = snap?.offset ?? W - 100;
    return { ...base, bottom: 60, left: clamp(btnLeft - PANEL_W + 100, 8, W - PANEL_W - 8) };
  }
  if (side === "top") {
    const btnLeft = snap?.offset ?? W - 100;
    return { ...base, top: 60, left: clamp(btnLeft - PANEL_W + 100, 8, W - PANEL_W - 8) };
  }
  if (side === "left") {
    const btnTop2 = snap?.offset ?? H - 44;
    return { ...base, left: 60, top: clamp(btnTop2 - PANEL_H + 44, 8, H - PANEL_H - 8) };
  }
  const btnTop = snap?.offset ?? H - 44;
  return { ...base, right: 60, top: clamp(btnTop - PANEL_H + 44, 8, H - PANEL_H - 8) };
}
function DevtoolsPanel({
  maxLogs = 500,
  defaultOpen = false,
  position = "bottom-right",
  client
}) {
  const [open, setOpen] = (0, import_react.useState)(defaultOpen);
  const [entries, setEntries] = (0, import_react.useState)([]);
  const [selected, setSelected] = (0, import_react.useState)(null);
  const [isRequesting, setIsRequesting] = (0, import_react.useState)(false);
  const isDocked = !position.includes("-");
  const [panelSize, setPanelSize] = (0, import_react.useState)(() => position === "left" || position === "right" ? 500 : 350);
  const panelDragRef = (0, import_react.useRef)(false);
  const [btnSnap, setBtnSnap] = (0, import_react.useState)(null);
  const [liveDragXY, setLiveDragXY] = (0, import_react.useState)(null);
  const btnDragRef = (0, import_react.useRef)({ active: false, hasMoved: false });
  const logsRef = (0, import_react.useRef)([]);
  (0, import_react.useEffect)(() => {
    if (!isDocked) return;
    const onMouseMove = (e) => {
      if (!panelDragRef.current) return;
      if (position === "bottom") setPanelSize(Math.max(200, window.innerHeight - e.clientY));
      else if (position === "top") setPanelSize(Math.max(200, e.clientY));
      else if (position === "right") setPanelSize(Math.max(300, window.innerWidth - e.clientX));
      else if (position === "left") setPanelSize(Math.max(300, e.clientX));
    };
    const onMouseUp = () => {
      panelDragRef.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDocked, position]);
  (0, import_react.useEffect)(() => {
    const onMouseMove = (e) => {
      if (!btnDragRef.current.active) return;
      btnDragRef.current.hasMoved = true;
      setLiveDragXY({ x: e.clientX - 45, y: e.clientY - 18 });
    };
    const onMouseUp = (e) => {
      if (!btnDragRef.current.active) return;
      btnDragRef.current.active = false;
      if (btnDragRef.current.hasMoved) {
        setBtnSnap(snapToEdge(e.clientX, e.clientY));
        setLiveDragXY(null);
      } else {
        setLiveDragXY(null);
        setOpen((o) => !o);
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);
  (0, import_react.useEffect)(() => {
    const emitter = globalThis.__ciphClientEmitter__;
    if (!emitter) return;
    const unsub = emitter.on("log", (log) => {
      const entry = { id: log.id, log, receivedAt: Date.now() };
      logsRef.current = [entry, ...logsRef.current].slice(0, maxLogs);
      setEntries([...logsRef.current]);
    });
    return unsub;
  }, [maxLogs]);
  const sel = (selected !== null ? entries[selected] : null) ?? null;
  const colors = {
    bg: "#0a0e27",
    bg2: "#0f1423",
    bg3: "#151b3a",
    bg4: "#1a1f4f",
    border: "#2d3e7a",
    border2: "#1a2555",
    text: "#f0f4ff",
    text2: "#9ca4c8"
  };
  const toggleBtnStyle = liveDragXY ? { position: "fixed", left: liveDragXY.x, top: liveDragXY.y, zIndex: 1000001, cursor: "grabbing" } : btnSnap ? btnStyleFromSnap(btnSnap) : defaultBtnStyle(position);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    open && isDocked && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      position: "fixed",
      ...position === "bottom" ? { bottom: 0, left: 0, right: 0, height: panelSize } : {},
      ...position === "top" ? { top: 0, left: 0, right: 0, height: panelSize } : {},
      ...position === "left" ? { top: 0, bottom: 0, left: 0, width: panelSize } : {},
      ...position === "right" ? { top: 0, bottom: 0, right: 0, width: panelSize } : {},
      zIndex: 999998,
      boxShadow: "0 0 32px rgba(0,0,0,0.4)",
      background: colors.bg,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif",
      fontSize: 13,
      color: colors.text,
      borderTop: position === "bottom" ? `1px solid ${colors.border}` : void 0,
      borderBottom: position === "top" ? `1px solid ${colors.border}` : void 0,
      borderRight: position === "left" ? `1px solid ${colors.border}` : void 0,
      borderLeft: position === "right" ? `1px solid ${colors.border}` : void 0
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          onMouseDown: (e) => {
            e.preventDefault();
            panelDragRef.current = true;
          },
          style: {
            position: "absolute",
            zIndex: 999999,
            cursor: position === "top" || position === "bottom" ? "ns-resize" : "ew-resize",
            ...position === "bottom" ? { top: -2, left: 0, right: 0, height: 6 } : {},
            ...position === "top" ? { bottom: -2, left: 0, right: 0, height: 6 } : {},
            ...position === "left" ? { top: 0, bottom: 0, right: -2, width: 6 } : {},
            ...position === "right" ? { top: 0, bottom: 0, left: -2, width: 6 } : {}
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        PanelContent,
        {
          colors,
          entries,
          selected,
          setSelected,
          sel,
          onClear: () => {
            logsRef.current = [];
            setEntries([]);
            setSelected(null);
          },
          onClose: () => setOpen(false),
          client,
          isRequesting,
          setIsRequesting
        }
      )
    ] }),
    open && !isDocked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      ...floatingPanelStyle(btnSnap, position),
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif",
      fontSize: 13,
      color: colors.text
    }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      PanelContent,
      {
        colors,
        entries,
        selected,
        setSelected,
        sel,
        onClear: () => {
          logsRef.current = [];
          setEntries([]);
          setSelected(null);
        },
        onClose: () => setOpen(false),
        client,
        isRequesting,
        setIsRequesting
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        onMouseDown: (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          btnDragRef.current = { active: true, hasMoved: false };
        },
        style: {
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
          transition: "all 0.2s ease"
        },
        title: "Drag to move \xB7 Click to toggle",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "48", height: "18", viewBox: "0 0 140 53", fill: "none", "aria-label": "Ciph", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M53.95 0C60.8535 6.18481e-05 66.45 5.59648 66.45 12.5C66.45 17.9216 62.998 22.5361 58.1723 24.2677C57.6991 24.4375 57.3892 24.9076 57.4619 25.405L61.2026 50.995C61.2908 51.5985 60.823 52.1396 60.2131 52.1396H47.6868C47.077 52.1396 46.6092 51.5985 46.6974 50.995L50.4371 25.405C50.5098 24.9075 50.2 24.4375 49.7268 24.2677C44.9014 22.5359 41.45 17.9214 41.45 12.5C41.45 5.59644 47.0464 0 53.95 0Z", fill: "white" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M78.45 52.05C77.3454 52.05 76.45 51.1546 76.45 50.05V16.5C76.45 15.3954 77.3454 14.5 78.45 14.5H82.1483C83.2137 14.5 84.0921 15.3352 84.1458 16.3993L84.3022 19.5019C84.3255 19.9642 83.8841 20.3102 83.4408 20.1772C83.1069 20.0771 82.9014 19.7358 83.0119 19.4052C83.3023 18.5368 83.815 17.735 84.55 17C85.45 16.1 86.5833 15.3833 87.95 14.85C89.35 14.2833 90.8167 14 92.35 14C94.6167 14 96.6333 14.6 98.4 15.8C100.167 16.9667 101.55 18.5833 102.55 20.65C103.583 22.6833 104.1 25.05 104.1 27.75C104.1 30.4167 103.583 32.7833 102.55 34.85C101.55 36.9167 100.15 38.55 98.35 39.75C96.5833 40.9167 94.55 41.5 92.25 41.5C90.75 41.5 89.3167 41.2167 87.95 40.65C86.5833 40.0833 85.4333 39.3167 84.5 38.35C83.7677 37.5915 83.2303 36.7817 82.8879 35.9207C82.7285 35.5197 82.9567 35.084 83.3602 34.9313C83.911 34.7229 84.5 35.1298 84.5 35.7187V50.05C84.5 51.1546 83.6046 52.05 82.5 52.05H78.45ZM90.3 34.75C91.5 34.75 92.55 34.4667 93.45 33.9C94.35 33.3 95.05 32.4833 95.55 31.45C96.05 30.4167 96.3 29.1833 96.3 27.75C96.3 26.35 96.05 25.1333 95.55 24.1C95.05 23.0333 94.35 22.2167 93.45 21.65C92.5833 21.05 91.5333 20.75 90.3 20.75C89.0667 20.75 88 21.0333 87.1 21.6C86.2 22.1667 85.5 22.9833 85 24.05C84.5 25.1167 84.25 26.35 84.25 27.75C84.25 29.1833 84.5 30.4167 85 31.45C85.5 32.4833 86.2 33.3 87.1 33.9C88 34.4667 89.0667 34.75 90.3 34.75Z", fill: "white" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18.15 52.2C15.5167 52.2 13.0833 51.7667 10.85 50.9C8.65 50 6.73333 48.75 5.1 47.15C3.46667 45.5167 2.2 43.6 1.3 41.4C0.433333 39.1667 0 36.7167 0 34.05C0 31.45 0.466667 29.05 1.4 26.85C2.33333 24.65 3.61667 22.75 5.25 21.15C6.91667 19.5167 8.86667 18.25 11.1 17.35C13.3667 16.45 15.8333 16 18.5 16C20.1667 16 21.8 16.2167 23.4 16.65C25 17.0833 26.4833 17.7333 27.85 18.6C28.7261 19.1215 29.524 19.7083 30.2434 20.3604C30.9798 21.0277 30.9648 22.1551 30.3109 22.9034L27.6908 25.9014C26.917 26.7867 25.5578 26.8011 24.6204 26.0912C24.417 25.9372 24.2102 25.7902 24 25.65C23.2333 25.0833 22.3833 24.65 21.45 24.35C20.5167 24.05 19.5167 23.9 18.45 23.9C17.1167 23.9 15.85 24.15 14.65 24.65C13.4833 25.1167 12.45 25.8 11.55 26.7C10.6833 27.5667 10 28.6333 9.5 29.9C9 31.1667 8.75 32.5833 8.75 34.15C8.75 35.6833 9 37.0833 9.5 38.35C10 39.5833 10.7 40.65 11.6 41.55C12.5 42.45 13.5833 43.1333 14.85 43.6C16.15 44.0667 17.5833 44.3 19.15 44.3C20.2167 44.3 21.2333 44.15 22.2 43.85C23.1667 43.55 24.05 43.15 24.85 42.65C24.9287 42.5996 25.0066 42.5486 25.0835 42.497C26.1666 41.7711 27.7257 41.9212 28.4213 43.024L30.3459 46.0752C30.822 46.8299 30.7501 47.8232 30.058 48.3864C29.4121 48.9119 28.6594 49.3998 27.8 49.85C26.4333 50.5833 24.9 51.1667 23.2 51.6C21.5333 52 19.85 52.2 18.15 52.2Z", fill: "white" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M115.75 52C114.839 52 114.1 51.2613 114.1 50.35V17C114.1 15.8954 114.995 15 116.1 15H119.95C121.055 15 121.95 15.8954 121.95 17V30.4151C121.95 30.6767 121.788 30.9109 121.543 31.0027C121.055 31.1855 120.589 30.734 120.821 30.2681C121.191 29.5279 121.684 28.8385 122.3 28.2C123.267 27.2 124.417 26.4 125.75 25.8C127.083 25.2 128.483 24.9 129.95 24.9C131.95 24.9 133.633 25.3167 135 26.15C136.367 26.95 137.4 28.1667 138.1 29.8C138.8 31.4 139.15 33.3667 139.15 35.7V50C139.15 51.1046 138.255 52 137.15 52H133.1C131.995 52 131.1 51.1046 131.1 50V36.35C131.1 35.2833 130.95 34.4 130.65 33.7C130.35 33 129.883 32.4833 129.25 32.15C128.65 31.7833 127.9 31.6167 127 31.65C126.3 31.65 125.65 31.7667 125.05 32C124.45 32.2 123.933 32.5167 123.5 32.95C123.067 33.35 122.717 33.8167 122.45 34.35C122.217 34.8833 122.1 35.4667 122.1 36.1V50C122.1 51.1046 121.205 52 120.1 52H118.15C117.217 52 116.417 52 115.75 52Z", fill: "white" })
          ] }),
          entries.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { background: "rgba(99,102,241,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 9999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }, children: entries.length })
        ]
      }
    )
  ] });
}
function PanelContent({ colors, entries, selected, setSelected, sel, onClear, onClose, client, isRequesting, setIsRequesting }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { background: `linear-gradient(135deg, ${colors.bg2} 0%, ${colors.bg3} 100%)`, borderBottom: `1px solid ${colors.border}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 14, fontWeight: 700, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, children: "\u{1F6E1}\uFE0F Ciph" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 11, background: colors.bg3, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "3px 8px", color: colors.text2, fontWeight: 500 }, children: [
        entries.length,
        " ",
        entries.length === 1 ? "request" : "requests"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: colors.text2, background: "rgba(99,102,241,0.1)", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "3px 7px", fontWeight: 500 }, children: "client" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { flex: 1 } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          onClick: onClear,
          style: { padding: "6px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg3, color: colors.text2, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500, transition: "all 0.2s ease" },
          onMouseEnter: (e) => {
            e.currentTarget.style.color = colors.text;
            e.currentTarget.style.borderColor = "#6366f1";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.color = colors.text2;
            e.currentTarget.style.borderColor = colors.border;
          },
          children: "Clear"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          onClick: onClose,
          style: { padding: "6px 10px", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg3, color: colors.text2, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500, transition: "all 0.2s ease" },
          onMouseEnter: (e) => {
            e.currentTarget.style.color = colors.text;
            e.currentTarget.style.borderColor = "#f87171";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.color = colors.text2;
            e.currentTarget.style.borderColor = colors.border;
          },
          children: "\u2715"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flex: 1, overflow: "hidden" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { width: "480px", borderRight: `1px solid ${colors.border}`, overflowY: "auto", flexShrink: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { position: "sticky", top: 0, background: colors.bg2, borderBottom: `1px solid ${colors.border}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: "12px", color: colors.text2, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { minWidth: "60px" }, children: "Method" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1, minWidth: "200px" }, children: "Route" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { minWidth: "50px", textAlign: "center" }, children: "Status" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { minWidth: "50px", textAlign: "right" }, children: "Time" })
        ] }),
        entries.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 24, color: colors.text2, fontSize: 13, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0.5, fontSize: 24 }, children: "\u25CB" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            "No requests yet.",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, color: colors.text2, opacity: 0.7 }, children: "Make an API call to see logs" })
          ] })
        ] }),
        entries.map((e, i) => {
          const mc = methodColor(e.log.method);
          const isSel = selected === i;
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              onClick: () => setSelected(i),
              style: {
                padding: "11px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                borderBottom: `1px solid ${colors.border}`,
                borderLeft: `3px solid ${isSel ? "#60a5fa" : e.log.status >= 400 ? e.log.status >= 500 ? "#f87171" : "#fb923c" : "transparent"}`,
                cursor: "pointer",
                background: isSel ? colors.bg3 : "transparent",
                transition: "all 0.15s ease"
              },
              onMouseEnter: (e2) => {
                if (!isSel) e2.currentTarget.style.background = colors.bg3;
              },
              onMouseLeave: (e2) => {
                if (!isSel) e2.currentTarget.style.background = "transparent";
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, fontWeight: 700, padding: "3px 6px", borderRadius: 6, background: mc.bg, color: mc.text, textAlign: "center", minWidth: 60 }, children: e.log.method }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: colors.text, fontSize: 12, flex: 1, minWidth: 200 }, children: e.log.route }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: statusColor(e.log.status), fontWeight: 600, fontSize: 12, textAlign: "center", minWidth: 50 }, children: e.log.status || "\u2026" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: colors.text2, fontSize: 12, textAlign: "right", minWidth: 50 }, children: [
                  e.log.duration,
                  "ms"
                ] })
              ]
            },
            e.id
          );
        })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { flex: 1, overflowY: "auto", padding: 14 }, children: !sel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: colors.text2, fontSize: 13 }, children: "\u2190 Select a request to inspect" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${colors.border}` }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }, children: [
            (() => {
              const mc = methodColor(sel.log.method);
              return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: mc.bg, color: mc.text }, children: sel.log.method });
            })(),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600, fontSize: 13 }, children: sel.log.route }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 700, color: statusColor(sel.log.status) }, children: sel.log.status || "\u2026" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, padding: "2px 6px", borderRadius: 4, background: sel.log.excluded ? colors.bg3 : "#0d1b2e", color: sel.log.excluded ? colors.text2 : "#58a6ff" }, children: sel.log.excluded ? "\u25CB Plain" : "\u{1F512} Encrypted" }),
            client && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                disabled: isRequesting,
                onClick: async () => {
                  if (isRequesting) return;
                  setIsRequesting(true);
                  try {
                    const m = sel.log.method.toLowerCase();
                    const isBodyMethod = ["post", "put", "patch", "delete"].includes(m);
                    if (isBodyMethod) {
                      await client[m](sel.log.route, sel.log.request.plainBody, { headers: sel.log.request.headers });
                    } else {
                      await client[m](sel.log.route, { headers: sel.log.request.headers });
                    }
                  } finally {
                    setIsRequesting(false);
                  }
                },
                style: { marginLeft: "auto", padding: "3px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: isRequesting ? colors.bg2 : "#0d2010", color: isRequesting ? colors.text2 : "#3fb950", cursor: isRequesting ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "inherit" },
                children: isRequesting ? "Sending..." : "\u21BB Re-request"
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { color: colors.text2, fontSize: 10, display: "flex", gap: 12 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: sel.log.timestamp }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
              sel.log.duration,
              "ms"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
              "fp: ",
              sel.log.fingerprint.value ? sel.log.fingerprint.value.slice(0, 12) + "\u2026" : "\u2014"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }, children: [
          ["Request (Plain)", fmtBody(sel.log.request.plainBody)],
          ["Response (Plain)", fmtBody(sel.log.response.plainBody)]
        ].map(([label, content]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 10, color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }, children: label }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 10, overflowX: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: { margin: 0, color: colors.text, fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }, children: content }) })
        ] }, label)) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, children: [
          ["Request Encrypted", trunc(sel.log.request.encryptedBody)],
          ["Response Encrypted", trunc(sel.log.response.encryptedBody)]
        ].map(([label, content]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 10, color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }, children: label }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 10, overflowX: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: { margin: 0, color: colors.text2, fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }, children: content }) })
        ] }, label)) })
      ] }) })
    ] })
  ] });
}
var CiphDevtoolsPanel = process.env.NODE_ENV === "production" ? () => null : DevtoolsPanel;

// src/context.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
if (process.env.NODE_ENV !== "production") {
  autoInitClientEmitter();
}
var CiphContext = (0, import_react2.createContext)(null);
function CiphProvider({ children, devtools: devtoolsConfig, ...config }) {
  const client = (0, import_react2.useMemo)(() => createClient(config), [config.baseURL, config.serverPublicKey]);
  const isProduction = process.env.NODE_ENV === "production";
  const devtoolsEnabled = !isProduction && devtoolsConfig !== false && (devtoolsConfig?.enabled ?? true);
  const dt = devtoolsConfig !== false ? devtoolsConfig : void 0;
  const panelProps = {};
  if (dt?.maxLogs !== void 0) panelProps.maxLogs = dt.maxLogs;
  if (dt?.defaultOpen !== void 0) panelProps.defaultOpen = dt.defaultOpen;
  if (dt?.position !== void 0) panelProps.position = dt.position;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(CiphContext.Provider, { value: client, children: [
    children,
    devtoolsEnabled && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CiphDevtoolsPanel, { client, ...panelProps })
  ] });
}
function useCiph() {
  const client = (0, import_react2.useContext)(CiphContext);
  if (!client) {
    throw new Error(
      "[ciph] useCiph() called outside <CiphProvider>. Wrap your app with <CiphProvider baseURL=... serverPublicKey=...>."
    );
  }
  return client;
}

// src/devtools/CiphInspector.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
function statusColor2(status) {
  if (status >= 500) return "#f85149";
  if (status >= 400) return "#d29922";
  if (status >= 200) return "#3fb950";
  return "#8b949e";
}
function methodColor2(method) {
  const m = {
    GET: { bg: "#0d1b2e", text: "#58a6ff" },
    POST: { bg: "#0d2010", text: "#3fb950" },
    PUT: { bg: "#1e1500", text: "#d29922" },
    PATCH: { bg: "#1a0d2e", text: "#bc8cff" },
    DELETE: { bg: "#2e0d0d", text: "#f85149" }
  };
  return m[method] ?? { bg: "#1c2230", text: "#8b949e" };
}
function fmtBody2(v) {
  if (v === null || v === void 0) return "\u2014";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
function trunc2(s) {
  if (!s) return "\u2014";
  return s.length > 120 ? s.slice(0, 120) + "\u2026" : s;
}
function Inspector({ maxLogs = 500 }) {
  const [entries, setEntries] = (0, import_react3.useState)([]);
  const [selected, setSelected] = (0, import_react3.useState)(null);
  const [isRequesting, setIsRequesting] = (0, import_react3.useState)(false);
  const logsRef = (0, import_react3.useRef)([]);
  let client;
  try {
    client = useCiph();
  } catch {
  }
  (0, import_react3.useEffect)(() => {
    const emitter = globalThis.__ciphClientEmitter__;
    if (!emitter) return;
    const unsub = emitter.on("log", (log) => {
      const entry = { id: log.id, log, receivedAt: Date.now() };
      logsRef.current = [entry, ...logsRef.current].slice(0, maxLogs);
      setEntries([...logsRef.current]);
    });
    return unsub;
  }, [maxLogs]);
  const sel = selected !== null ? entries[selected] : null;
  const colors = {
    bg: "#0f1117",
    bg2: "#161b22",
    bg3: "#1c2230",
    border: "#30363d",
    text: "#e6edf3",
    text2: "#8b949e"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
    width: "100vw",
    height: "100vh",
    background: colors.bg,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: "'Menlo','Monaco','Consolas',monospace",
    fontSize: 13,
    color: colors.text,
    margin: 0
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { background: colors.bg2, borderBottom: `1px solid ${colors.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }, children: "\u{1F6E1}\uFE0F Ciph Inspector" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: { fontSize: 11, background: colors.bg3, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "2px 8px", color: colors.text2 }, children: [
        entries.length,
        " request",
        entries.length !== 1 ? "s" : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 11, color: colors.text2, background: "#0d2010", border: "1px solid #3fb95033", borderRadius: 6, padding: "2px 6px" }, children: "client-only \u2726" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { flex: 1 } }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          onClick: () => {
            logsRef.current = [];
            setEntries([]);
            setSelected(null);
          },
          style: { padding: "5px 14px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.bg3, color: colors.text2, cursor: "pointer", fontSize: 12, fontFamily: "inherit" },
          children: "Clear"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", flex: 1, overflow: "hidden" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { width: 400, borderRight: `1px solid ${colors.border}`, overflowY: "auto", flexShrink: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { position: "sticky", top: 0, background: colors.bg2, borderBottom: `1px solid ${colors.border}`, padding: "8px 12px", display: "grid", gridTemplateColumns: "60px 1fr 50px 46px", gap: 8, color: colors.text2, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "Method" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "Route" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "Status" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "ms" })
        ] }),
        entries.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { padding: 30, color: colors.text2, fontSize: 13, textAlign: "center", lineHeight: 1.5 }, children: [
          "No requests yet.",
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("br", {}),
          "Trigger API calls from other tabs.",
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("br", {}),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 11, color: "#58a6ff" }, children: "(Cross-tab sync is active)" })
        ] }),
        entries.map((e, i) => {
          const mc = methodColor2(e.log.method);
          const isSel = selected === i;
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "div",
            {
              onClick: () => setSelected(i),
              style: {
                padding: "9px 12px",
                display: "grid",
                gridTemplateColumns: "60px 1fr 50px 46px",
                gap: 8,
                borderBottom: `1px solid ${colors.border}`,
                borderLeft: `2px solid ${isSel ? "#58a6ff" : e.log.status >= 400 ? "#f85149" : "transparent"}`,
                cursor: "pointer",
                background: isSel ? colors.bg3 : "transparent",
                alignItems: "center"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 10, fontWeight: 700, padding: "2px 4px", borderRadius: 4, background: mc.bg, color: mc.text, textAlign: "center" }, children: e.log.method }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: colors.text, fontSize: 12 }, children: e.log.route }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: statusColor2(e.log.status), fontWeight: 600, fontSize: 12 }, children: e.log.status || "\u2026" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: { color: colors.text2, fontSize: 11 }, children: [
                  e.log.duration,
                  "ms"
                ] })
              ]
            },
            e.id
          );
        })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { flex: 1, overflowY: "auto", padding: 20 }, children: !sel ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: colors.text2, fontSize: 14 }, children: "\u2190 Select a request to inspect" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${colors.border}` }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }, children: [
            (() => {
              const mc = methodColor2(sel.log.method);
              return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: mc.bg, color: mc.text }, children: sel.log.method });
            })(),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontWeight: 600, fontSize: 15 }, children: sel.log.route }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontWeight: 700, color: statusColor2(sel.log.status), fontSize: 13 }, children: sel.log.status || "\u2026" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 11, padding: "3px 8px", borderRadius: 4, background: sel.log.excluded ? colors.bg3 : "#0d1b2e", color: sel.log.excluded ? colors.text2 : "#58a6ff" }, children: sel.log.excluded ? "\u25CB Plain" : "\u{1F512} Encrypted" }),
            client && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                disabled: isRequesting,
                onClick: async () => {
                  if (isRequesting) return;
                  setIsRequesting(true);
                  try {
                    const m = sel.log.method.toLowerCase();
                    const isBodyMethod = ["post", "put", "patch", "delete"].includes(m);
                    if (isBodyMethod) {
                      await client[m](sel.log.route, sel.log.request.plainBody, {
                        headers: sel.log.request.headers
                      });
                    } else {
                      await client[m](sel.log.route, {
                        headers: sel.log.request.headers
                      });
                    }
                  } finally {
                    setIsRequesting(false);
                  }
                },
                style: { marginLeft: "auto", padding: "4px 12px", borderRadius: 6, border: `1px solid ${colors.border}`, background: isRequesting ? colors.bg2 : "#0d2010", color: isRequesting ? colors.text2 : "#3fb950", cursor: isRequesting ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit" },
                children: isRequesting ? "Sending..." : "\u21BB Re-request"
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { color: colors.text2, fontSize: 12, display: "flex", gap: 16 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: sel.log.timestamp }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
              sel.log.duration,
              "ms"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
              "fp: ",
              sel.log.fingerprint.value ? sel.log.fingerprint.value.slice(0, 16) + "\u2026" : "\u2014"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }, children: [
          ["Request (Plain)", fmtBody2(sel.log.request.plainBody)],
          ["Response (Plain)", fmtBody2(sel.log.response.plainBody)]
        ].map(([label, content]) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 11, color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }, children: label }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 12, overflowX: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("pre", { style: { margin: 0, color: colors.text, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }, children: content }) })
        ] }, label)) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }, children: [
          ["Request Encrypted", trunc2(sel.log.request.encryptedBody)],
          ["Response Encrypted", trunc2(sel.log.response.encryptedBody)]
        ].map(([label, content]) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 11, color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }, children: label }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 12, overflowX: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("pre", { style: { margin: 0, color: colors.text2, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }, children: content }) })
        ] }, label)) })
      ] }) })
    ] })
  ] });
}
var CiphInspector = process.env.NODE_ENV === "production" ? () => null : Inspector;

// src/index.ts
var import_core2 = require("@ciph/core");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CiphError,
  CiphInspector,
  CiphProvider,
  autoInitClientEmitter,
  createClient,
  emitClientLog,
  useCiph
});
//# sourceMappingURL=index.js.map