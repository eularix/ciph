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
  createClient: () => createClient
});
module.exports = __toCommonJS(index_exports);
var import_axios = __toESM(require("axios"));
var import_core = require("@ciph/core");
var cachedFingerprint = null;
var cachedClientKeyPair = null;
var cachedServerPublicKey = null;
var cachedSessionKey = null;
function detectMode(config) {
  const hasServerPubKey = config.serverPublicKey != null;
  const hasPublicKeyEndpoint = config.publicKeyEndpoint != null;
  const hasSecret = config.secret != null;
  if (hasServerPubKey || hasPublicKeyEndpoint) {
    return {
      isV2: true,
      serverPublicKey: config.serverPublicKey,
      publicKeyEndpoint: config.publicKeyEndpoint ?? new URL("/ciph-public-key", config.baseURL).href
    };
  }
  if (hasSecret) {
    console.warn(
      "[ciph] Using deprecated v1 (symmetric) mode. Migrate to v2 by providing 'serverPublicKey' or 'publicKeyEndpoint' in config."
    );
    return { isV2: false };
  }
  throw new Error(
    "[ciph] CiphClientConfig requires either v2 config (serverPublicKey or publicKeyEndpoint) or v1 config (deprecated secret)."
  );
}
async function fetchServerPublicKey(endpoint) {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch server public key: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.publicKey || typeof data.publicKey !== "string") {
      throw new Error("Invalid server public key response format");
    }
    return data.publicKey;
  } catch (error) {
    throw new Error(`Failed to fetch server public key from ${endpoint}: ${String(error)}`);
  }
}
async function getOrCreateClientKeyPair() {
  if (cachedClientKeyPair) {
    return cachedClientKeyPair;
  }
  cachedClientKeyPair = await (0, import_core.generateKeyPair)();
  return cachedClientKeyPair;
}
async function getOrFetchServerPublicKey(config) {
  if (cachedServerPublicKey) {
    return cachedServerPublicKey;
  }
  let pubKey;
  if (config.serverPublicKey) {
    pubKey = config.serverPublicKey;
  } else if (config.publicKeyEndpoint) {
    pubKey = await fetchServerPublicKey(config.publicKeyEndpoint);
  } else {
    throw new Error("[ciph] No serverPublicKey or publicKeyEndpoint provided");
  }
  cachedServerPublicKey = pubKey;
  return pubKey;
}
async function deriveV2Keys(clientKeyPair, serverPublicKey, fingerprint) {
  const rawShared = await (0, import_core.deriveECDHBits)(clientKeyPair.privateKey, serverPublicKey);
  const sessionKey = await (0, import_core.deriveSessionKey)(rawShared);
  const requestKey = await (0, import_core.deriveRequestKey)(sessionKey, fingerprint);
  return { sessionKey, requestKey };
}
function normalizePath(url) {
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.pathname;
  } catch {
    const [path] = url.split("?");
    return path || "/";
  }
}
function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function globToRegex(glob) {
  const normalized = glob.startsWith("/") ? glob : `/${glob}`;
  const pattern = `^${escapeRegex(normalized).replace(/\\\*/g, ".*")}$`;
  return new RegExp(pattern);
}
function isExcludedRoute(url, excludeRoutes) {
  const path = normalizePath(url);
  return excludeRoutes.some((route) => globToRegex(route).test(path));
}
function getBrowserFingerprintComponents(fingerprintOptions, requestFields) {
  const includeScreen = fingerprintOptions?.includeScreen ?? true;
  const includeTimezone = fingerprintOptions?.includeTimezone ?? true;
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "node";
  const screenValue = typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "unknown";
  const timezoneValue = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown" : "unknown";
  const components = {
    userAgent
  };
  if (includeScreen) {
    components.screen = screenValue;
  }
  if (includeTimezone) {
    components.timezone = timezoneValue;
  }
  const globalFields = fingerprintOptions?.customFields ?? {};
  for (const [k, v] of Object.entries(globalFields)) {
    components[k] = v;
  }
  if (requestFields) {
    for (const [k, v] of Object.entries(requestFields)) {
      components[k] = v;
    }
  }
  return {
    components,
    fingerprintOptions: {
      includeScreen,
      includeTimezone
    }
  };
}
function parseCiphHeaders(headers) {
  const coinsUsedRaw = headers["x-coins-used"];
  const coinsRemainingRaw = headers["x-coins-remaining"];
  const modelUsedRaw = headers["x-model-used"];
  const coinsUsed = typeof coinsUsedRaw === "string" && coinsUsedRaw.trim().length > 0 ? Number(coinsUsedRaw) : void 0;
  const coinsRemaining = typeof coinsRemainingRaw === "string" && coinsRemainingRaw.trim().length > 0 ? Number(coinsRemainingRaw) : void 0;
  const modelUsed = typeof modelUsedRaw === "string" ? modelUsedRaw : void 0;
  const result = {};
  if (Number.isFinite(coinsUsed)) result.coinsUsed = coinsUsed;
  if (Number.isFinite(coinsRemaining)) result.coinsRemaining = coinsRemaining;
  if (typeof modelUsed === "string") result.modelUsed = modelUsed;
  return result;
}
function toRecordHeaders(headers) {
  const out = {};
  const source = headers;
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === "string") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.join(", ");
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = String(v);
    }
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
function createClient(config) {
  const excludeRoutes = config.excludeRoutes ?? ["/health"];
  const onFingerprintMismatch = config.onFingerprintMismatch ?? "retry";
  const fallbackToPlain = config.fallbackToPlain ?? false;
  const mode = detectMode(config);
  const instance = import_axios.default.create({
    baseURL: config.baseURL,
    ...config.headers !== void 0 && { headers: config.headers }
  });
  instance.interceptors.request.use(
    async (incomingConfig) => {
      const req = incomingConfig;
      const url = req.url ?? "/";
      const excluded = isExcludedRoute(url, excludeRoutes);
      req._ciphExcluded = excluded;
      if (!req._ciphRetried) {
        req._ciphPlainBody = req.data ?? null;
      }
      if (excluded) {
        return req;
      }
      const shouldEncrypt = req.encrypt ?? true;
      if (!shouldEncrypt) {
        return req;
      }
      if (mode.isV2) {
        try {
          const built2 = getBrowserFingerprintComponents(config.fingerprintOptions, req.fingerprintFields);
          const fpResult = await (0, import_core.generateFingerprint)(built2.components);
          cachedFingerprint = fpResult.fingerprint;
          req._ciphFingerprint = fpResult.fingerprint;
          const clientKeyPair = await getOrCreateClientKeyPair();
          req._ciphV2ClientPublicKey = clientKeyPair.publicKey;
          req.headers.set("X-Client-PublicKey", clientKeyPair.publicKey);
          const serverPublicKey = await getOrFetchServerPublicKey(config);
          const keys = await deriveV2Keys(clientKeyPair, serverPublicKey, fpResult.fingerprint);
          req._ciphV2SessionKey = keys.sessionKey;
          req._ciphV2RequestKey = keys.requestKey;
          cachedSessionKey = keys.sessionKey;
          const fpJson = JSON.stringify(built2.components);
          const encryptedFp = await (0, import_core.encrypt)(fpJson, keys.sessionKey);
          req.headers.set("X-Fingerprint", encryptedFp.ciphertext);
          const method2 = (req.method ?? "get").toUpperCase();
          const hasBody2 = method2 !== "GET" && method2 !== "HEAD" && typeof req.data !== "undefined";
          if (!hasBody2) {
            req._ciphEncryptedBody = null;
            return req;
          }
          if (typeof req._ciphPlainBody === "string" && req.headers.get("Content-Type") === "text/plain") {
            req._ciphEncryptedBody = req._ciphPlainBody;
            return req;
          }
          try {
            const plainText = typeof req.data === "string" ? req.data : JSON.stringify(req.data);
            const encrypted = await (0, import_core.encrypt)(plainText, keys.requestKey);
            req.data = encrypted.ciphertext;
            req._ciphEncryptedBody = encrypted.ciphertext;
            req.headers.set("Content-Type", "text/plain");
          } catch (error) {
            if (fallbackToPlain) {
              req._ciphEncryptedBody = null;
              return req;
            }
            throw new import_core.CiphError("CIPH004", "Request body encryption failed", error);
          }
          return req;
        } catch (error) {
          if (fallbackToPlain) {
            return req;
          }
          throw error;
        }
      }
      const built = getBrowserFingerprintComponents(config.fingerprintOptions, req.fingerprintFields);
      const fingerprintPayload = JSON.stringify({
        ip: built.components.ip ?? "",
        userAgent: req.headers.get("user-agent") ?? built.components.userAgent ?? "node"
      });
      req._ciphFingerprint = fingerprintPayload;
      const encryptedFingerprint = await (0, import_core.encryptFingerprint)(fingerprintPayload, config.secret);
      req.headers.set("X-Fingerprint", encryptedFingerprint);
      const method = (req.method ?? "get").toUpperCase();
      const hasBody = method !== "GET" && method !== "HEAD" && typeof req.data !== "undefined";
      if (!hasBody) {
        req._ciphEncryptedBody = null;
        return req;
      }
      if (typeof req._ciphPlainBody === "string" && req.headers.get("Content-Type") === "text/plain") {
        req._ciphEncryptedBody = req._ciphPlainBody;
        return req;
      }
      try {
        const key = await (0, import_core.deriveKey)(config.secret, fingerprintPayload);
        const plainText = typeof req.data === "string" ? req.data : JSON.stringify(req.data);
        const encryptedBody = await (0, import_core.encrypt)(plainText, key);
        req.data = encryptedBody.ciphertext;
        req._ciphEncryptedBody = encryptedBody.ciphertext;
        req.headers.set("Content-Type", "text/plain");
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
      if (req._ciphExcluded) {
        return response;
      }
      const encryptedBody = response.data;
      if (typeof encryptedBody !== "string") {
        return response;
      }
      try {
        let key;
        if (mode.isV2) {
          key = req._ciphV2RequestKey ?? "";
          if (!key) throw new Error("Missing v2 request key");
        } else {
          const fingerprint = req._ciphFingerprint ?? cachedFingerprint;
          if (!fingerprint) {
            throw new import_core.CiphError("CIPH001", "Missing fingerprint for response decryption");
          }
          key = await (0, import_core.deriveKey)(config.secret, fingerprint);
        }
        const decrypted = await (0, import_core.decrypt)(encryptedBody, key);
        response.data = JSON.parse(decrypted.plaintext);
      } catch (error) {
        if (fallbackToPlain) {
          return response;
        }
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
        if (mode.isV2) {
          cachedFingerprint = null;
          cachedClientKeyPair = null;
          cachedSessionKey = null;
        } else {
          cachedFingerprint = null;
        }
        req._ciphRetried = true;
        const built = getBrowserFingerprintComponents(config.fingerprintOptions, req.fingerprintFields);
        if (mode.isV2) {
          try {
            const fpResult = await (0, import_core.generateFingerprint)(built.components);
            req._ciphFingerprint = fpResult.fingerprint;
            const clientKeyPair = await getOrCreateClientKeyPair();
            req._ciphV2ClientPublicKey = clientKeyPair.publicKey;
            req.headers.set("X-Client-PublicKey", clientKeyPair.publicKey);
            const serverPublicKey = await getOrFetchServerPublicKey(config);
            const keys = await deriveV2Keys(clientKeyPair, serverPublicKey, fpResult.fingerprint);
            req._ciphV2SessionKey = keys.sessionKey;
            req._ciphV2RequestKey = keys.requestKey;
            const fpJson = JSON.stringify(built.components);
            const encryptedFp = await (0, import_core.encrypt)(fpJson, keys.sessionKey);
            req.headers.set("X-Fingerprint", encryptedFp.ciphertext);
            const method = (req.method ?? "get").toUpperCase();
            const hasBody = method !== "GET" && method !== "HEAD" && typeof req._ciphPlainBody !== "undefined";
            if (hasBody && (req.encrypt ?? true)) {
              const plainText = typeof req._ciphPlainBody === "string" ? req._ciphPlainBody : JSON.stringify(req._ciphPlainBody);
              const encrypted = await (0, import_core.encrypt)(plainText, keys.requestKey);
              req.data = encrypted.ciphertext;
              req.headers.set("Content-Type", "text/plain");
            }
          } catch (retryError) {
            throw new import_core.CiphError("CIPH003", "Failed to regenerate v2 keys for retry", retryError);
          }
        } else {
          const refreshedPayload = JSON.stringify({
            ip: built.components.ip ?? "",
            userAgent: req.headers.get("user-agent") ?? built.components.userAgent ?? "node"
          });
          req._ciphFingerprint = refreshedPayload;
          const encryptedFingerprint = await (0, import_core.encryptFingerprint)(refreshedPayload, config.secret);
          req.headers.set("X-Fingerprint", encryptedFingerprint);
          const method = (req.method ?? "get").toUpperCase();
          const hasBody = method !== "GET" && method !== "HEAD" && typeof req._ciphPlainBody !== "undefined";
          if (hasBody && (req.encrypt ?? true)) {
            const key = await (0, import_core.deriveKey)(config.secret, refreshedPayload);
            const plainText = typeof req._ciphPlainBody === "string" ? req._ciphPlainBody : JSON.stringify(req._ciphPlainBody);
            const encryptedBody = await (0, import_core.encrypt)(plainText, key);
            req.data = encryptedBody.ciphertext;
            req.headers.set("Content-Type", "text/plain");
          }
        }
        try {
          return await instance.request(req);
        } catch (retryResult) {
          if (import_axios.default.isAxiosError(retryResult)) {
            throw new import_core.CiphError("CIPH003", "Fingerprint mismatch after retry", retryResult);
          }
          throw retryResult;
        }
      }
      throw error;
    }
  );
  return {
    async get(url, requestConfig) {
      const res = await instance.get(url, requestConfig);
      return makeCiphResponse(res);
    },
    async post(url, data, requestConfig) {
      const res = await instance.post(url, data, requestConfig);
      return makeCiphResponse(res);
    },
    async put(url, data, requestConfig) {
      const res = await instance.put(url, data, requestConfig);
      return makeCiphResponse(res);
    },
    async patch(url, data, requestConfig) {
      const res = await instance.patch(url, data, requestConfig);
      return makeCiphResponse(res);
    },
    async delete(url, requestConfig) {
      const res = await instance.delete(url, requestConfig);
      return makeCiphResponse(res);
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createClient
});
//# sourceMappingURL=index.js.map