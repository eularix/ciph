// src/index.ts
import axios from "axios";
import {
  CiphError,
  decrypt,
  deriveKey,
  encrypt,
  encryptFingerprint,
  generateFingerprint
} from "@ciph/core";
var cachedFingerprint = null;
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
  const instance = axios.create({
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
      const built = getBrowserFingerprintComponents(config.fingerprintOptions, req.fingerprintFields);
      const fingerprintPayload = JSON.stringify({
        ip: built.components.ip ?? "",
        userAgent: req.headers.get("user-agent") ?? built.components.userAgent ?? "node"
      });
      req._ciphFingerprint = fingerprintPayload;
      const encryptedFingerprint = await encryptFingerprint(fingerprintPayload, config.secret);
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
        const key = await deriveKey(config.secret, fingerprintPayload);
        const plainText = typeof req.data === "string" ? req.data : JSON.stringify(req.data);
        const encryptedBody = await encrypt(plainText, key);
        req.data = encryptedBody.ciphertext;
        req._ciphEncryptedBody = encryptedBody.ciphertext;
        req.headers.set("Content-Type", "text/plain");
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
      if (req._ciphExcluded) {
        return response;
      }
      const encryptedBody = response.data;
      if (typeof encryptedBody !== "string") {
        return response;
      }
      const fingerprint = req._ciphFingerprint ?? cachedFingerprint;
      if (!fingerprint) {
        throw new CiphError("CIPH001", "Missing fingerprint for response decryption");
      }
      try {
        const key = await deriveKey(config.secret, fingerprint);
        const decrypted = await decrypt(encryptedBody, key);
        response.data = JSON.parse(decrypted.plaintext);
      } catch (error) {
        if (fallbackToPlain) {
          return response;
        }
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
        cachedFingerprint = null;
        const refreshed = getBrowserFingerprintComponents(config.fingerprintOptions, req.fingerprintFields);
        const refreshedPayload = JSON.stringify({
          ip: refreshed.components.ip ?? "",
          userAgent: req.headers.get("user-agent") ?? refreshed.components.userAgent ?? "node"
        });
        req._ciphRetried = true;
        req._ciphFingerprint = refreshedPayload;
        const encryptedFingerprint = await encryptFingerprint(refreshedPayload, config.secret);
        req.headers.set("X-Fingerprint", encryptedFingerprint);
        const method = (req.method ?? "get").toUpperCase();
        const hasBody = method !== "GET" && method !== "HEAD" && typeof req._ciphPlainBody !== "undefined";
        if (hasBody && (req.encrypt ?? true)) {
          const key = await deriveKey(config.secret, refreshedPayload);
          const plainText = typeof req._ciphPlainBody === "string" ? req._ciphPlainBody : JSON.stringify(req._ciphPlainBody);
          const encryptedBody = await encrypt(plainText, key);
          req.data = encryptedBody.ciphertext;
          req.headers.set("Content-Type", "text/plain");
        }
        try {
          return await instance.request(req);
        } catch (retryResult) {
          if (axios.isAxiosError(retryResult)) {
            throw new CiphError("CIPH003", "Fingerprint mismatch after retry", retryResult);
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
export {
  createClient
};
//# sourceMappingURL=index.mjs.map