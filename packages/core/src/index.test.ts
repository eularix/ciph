import { describe, it, expect } from "vitest"
import {
  deriveKey,
  decrypt,
  decryptFingerprint,
  encrypt,
  encryptFingerprint,
  fromBase64url,
  generateFingerprint
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
