// src/client.ts
import axios from "axios";
import {
  CiphError,
  decrypt,
  deriveECDHBits,
  deriveRequestKey,
  deriveSessionKey,
  encrypt,
  generateFingerprint,
  generateKeyPair
} from "@ciph/core";

// src/devtools/emitter.ts
function autoInitClientEmitter() {
  if (typeof globalThis.__ciphClientEmitter__ !== "undefined") return;
  const listeners = [];
  globalThis.__ciphClientEmitter__ = {
    emit(event, log) {
      if (event === "log") {
        for (const l of listeners) l(log);
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
  const keyPair = await generateKeyPair();
  session.keyPair = keyPair;
  const rawShared = await deriveECDHBits(keyPair.privateKey, serverPublicKey);
  const sessionKey = await deriveSessionKey(rawShared);
  session.sessionKey = sessionKey;
  const components = await buildDeviceComponents(options, extraFields);
  const fpResult = await generateFingerprint(components);
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
  const instance = axios.create({
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
      const encryptedFp = await encrypt(JSON.stringify(fpComponents), sessionKey);
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
        const requestKey = await deriveRequestKey(sessionKey, fingerprintHash);
        const plain = typeof req.data === "string" ? req.data : JSON.stringify(req.data);
        const encrypted = await encrypt(plain, requestKey);
        req.data = encrypted.ciphertext;
        req._ciphEncryptedBody = encrypted.ciphertext;
        req.headers.set("Content-Type", "text/plain");
        emitClientLog(buildClientLog(req, req._ciphPlainBody, encrypted.ciphertext, fingerprintHash ?? "", wasSessionCached, false));
      } catch (error) {
        if (fallbackToPlain) {
          req._ciphEncryptedBody = null;
          return req;
        }
        throw new CiphError("CIPH004", "Request body encryption failed", error);
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
        throw new CiphError("CIPH001", "Missing session key for response decryption");
      }
      try {
        const requestKey = await deriveRequestKey(sessionKey, fingerprintHash);
        const decrypted = await decrypt(encryptedBody, requestKey);
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
        throw new CiphError("CIPH004", "Response decryption failed", error);
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
          throw new CiphError("CIPH003", "Fingerprint mismatch", error);
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
        const encryptedFp = await encrypt(JSON.stringify(fpComponents), s.sessionKey);
        req.headers.set("X-Client-PublicKey", s.publicKey);
        req.headers.set("X-Fingerprint", encryptedFp.ciphertext);
        const method = (req.method ?? "get").toUpperCase();
        const hasBody = method !== "GET" && method !== "HEAD" && typeof req._ciphPlainBody !== "undefined" && req._ciphPlainBody !== null;
        if (hasBody && req.encrypt !== false) {
          const requestKey = await deriveRequestKey(s.sessionKey, s.fingerprintHash);
          const plain = typeof req._ciphPlainBody === "string" ? req._ciphPlainBody : JSON.stringify(req._ciphPlainBody);
          const encrypted = await encrypt(plain, requestKey);
          req.data = encrypted.ciphertext;
          req.headers.set("Content-Type", "text/plain");
        }
        try {
          return await instance.request(req);
        } catch (retryErr) {
          if (axios.isAxiosError(retryErr)) {
            throw new CiphError("CIPH003", "Fingerprint mismatch after retry", retryErr);
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
import { createContext, useContext, useMemo } from "react";

// src/devtools/CiphDevtoolsPanel.tsx
import { useEffect, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function statusColor(status) {
  if (status >= 500) return "#f85149";
  if (status >= 400) return "#d29922";
  if (status >= 200) return "#3fb950";
  return "#8b949e";
}
function methodColor(method) {
  const m = {
    GET: { bg: "#0d1b2e", text: "#58a6ff" },
    POST: { bg: "#0d2010", text: "#3fb950" },
    PUT: { bg: "#1e1500", text: "#d29922" },
    PATCH: { bg: "#1a0d2e", text: "#bc8cff" },
    DELETE: { bg: "#2e0d0d", text: "#f85149" }
  };
  return m[method] ?? { bg: "#1c2230", text: "#8b949e" };
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
function positionStyle(pos = "bottom-right") {
  const base = { position: "fixed", zIndex: 999999 };
  if (pos === "bottom-right") return { ...base, bottom: 20, right: 20 };
  if (pos === "bottom-left") return { ...base, bottom: 20, left: 20 };
  if (pos === "top-right") return { ...base, top: 20, right: 20 };
  return { ...base, top: 20, left: 20 };
}
function DevtoolsPanel({ maxLogs = 500, defaultOpen = false, position = "bottom-right" }) {
  const [open, setOpen] = useState(defaultOpen);
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(null);
  const logsRef = useRef([]);
  useEffect(() => {
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
  return /* @__PURE__ */ jsxs("div", { style: positionStyle(position), children: [
    open && /* @__PURE__ */ jsxs("div", { style: {
      position: "absolute",
      bottom: position.startsWith("bottom") ? 50 : void 0,
      top: position.startsWith("top") ? 50 : void 0,
      right: position.endsWith("right") ? 0 : void 0,
      left: position.endsWith("left") ? 0 : void 0,
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
      color: colors.text
    }, children: [
      /* @__PURE__ */ jsxs("div", { style: { background: colors.bg2, borderBottom: `1px solid ${colors.border}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }, children: [
        /* @__PURE__ */ jsx("span", { style: { fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }, children: "\u{1F6E1}\uFE0F Ciph Inspector" }),
        /* @__PURE__ */ jsxs("span", { style: { fontSize: 10, background: colors.bg3, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "2px 8px", color: colors.text2 }, children: [
          entries.length,
          " request",
          entries.length !== 1 ? "s" : ""
        ] }),
        /* @__PURE__ */ jsx("span", { style: { fontSize: 10, color: colors.text2, background: "#0d2010", border: "1px solid #3fb95033", borderRadius: 6, padding: "2px 6px" }, children: "client-only \u2726" }),
        /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              logsRef.current = [];
              setEntries([]);
              setSelected(null);
            },
            style: { padding: "3px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.bg3, color: colors.text2, cursor: "pointer", fontSize: 11, fontFamily: "inherit" },
            children: "Clear"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setOpen(false),
            style: { padding: "3px 8px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.bg3, color: colors.text2, cursor: "pointer", fontSize: 11, fontFamily: "inherit" },
            children: "\u2715"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", flex: 1, overflow: "hidden" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { width: 300, borderRight: `1px solid ${colors.border}`, overflowY: "auto", flexShrink: 0 }, children: [
          /* @__PURE__ */ jsxs("div", { style: { position: "sticky", top: 0, background: colors.bg2, borderBottom: `1px solid ${colors.border}`, padding: "6px 10px", display: "grid", gridTemplateColumns: "52px 1fr 44px 42px", gap: 6, color: colors.text2, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }, children: [
            /* @__PURE__ */ jsx("span", { children: "Method" }),
            /* @__PURE__ */ jsx("span", { children: "Route" }),
            /* @__PURE__ */ jsx("span", { children: "Status" }),
            /* @__PURE__ */ jsx("span", { children: "ms" })
          ] }),
          entries.length === 0 && /* @__PURE__ */ jsxs("div", { style: { padding: 20, color: colors.text2, fontSize: 12, textAlign: "center" }, children: [
            "No requests yet.",
            /* @__PURE__ */ jsx("br", {}),
            "Make an API call to see logs."
          ] }),
          entries.map((e, i) => {
            const mc = methodColor(e.log.method);
            const isSel = selected === i;
            return /* @__PURE__ */ jsxs(
              "div",
              {
                onClick: () => setSelected(i),
                style: {
                  padding: "7px 10px",
                  display: "grid",
                  gridTemplateColumns: "52px 1fr 44px 42px",
                  gap: 6,
                  borderBottom: `1px solid ${colors.border}`,
                  borderLeft: `2px solid ${isSel ? "#58a6ff" : e.log.status >= 400 ? "#f85149" : "transparent"}`,
                  cursor: "pointer",
                  background: isSel ? colors.bg3 : "transparent",
                  alignItems: "center"
                },
                children: [
                  /* @__PURE__ */ jsx("span", { style: { fontSize: 9, fontWeight: 700, padding: "2px 4px", borderRadius: 4, background: mc.bg, color: mc.text, textAlign: "center" }, children: e.log.method }),
                  /* @__PURE__ */ jsx("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: colors.text, fontSize: 11 }, children: e.log.route }),
                  /* @__PURE__ */ jsx("span", { style: { color: statusColor(e.log.status), fontWeight: 600, fontSize: 11 }, children: e.log.status || "\u2026" }),
                  /* @__PURE__ */ jsxs("span", { style: { color: colors.text2, fontSize: 10 }, children: [
                    e.log.duration,
                    "ms"
                  ] })
                ]
              },
              e.id
            );
          })
        ] }),
        /* @__PURE__ */ jsx("div", { style: { flex: 1, overflowY: "auto", padding: 14 }, children: !sel ? /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: colors.text2, fontSize: 13 }, children: "\u2190 Select a request to inspect" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { style: { marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${colors.border}` }, children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }, children: [
              (() => {
                const mc = methodColor(sel.log.method);
                return /* @__PURE__ */ jsx("span", { style: { fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: mc.bg, color: mc.text }, children: sel.log.method });
              })(),
              /* @__PURE__ */ jsx("span", { style: { fontWeight: 600, fontSize: 13 }, children: sel.log.route }),
              /* @__PURE__ */ jsx("span", { style: { fontWeight: 700, color: statusColor(sel.log.status) }, children: sel.log.status || "\u2026" }),
              /* @__PURE__ */ jsx("span", { style: { fontSize: 10, padding: "2px 6px", borderRadius: 4, background: sel.log.excluded ? colors.bg3 : "#0d1b2e", color: sel.log.excluded ? colors.text2 : "#58a6ff" }, children: sel.log.excluded ? "\u25CB Plain" : "\u{1F512} Encrypted" })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { color: colors.text2, fontSize: 10, display: "flex", gap: 12 }, children: [
              /* @__PURE__ */ jsx("span", { children: sel.log.timestamp }),
              /* @__PURE__ */ jsxs("span", { children: [
                sel.log.duration,
                "ms"
              ] }),
              /* @__PURE__ */ jsxs("span", { children: [
                "fp: ",
                sel.log.fingerprint.value ? sel.log.fingerprint.value.slice(0, 12) + "\u2026" : "\u2014"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }, children: [
            ["Request (Plain)", fmtBody(sel.log.request.plainBody)],
            ["Response (Plain)", fmtBody(sel.log.response.plainBody)]
          ].map(([label, content]) => /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { style: { fontSize: 10, color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }, children: label }),
            /* @__PURE__ */ jsx("div", { style: { background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 10, overflowX: "auto" }, children: /* @__PURE__ */ jsx("pre", { style: { margin: 0, color: colors.text, fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }, children: content }) })
          ] }, label)) }),
          /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, children: [
            ["Request Encrypted", trunc(sel.log.request.encryptedBody)],
            ["Response Encrypted", trunc(sel.log.response.encryptedBody)]
          ].map(([label, content]) => /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { style: { fontSize: 10, color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }, children: label }),
            /* @__PURE__ */ jsx("div", { style: { background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 10, overflowX: "auto" }, children: /* @__PURE__ */ jsx("pre", { style: { margin: 0, color: colors.text2, fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }, children: content }) })
          ] }, label)) })
        ] }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => setOpen((o) => !o),
        style: {
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
          fontFamily: "'Menlo','Monaco','Consolas',monospace"
        },
        children: [
          "\u{1F6E1}\uFE0F Ciph",
          entries.length > 0 && /* @__PURE__ */ jsx("span", { style: { background: "#58a6ff22", color: "#58a6ff", border: "1px solid #58a6ff44", borderRadius: 10, padding: "1px 6px", fontSize: 10 }, children: entries.length })
        ]
      }
    )
  ] });
}
var CiphDevtoolsPanel = process.env.NODE_ENV === "production" ? () => null : DevtoolsPanel;

// src/context.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
if (process.env.NODE_ENV !== "production") {
  autoInitClientEmitter();
}
var CiphContext = createContext(null);
function CiphProvider({ children, devtools: devtoolsConfig, ...config }) {
  const client = useMemo(() => createClient(config), [config.baseURL, config.serverPublicKey]);
  const isProduction = process.env.NODE_ENV === "production";
  const devtoolsEnabled = !isProduction && devtoolsConfig !== false && (devtoolsConfig?.enabled ?? true);
  const dt = devtoolsConfig !== false ? devtoolsConfig : void 0;
  const panelProps = {};
  if (dt?.maxLogs !== void 0) panelProps.maxLogs = dt.maxLogs;
  if (dt?.defaultOpen !== void 0) panelProps.defaultOpen = dt.defaultOpen;
  if (dt?.position !== void 0) panelProps.position = dt.position;
  return /* @__PURE__ */ jsxs2(CiphContext.Provider, { value: client, children: [
    children,
    devtoolsEnabled && /* @__PURE__ */ jsx2(CiphDevtoolsPanel, { ...panelProps })
  ] });
}
function useCiph() {
  const client = useContext(CiphContext);
  if (!client) {
    throw new Error(
      "[ciph] useCiph() called outside <CiphProvider>. Wrap your app with <CiphProvider baseURL=... serverPublicKey=...>."
    );
  }
  return client;
}

// src/index.ts
import { CiphError as CiphError2 } from "@ciph/core";
export {
  CiphError2 as CiphError,
  CiphProvider,
  autoInitClientEmitter,
  createClient,
  emitClientLog,
  useCiph
};
//# sourceMappingURL=index.mjs.map