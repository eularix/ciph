import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import * as core from "@ciph/core"
import { ciphHandler, type CiphNextConfig } from "../server"

const TEST_SECRET = "abcdefghijklmnopqrstuvwxyz123456"
const TEST_IP = "127.0.0.1"
const TEST_UA = "test-agent"

async function encryptBody(plaintext: unknown, fingerprint: string) {
  const key = await core.deriveKey(TEST_SECRET, fingerprint)
  return core.encrypt(JSON.stringify(plaintext), key)
}

function createRequest(
  path: string,
  encryptedBody: string,
  encryptedFp: string
): NextRequest {
  const url = new URL(path, "http://localhost:3000")
  return new NextRequest(url, {
    method: "POST",
    body: encryptedBody,
    headers: {
      "user-agent": TEST_UA,
      "x-fingerprint": encryptedFp,
      "x-real-ip": TEST_IP,
    },
  })
}

describe("@ciph/nextjs interop", () => {
  describe("end-to-end encryption/decryption", () => {
    it("should handle full request encryption roundtrip", async () => {
      const testPayload = { userId: 123, action: "fetch" }

      // Server handler receives decrypted data
      const serverHandler = async (req: any, ctx: any) => {
        expect(ctx.ciphDecryptedJson).toEqual(testPayload)
        return new Response(JSON.stringify({ success: true }))
      }

      // Wrap handler with encryption
      const config: CiphNextConfig = { secret: TEST_SECRET }
      const wrapped = ciphHandler(config)(serverHandler)

      // Simulate client encryption
      const fingerprint = JSON.stringify({ ip: TEST_IP, userAgent: TEST_UA })
      const encryptedFp = await core.encryptFingerprint(fingerprint, TEST_SECRET)
      const encrypted = await encryptBody(testPayload, fingerprint)

      const req = createRequest("/api/test", encrypted.ciphertext, encryptedFp)
      const response = await wrapped(req)

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.success).toBe(true)
    })

    it("should preserve body data through encryption/decryption cycle", async () => {
      const testCases = [
        { simple: "value" },
        { nested: { deep: { data: [1, 2, 3] } } },
        { array: ["a", "b", "c"] },
        { number: 42 },
        { boolean: true },
        { null: null },
      ]

      for (const testPayload of testCases) {
        const serverHandler = async (req: any, ctx: any) => {
          expect(ctx.ciphDecryptedJson).toEqual(testPayload)
          return new Response(JSON.stringify({ ok: true }))
        }

        const config: CiphNextConfig = { secret: TEST_SECRET }
        const wrapped = ciphHandler(config)(serverHandler)

        const fingerprint = JSON.stringify({ ip: TEST_IP, userAgent: TEST_UA })
        const encryptedFp = await core.encryptFingerprint(fingerprint, TEST_SECRET)
        const encrypted = await encryptBody(testPayload, fingerprint)

        const req = createRequest("/api/test", encrypted.ciphertext, encryptedFp)
        const response = await wrapped(req)

        expect(response.status).toBe(200)
      }
    })
  })
})
