// src/index.ts
import * as core from "@ciph/core";
var CIPH_EXCLUDE_KEY = "ciph.exclude.route";
var DEFAULT_EXCLUDE_ROUTES = ["/health", "/ciph", "/ciph/*"];
var DEFAULT_MAX_PAYLOAD_SIZE = 10485760;
var BODY_METHODS = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH"]);
function getCiphServerEmitter() {
  const core2 = globalThis;
  if (core2.ciphServerEmitter && typeof core2.ciphServerEmitter.emit === "function") {
    return core2.ciphServerEmitter;
  }
  return null;
}
function wildcardToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const wildcarded = escaped.replace(/\*/g, ".*");
  return new RegExp(`^${wildcarded}$`);
}
function routeMatches(pathname, patterns) {
  return patterns.some((pattern) => wildcardToRegex(pattern).test(pathname));
}
function getClientIp(c) {
  const realIp = c.req.header("x-real-ip");
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor && forwardedFor.trim().length > 0) {
    const first = forwardedFor.split(",")[0];
    if (first) {
      return first.trim();
    }
  }
  const socketAddress = c.req.raw.socket?.remoteAddress ?? c.req.raw.connection?.remoteAddress;
  return socketAddress ?? "0.0.0.0";
}
function jsonError(code, message, status) {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
function parseFingerprintPayload(fingerprint) {
  try {
    const parsed = JSON.parse(fingerprint);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
function buildLog(c, state) {
  return {
    id: crypto.randomUUID(),
    method: c.req.method,
    route: c.req.path,
    status: state.status,
    duration: Date.now() - state.startedAt,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    request: {
      plainBody: state.plainRequestBody,
      encryptedBody: state.encryptedRequestBody,
      headers: (() => {
        const h = {};
        c.req.raw.headers.forEach((v, k) => {
          h[k] = v;
        });
        return h;
      })(),
      ip: state.ip,
      userAgent: state.userAgent
    },
    response: {
      plainBody: state.plainResponseBody,
      encryptedBody: state.encryptedResponseBody ?? ""
    },
    fingerprint: {
      value: state.fingerprint ?? "",
      ipMatch: state.ipMatch,
      uaMatch: state.uaMatch
    },
    excluded: state.excluded,
    error: state.errorCode
  };
}
function emitDevLog(c, state) {
  if (process.env.NODE_ENV === "production") return;
  const emitter = getCiphServerEmitter();
  if (!emitter) return;
  emitter.emit("log", buildLog(c, state));
}
function ciphExclude() {
  return async (c, next) => {
    ;
    c.set(CIPH_EXCLUDE_KEY, true);
    await next();
  };
}
function ciph(config) {
  const {
    secret,
    excludeRoutes = DEFAULT_EXCLUDE_ROUTES,
    strictFingerprint = true,
    maxPayloadSize = DEFAULT_MAX_PAYLOAD_SIZE,
    allowUnencrypted = false,
    _testOverrides
  } = config;
  return async (c, next) => {
    const cx = c;
    const state = {
      startedAt: Date.now(),
      excluded: false,
      fingerprint: null,
      ip: getClientIp(c),
      userAgent: c.req.header("user-agent") ?? "",
      ipMatch: false,
      uaMatch: false,
      encryptedRequestBody: null,
      plainRequestBody: null,
      encryptedResponseBody: null,
      plainResponseBody: null,
      errorCode: null,
      status: 200
    };
    const pathExcluded = routeMatches(c.req.path, excludeRoutes);
    const middlewareExcluded = cx.get(CIPH_EXCLUDE_KEY) === true;
    if (pathExcluded || middlewareExcluded) {
      state.excluded = true;
      await next();
      state.status = c.res.status;
      emitDevLog(c, state);
      return;
    }
    const encryptedFingerprint = c.req.header("x-fingerprint");
    if (!encryptedFingerprint) {
      if (!allowUnencrypted) {
        state.errorCode = "CIPH001";
        state.status = 401;
        const resp = jsonError("CIPH001", "Missing X-Fingerprint header", 401);
        emitDevLog(c, state);
        return resp;
      }
      await next();
      state.status = c.res.status;
      emitDevLog(c, state);
      return;
    }
    let fingerprint;
    try {
      fingerprint = await core.decryptFingerprint(encryptedFingerprint, secret);
      state.fingerprint = fingerprint;
      cx.set("ciphFingerprint", fingerprint);
    } catch {
      state.errorCode = "CIPH002";
      state.status = 401;
      const resp = jsonError("CIPH002", "Failed to decrypt fingerprint", 401);
      emitDevLog(c, state);
      return resp;
    }
    const fingerprintPayload = parseFingerprintPayload(fingerprint);
    const fingerprintIp = fingerprintPayload?.ip ?? "";
    const fingerprintUa = fingerprintPayload?.userAgent ?? "";
    state.ipMatch = fingerprintIp === state.ip;
    state.uaMatch = fingerprintUa === state.userAgent;
    const mismatch = strictFingerprint ? !state.ipMatch || !state.uaMatch : !state.uaMatch;
    if (mismatch) {
      state.errorCode = "CIPH003";
      state.status = 401;
      const resp = jsonError("CIPH003", "Fingerprint mismatch", 401);
      emitDevLog(c, state);
      return resp;
    }
    const contentLengthHeader = c.req.header("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isNaN(contentLength) && contentLength > maxPayloadSize) {
        state.errorCode = "CIPH005";
        state.status = 413;
        const resp = jsonError("CIPH005", "Payload too large", 413);
        emitDevLog(c, state);
        return resp;
      }
    }
    let key = null;
    if (BODY_METHODS.has(c.req.method)) {
      const encryptedBody = await c.req.text();
      state.encryptedRequestBody = encryptedBody.length > 0 ? encryptedBody : null;
      if (encryptedBody.length > maxPayloadSize) {
        state.errorCode = "CIPH005";
        state.status = 413;
        const resp = jsonError("CIPH005", "Payload too large", 413);
        emitDevLog(c, state);
        return resp;
      }
      if (encryptedBody.length > 0) {
        try {
          key = await core.deriveKey(secret, fingerprint);
          const result = await core.decrypt(encryptedBody, key);
          const plain = JSON.parse(result.plaintext);
          state.plainRequestBody = plain;
          cx.set("ciphDecryptedJson", plain);
          const originalJson = c.req.json.bind(c.req);
          c.req.json = (async () => plain);
        } catch {
          state.errorCode = "CIPH004";
          state.status = 400;
          const resp = jsonError("CIPH004", "Failed to decrypt request body", 400);
          emitDevLog(c, state);
          return resp;
        }
      }
    }
    await next();
    try {
      state.status = c.res.status;
      const plainResponseText = await c.res.clone().text();
      let plainBody = plainResponseText;
      if (plainResponseText.length > 0) {
        try {
          plainBody = JSON.parse(plainResponseText);
        } catch {
          plainBody = plainResponseText;
        }
      }
      state.plainResponseBody = plainBody;
      if (!key) {
        key = await core.deriveKey(secret, fingerprint);
      }
      const encryptFn = _testOverrides?.encrypt ?? core.encrypt;
      const encrypted = await encryptFn(plainResponseText, key);
      state.encryptedResponseBody = encrypted.ciphertext;
      c.res = new Response(encrypted.ciphertext, {
        status: c.res.status,
        statusText: c.res.statusText,
        headers: c.res.headers
      });
      emitDevLog(c, state);
    } catch {
      state.errorCode = "CIPH006";
      state.status = 500;
      const resp = jsonError("CIPH006", "Failed to encrypt response", 500);
      emitDevLog(c, state);
      c.res = void 0;
      c.res = resp;
      return;
    }
  };
}
export {
  ciph,
  ciphExclude
};
//# sourceMappingURL=index.mjs.map