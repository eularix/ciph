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
  CiphError: () => CiphError,
  decrypt: () => decrypt,
  decryptFingerprint: () => decryptFingerprint,
  deriveKey: () => deriveKey,
  encrypt: () => encrypt,
  encryptFingerprint: () => encryptFingerprint,
  fromBase64url: () => fromBase64url,
  generateFingerprint: () => generateFingerprint,
  randomBytes: () => randomBytes,
  toBase64url: () => toBase64url,
  validateFingerprint: () => validateFingerprint
});
module.exports = __toCommonJS(index_exports);

// src/types.ts
var CiphError = class extends Error {
  constructor(code, message, cause) {
    super(message);
    this.code = code;
    this.cause = cause;
    this.name = "CiphError";
  }
  code;
  cause;
};

// src/index.ts
function getCryptoApi() {
  if (typeof globalThis.crypto !== "undefined") {
    return globalThis.crypto;
  }
  const { webcrypto } = require("crypto");
  return webcrypto;
}
var cryptoApi = getCryptoApi();
var encoder = new TextEncoder();
function asBufferSource(bytes) {
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out.buffer;
}
var decoder = new TextDecoder();
function ensureSecret(secret) {
  if (secret.length < 32) {
    throw new Error("CIPH_SECRET must be at least 32 characters");
  }
}
function randomBytes(length) {
  const bytes = new Uint8Array(length);
  cryptoApi.getRandomValues(bytes);
  return bytes;
}
function toBase64url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64url(str) {
  const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return new Uint8Array(Buffer.from(padded, "base64"));
}
function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sortObject(obj) {
  return Object.keys(obj).sort().reduce((acc, key) => {
    const value = obj[key];
    if (value !== void 0) {
      acc[key] = value;
    }
    return acc;
  }, {});
}
async function importAesGcmKeyFromSecret(secret, usages) {
  ensureSecret(secret);
  return cryptoApi.subtle.importKey("raw", asBufferSource(encoder.encode(secret)), "AES-GCM", false, usages);
}
async function deriveAesGcmKey(secret, fingerprint) {
  ensureSecret(secret);
  const baseKey = await cryptoApi.subtle.importKey(
    "raw",
    asBufferSource(encoder.encode(fingerprint)),
    "HKDF",
    false,
    ["deriveKey"]
  );
  return cryptoApi.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: asBufferSource(encoder.encode(secret)),
      info: asBufferSource(encoder.encode("ciph-v1"))
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
async function deriveKey(secret, fingerprint) {
  const key = await deriveAesGcmKey(secret, fingerprint);
  const raw = await cryptoApi.subtle.exportKey("raw", key);
  return toBase64url(new Uint8Array(raw));
}
async function generateFingerprint(components, options) {
  const includeScreen = options?.includeScreen ?? true;
  const includeTimezone = options?.includeTimezone ?? true;
  const customFields = options?.customFields ?? {};
  const merged = {};
  if (components.userAgent) merged.userAgent = components.userAgent;
  if (components.ip) merged.ip = components.ip;
  if (includeScreen && components.screen) merged.screen = components.screen;
  if (includeTimezone && components.timezone) merged.timezone = components.timezone;
  for (const [k, v] of Object.entries(customFields)) {
    merged[k] = v;
  }
  const sorted = sortObject(merged);
  const raw = JSON.stringify(sorted);
  const digest = await cryptoApi.subtle.digest("SHA-256", asBufferSource(encoder.encode(raw)));
  return {
    fingerprint: toHex(new Uint8Array(digest)),
    components: sorted
  };
}
async function encryptFingerprint(fingerprint, secret) {
  const iv = randomBytes(12);
  const key = await importAesGcmKeyFromSecret(secret, ["encrypt"]);
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv), tagLength: 128 },
    key,
    asBufferSource(encoder.encode(fingerprint))
  );
  const encryptedBytes = new Uint8Array(encrypted);
  const output = new Uint8Array(iv.length + encryptedBytes.length);
  output.set(iv, 0);
  output.set(encryptedBytes, iv.length);
  return toBase64url(output);
}
async function decryptFingerprint(encrypted, secret) {
  const payload = fromBase64url(encrypted);
  if (payload.length < 12 + 16) {
    throw new Error("Invalid encrypted fingerprint payload");
  }
  const iv = payload.slice(0, 12);
  const ciphertextWithTag = payload.slice(12);
  const key = await importAesGcmKeyFromSecret(secret, ["decrypt"]);
  const plain = await cryptoApi.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(iv), tagLength: 128 },
    key,
    asBufferSource(ciphertextWithTag)
  );
  return decoder.decode(plain);
}
function validateFingerprint(stored, incoming) {
  const ipMatch = stored.ip === incoming.ip;
  const uaMatch = stored.userAgent === incoming.userAgent;
  return ipMatch && uaMatch;
}
async function encrypt(plaintext, key) {
  const keyBytes = fromBase64url(key);
  const cryptoKey = await cryptoApi.subtle.importKey(
    "raw",
    asBufferSource(keyBytes),
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const iv = randomBytes(12);
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv), tagLength: 128 },
    cryptoKey,
    asBufferSource(encoder.encode(plaintext))
  );
  const encryptedBytes = new Uint8Array(encrypted);
  const tag = encryptedBytes.slice(encryptedBytes.length - 16);
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const packed = new Uint8Array(12 + 16 + ciphertext.length);
  packed.set(iv, 0);
  packed.set(tag, 12);
  packed.set(ciphertext, 28);
  return {
    ciphertext: toBase64url(packed),
    iv: toBase64url(iv)
  };
}
async function decrypt(ciphertext, key) {
  const packed = fromBase64url(ciphertext);
  if (packed.length < 12 + 16) {
    throw new Error("Invalid ciphertext payload");
  }
  const iv = packed.slice(0, 12);
  const tag = packed.slice(12, 28);
  const data = packed.slice(28);
  const combined = new Uint8Array(data.length + tag.length);
  combined.set(data, 0);
  combined.set(tag, data.length);
  const keyBytes = fromBase64url(key);
  const cryptoKey = await cryptoApi.subtle.importKey(
    "raw",
    asBufferSource(keyBytes),
    "AES-GCM",
    false,
    ["decrypt"]
  );
  const plain = await cryptoApi.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(iv), tagLength: 128 },
    cryptoKey,
    asBufferSource(combined)
  );
  return {
    plaintext: decoder.decode(plain)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CiphError,
  decrypt,
  decryptFingerprint,
  deriveKey,
  encrypt,
  encryptFingerprint,
  fromBase64url,
  generateFingerprint,
  randomBytes,
  toBase64url,
  validateFingerprint
});
//# sourceMappingURL=index.cjs.map