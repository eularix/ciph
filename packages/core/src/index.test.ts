import { describe, it, expect } from "vitest"
import {
  deriveKey,
  decrypt,
  decryptFingerprint,
  encrypt,
  encryptFingerprint,
  fromBase64url,
  generateFingerprint,
  generateKeyPair,
  deriveECDHBits,
  deriveSessionKey,
  deriveRequestKey,
} from "./index"

describe("@ciph/core crypto flows", () => {
  const secret = "12345678901234567890123456789012"

  it("runs full happy-path: fingerprint -> encrypt/decrypt fingerprint -> deriveKey -> encrypt/decrypt", async () => {
    const fp = await generateFingerprint({
      userAgent: "ua-test",
      ip: "127.0.0.1",
      screen: "1920x1080",
      timezone: "UTC"
    })

    expect(fp.fingerprint).toHaveLength(64)

    const encryptedFp = await encryptFingerprint(fp.fingerprint, secret)
    const decryptedFp = await decryptFingerprint(encryptedFp, secret)
    expect(decryptedFp).toBe(fp.fingerprint)

    const key = await deriveKey(secret, fp.fingerprint)
    expect(fromBase64url(key).byteLength).toBe(32)

    const plaintext = "hello secure world"
    const encrypted = await encrypt(plaintext, key)
    const decrypted = await decrypt(encrypted.ciphertext, key)

    expect(decrypted.plaintext).toBe(plaintext)
  })

  it("rejects short secret", async () => {
    await expect(encryptFingerprint("abc", "short-secret")).rejects.toThrow(
      "CIPH_SECRET must be at least 32 characters"
    )
  })

  it("rejects invalid encrypted fingerprint payload", async () => {
    await expect(decryptFingerprint("abc", secret)).rejects.toThrow(
      "Invalid encrypted fingerprint payload"
    )
  })

  it("rejects invalid ciphertext payload", async () => {
    const key = await deriveKey(secret, "f".repeat(64))
    await expect(decrypt("abc", key)).rejects.toThrow("Invalid ciphertext payload")
  })
})

describe("@ciph/core ECDH v2 flows", () => {
  it("generateKeyPair produces valid P-256 key pair", async () => {
    const kp = await generateKeyPair()
    // raw P-256 public key = 65 bytes uncompressed
    expect(fromBase64url(kp.publicKey).byteLength).toBe(65)
    // pkcs8 private key for P-256 is 138 bytes
    expect(fromBase64url(kp.privateKey).byteLength).toBeGreaterThan(64)
  })

  it("full ECDH roundtrip: client + server derive same session and request keys", async () => {
    const serverKp = await generateKeyPair()
    const clientKp = await generateKeyPair()

    // Client side
    const clientRaw = await deriveECDHBits(clientKp.privateKey, serverKp.publicKey)
    const clientSession = await deriveSessionKey(clientRaw)

    // Server side
    const serverRaw = await deriveECDHBits(serverKp.privateKey, clientKp.publicKey)
    const serverSession = await deriveSessionKey(serverRaw)

    // Session keys must be identical
    expect(clientSession).toBe(serverSession)

    // Request key derivation (fingerprint-bound)
    const fingerprintHash = "a".repeat(64) // fake SHA-256 hex
    const clientRequestKey = await deriveRequestKey(clientSession, fingerprintHash)
    const serverRequestKey = await deriveRequestKey(serverSession, fingerprintHash)
    expect(clientRequestKey).toBe(serverRequestKey)
    expect(fromBase64url(clientRequestKey).byteLength).toBe(32)
  })

  it("full E2E: client encrypts body, server decrypts with ECDH-derived keys", async () => {
    const serverKp = await generateKeyPair()
    const clientKp = await generateKeyPair()

    const fpComponents = { screen: "1920x1080", timezone: "UTC", userAgent: "TestAgent/1.0" }
    const fpResult = await generateFingerprint(fpComponents)

    // Client: session key + encrypt fingerprint + encrypt body
    const clientRaw = await deriveECDHBits(clientKp.privateKey, serverKp.publicKey)
    const sessionKey = await deriveSessionKey(clientRaw)
    const requestKey = await deriveRequestKey(sessionKey, fpResult.fingerprint)

    const encryptedFp = await encrypt(JSON.stringify(fpResult.components), sessionKey)
    const plainBody = JSON.stringify({ hello: "world" })
    const encryptedBody = await encrypt(plainBody, requestKey)

    // Server: derive same keys, decrypt
    const serverRaw = await deriveECDHBits(serverKp.privateKey, clientKp.publicKey)
    const serverSession = await deriveSessionKey(serverRaw)

    // Decrypt fingerprint
    const decryptedFp = await decrypt(encryptedFp.ciphertext, serverSession)
    const serverFpComponents = JSON.parse(decryptedFp.plaintext) as Record<string, string>
    expect(serverFpComponents["userAgent"]).toBe("TestAgent/1.0")

    // Recompute fingerprint hash
    const serverFpResult = await generateFingerprint(serverFpComponents)
    expect(serverFpResult.fingerprint).toBe(fpResult.fingerprint)

    // Derive request key and decrypt body
    const serverRequestKey = await deriveRequestKey(serverSession, serverFpResult.fingerprint)
    const decryptedBody = await decrypt(encryptedBody.ciphertext, serverRequestKey)
    expect(decryptedBody.plaintext).toBe(plainBody)
  })
})
