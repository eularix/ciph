// import { webcrypto as nodeWebCrypto } from "node:crypto"
import type {
  FingerprintOptions,
  FingerprintComponents,
  FingerprintResult,
  EncryptResult,
  DecryptResult} from "./types"
export { CiphError } from "./types"
export type {
  CiphCoreConfig,
  CiphKeyPair,
  FingerprintOptions,
  FingerprintComponents,
  FingerprintResult,
  EncryptResult,
  DecryptResult,
  CiphWirePayload,
  CiphErrorCode,
  CiphErrorResponse,
  CiphServerLog,
  CiphServerLogEcdh,
  CiphClientLog,
} from "./types"

// const cryptoApi: Crypto = (globalThis.crypto as Crypto | undefined) 
//   ?? (nodeWebCrypto as unknown as Crypto)
// ✅ Ganti jadi ini — tidak ada top-level node:crypto import
function getCryptoApi(): Crypto {
  if (typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto
  }
  // Node.js fallback — require() tidak di-detect Vite sebagai static import
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { webcrypto } = require('crypto') as { webcrypto: Crypto }
  return webcrypto
}

const cryptoApi: Crypto = getCryptoApi()

const encoder = new TextEncoder()

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  const out = new Uint8Array(bytes.byteLength)
  out.set(bytes)
  return out.buffer
}
const decoder = new TextDecoder()

function ensureSecret(secret: string): void {
  if (secret.length < 32) {
    throw new Error("CIPH_SECRET must be at least 32 characters")
  }
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  cryptoApi.getRandomValues(bytes)
  return bytes
}

export function toBase64url(bytes: Uint8Array): string {
  // Buffer (Node.js / Bun) — fastest path
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "")
  }
  // btoa — browser / Deno / any Web-standard runtime
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function fromBase64url(str: string): Uint8Array {
  const normalized = str.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "===".slice((normalized.length + 3) % 4)
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(padded, "base64"))
  }
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function sortObject(obj: Record<string, string>): Record<string, string> {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      const value = obj[key]
      if (value !== undefined) {
        acc[key] = value
      }
      return acc
    }, {})
}

async function importAesGcmKeyFromSecret(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  ensureSecret(secret)
  return cryptoApi.subtle.importKey("raw", asBufferSource(encoder.encode(secret)), "AES-GCM", false, usages)
}

async function deriveAesGcmKey(secret: string, fingerprint: string): Promise<CryptoKey> {
  ensureSecret(secret)
  const baseKey = await cryptoApi.subtle.importKey(
    "raw",
    asBufferSource(encoder.encode(fingerprint)),
    "HKDF",
    false,
    ["deriveKey"]
  )

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
  )
}

export async function deriveKey(secret: string, fingerprint: string): Promise<string> {
  const key = await deriveAesGcmKey(secret, fingerprint)
  const raw = await cryptoApi.subtle.exportKey("raw", key)
  return toBase64url(new Uint8Array(raw))
}

export async function generateFingerprint(
  components: FingerprintComponents,
  options?: FingerprintOptions
): Promise<FingerprintResult> {
  const includeScreen = options?.includeScreen ?? true
  const includeTimezone = options?.includeTimezone ?? true
  const customFields = options?.customFields ?? {}

  const merged: Record<string, string> = {}

  if (components.userAgent) merged.userAgent = components.userAgent
  if (components.ip) merged.ip = components.ip
  if (includeScreen && components.screen) merged.screen = components.screen
  if (includeTimezone && components.timezone) merged.timezone = components.timezone

  for (const [k, v] of Object.entries(customFields)) {
    merged[k] = v
  }

  const sorted = sortObject(merged)
  const raw = JSON.stringify(sorted)
  const digest = await cryptoApi.subtle.digest("SHA-256", asBufferSource(encoder.encode(raw)))

  return {
    fingerprint: toHex(new Uint8Array(digest)),
    components: sorted
  }
}

export async function encryptFingerprint(fingerprint: string, secret: string): Promise<string> {
  const iv = randomBytes(12)
  const key = await importAesGcmKeyFromSecret(secret, ["encrypt"])
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv), tagLength: 128 },
    key,
    asBufferSource(encoder.encode(fingerprint))
  )

  const encryptedBytes = new Uint8Array(encrypted)
  const output = new Uint8Array(iv.length + encryptedBytes.length)
  output.set(iv, 0)
  output.set(encryptedBytes, iv.length)

  return toBase64url(output)
}

export async function decryptFingerprint(encrypted: string, secret: string): Promise<string> {
  const payload = fromBase64url(encrypted)
  if (payload.length < 12 + 16) {
    throw new Error("Invalid encrypted fingerprint payload")
  }

  const iv = payload.slice(0, 12)
  const ciphertextWithTag = payload.slice(12)
  const key = await importAesGcmKeyFromSecret(secret, ["decrypt"])

  const plain = await cryptoApi.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(iv), tagLength: 128 },
    key,
    asBufferSource(ciphertextWithTag)
  )

  return decoder.decode(plain)
}

export function validateFingerprint(
  stored: FingerprintComponents,
  incoming: FingerprintComponents
): boolean {
  const ipMatch = stored.ip === incoming.ip
  const uaMatch = stored.userAgent === incoming.userAgent
  return ipMatch && uaMatch
}

export async function encrypt(plaintext: string, key: string): Promise<EncryptResult> {
  const keyBytes = fromBase64url(key)
  const cryptoKey = await cryptoApi.subtle.importKey(
    "raw",
    asBufferSource(keyBytes),
    "AES-GCM",
    false,
    ["encrypt"]
  )
  const iv = randomBytes(12)

  const encrypted = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv), tagLength: 128 },
    cryptoKey,
    asBufferSource(encoder.encode(plaintext))
  )

  const encryptedBytes = new Uint8Array(encrypted)
  const tag = encryptedBytes.slice(encryptedBytes.length - 16)
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16)

  const packed = new Uint8Array(12 + 16 + ciphertext.length)
  packed.set(iv, 0)
  packed.set(tag, 12)
  packed.set(ciphertext, 28)

  return {
    ciphertext: toBase64url(packed),
    iv: toBase64url(iv)
  }
}

export async function decrypt(ciphertext: string, key: string): Promise<DecryptResult> {
  const packed = fromBase64url(ciphertext)
  if (packed.length < 12 + 16) {
    throw new Error("Invalid ciphertext payload")
  }

  const iv = packed.slice(0, 12)
  const tag = packed.slice(12, 28)
  const data = packed.slice(28)

  const combined = new Uint8Array(data.length + tag.length)
  combined.set(data, 0)
  combined.set(tag, data.length)

  const keyBytes = fromBase64url(key)
  const cryptoKey = await cryptoApi.subtle.importKey(
    "raw",
    asBufferSource(keyBytes),
    "AES-GCM",
    false,
    ["decrypt"]
  )

  const plain = await cryptoApi.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(iv), tagLength: 128 },
    cryptoKey,
    asBufferSource(combined)
  )

  return {
    plaintext: decoder.decode(plain)
  }
}

// ─────────────────────────────────────────────
// ECDH v2 — Asymmetric key exchange primitives
// ─────────────────────────────────────────────

import type { CiphKeyPair } from "./types"

const ECDH_PARAMS: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" }

/**
 * Generate a new ECDH P-256 key pair.
 * Server: call once, store privateKey in CIPH_PRIVATE_KEY env var.
 * Client: call per-session to get an ephemeral key pair.
 */
export async function generateKeyPair(): Promise<CiphKeyPair> {
  const kp = await cryptoApi.subtle.generateKey(ECDH_PARAMS, true, ["deriveBits"])
  const pubRaw = await cryptoApi.subtle.exportKey("raw", kp.publicKey)
  const privPkcs8 = await cryptoApi.subtle.exportKey("pkcs8", kp.privateKey)
  return {
    publicKey: toBase64url(new Uint8Array(pubRaw)),
    privateKey: toBase64url(new Uint8Array(privPkcs8)),
  }
}

/**
 * Perform ECDH key exchange.
 * - privateKey: base64url pkcs8 (your private key)
 * - peerPublicKey: base64url raw uncompressed point (peer's public key)
 * Returns 32 raw shared bytes (x-coordinate of ECDH shared point).
 */
export async function deriveECDHBits(
  privateKey: string,
  peerPublicKey: string
): Promise<Uint8Array> {
  const privBytes = fromBase64url(privateKey)
  const pubBytes = fromBase64url(peerPublicKey)

  const privCryptoKey = await cryptoApi.subtle.importKey(
    "pkcs8",
    asBufferSource(privBytes),
    ECDH_PARAMS,
    false,
    ["deriveBits"]
  )

  const pubCryptoKey = await cryptoApi.subtle.importKey(
    "raw",
    asBufferSource(pubBytes),
    ECDH_PARAMS,
    false,
    []
  )

  const sharedBits = await cryptoApi.subtle.deriveBits(
    { name: "ECDH", public: pubCryptoKey },
    privCryptoKey,
    256
  )

  return new Uint8Array(sharedBits)
}

/**
 * Derive a session AES-256 key from raw ECDH shared bytes.
 * Uses HKDF-SHA256 with info = "ciph-v2-session".
 * Returns base64url AES key.
 */
export async function deriveSessionKey(rawSharedBytes: Uint8Array): Promise<string> {
  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    asBufferSource(rawSharedBytes),
    "HKDF",
    false,
    ["deriveKey"]
  )

  // 32 zero bytes as default salt (RFC 5869: when no salt, use HashLen zeros)
  const salt = new Uint8Array(32)

  const sessionCryptoKey = await cryptoApi.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: asBufferSource(salt),
      info: asBufferSource(encoder.encode("ciph-v2-session")),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  )

  const raw = await cryptoApi.subtle.exportKey("raw", sessionCryptoKey)
  return toBase64url(new Uint8Array(raw))
}

/**
 * Derive a per-request AES-256 key from session key + device fingerprint hash.
 * Uses HKDF-SHA256 with salt = fingerprintHash (hex), info = "ciph-v2-request".
 * Returns base64url AES key.
 */
export async function deriveRequestKey(
  sessionKey: string,
  fingerprintHash: string
): Promise<string> {
  const sessionKeyBytes = fromBase64url(sessionKey)

  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    asBufferSource(sessionKeyBytes),
    "HKDF",
    false,
    ["deriveKey"]
  )

  const requestCryptoKey = await cryptoApi.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: asBufferSource(encoder.encode(fingerprintHash)),
      info: asBufferSource(encoder.encode("ciph-v2-request")),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  )

  const raw = await cryptoApi.subtle.exportKey("raw", requestCryptoKey)
  return toBase64url(new Uint8Array(raw))
}
