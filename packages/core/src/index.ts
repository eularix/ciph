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
  FingerprintOptions,
  FingerprintComponents,
  FingerprintResult,
  EncryptResult,
  DecryptResult,
  CiphErrorCode,
  CiphErrorResponse,
  CiphServerLog, 
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
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

export function fromBase64url(str: string): Uint8Array {
  const normalized = str.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "===".slice((normalized.length + 3) % 4)
  return new Uint8Array(Buffer.from(padded, "base64"))
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
