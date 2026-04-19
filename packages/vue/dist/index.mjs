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

// src/plugin.ts
import { inject } from "vue";
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
            import("./CiphDevtoolsPanel-IQE7ECEN.mjs").then(({ mountDevtoolsPanel }) => {
              mountDevtoolsPanel(panelOptions);
            }).catch(() => {
            });
          }
        });
      }
    }
  }
};
function useCiph() {
  const client = inject(CIPH_CLIENT_KEY);
  if (!client) {
    throw new Error(
      "[ciph] useCiph() called without CiphPlugin installed. Call app.use(CiphPlugin, { baseURL, serverPublicKey }) in main.ts."
    );
  }
  return client;
}

// src/index.ts
import { CiphError as CiphError2 } from "@ciph/core";
export {
  CIPH_CLIENT_KEY,
  CiphError2 as CiphError,
  CiphPlugin,
  autoInitClientEmitter,
  createClient,
  emitClientLog,
  useCiph
};
//# sourceMappingURL=index.mjs.map