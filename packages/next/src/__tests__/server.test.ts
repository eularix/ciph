import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import * as core from "@ciph/core"
import { ciphHandler, type CiphNextConfig } from "../server"

const TEST_SECRET = "abcdefghijklmnopqrstuvwxyz123456"
const TEST_IP = "127.0.0.1"
const TEST_UA = "test-agent"

// Helper to create encrypted fingerprint
async function createEncryptedFingerprint(ip: string = TEST_IP, ua: string = TEST_UA) {
  const fp = JSON.stringify({ ip, userAgent: ua })
  return core.encryptFingerprint(fp, TEST_SECRET)
}

// Helper to create encrypted body
async function encryptBody(plaintext: unknown, fingerprint: string) {
  const key = await core.deriveKey(TEST_SECRET, fingerprint)
  return core.encrypt(JSON.stringify(plaintext), key)
}

// Helper to create NextRequest mock with proper IP headers
function createMockRequest(
  method: string = "POST",
  path: string = "/api/test",
  body?: string | null,
  headers: Record<string, string> = {}
): NextRequest {
  const url = new URL(path, "http://localhost:3000")
  const reqInit: RequestInit = {
    method,
    headers: {
      "user-agent": TEST_UA,
      "content-type": "application/json",
      "x-real-ip": TEST_IP,
      ...headers,
    },
  }

  // Only add body for methods that support it
  if (body && ["POST", "PUT", "PATCH"].includes(method)) {
    reqInit.body = body
  }

  return new NextRequest(url, reqInit)
}

describe("@ciph/nextjs server", () => {
  describe("ciphHandler basic encryption/decryption", () => {
    it("should decrypt request and pass plain body to handler", async () => {
      const handler = vi.fn(async (req: any, ctx: any) => {
        expect(ctx.ciphDecryptedJson).toEqual({ message: "hello" })
        return new Response(JSON.stringify({ ok: true }))
      })

      const config: CiphNextConfig = { secret: TEST_SECRET }
      const wrappedHandler = ciphHandler(config)(handler as any)

      const fingerprint = JSON.stringify({ ip: TEST_IP, userAgent: TEST_UA })
      const encryptedFp = await core.encryptFingerprint(fingerprint, TEST_SECRET)
      const encrypted = await encryptBody({ message: "hello" }, fingerprint)

      const req = createMockRequest("POST", "/api/test", encrypted.ciphertext, {
        "x-fingerprint": encryptedFp,
      })

      const response = await wrappedHandler(req)
      expect(handler).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })

    it("should return CIPH001 when X-Fingerprint header missing", async () => {
      const handler = vi.fn()
      const config: CiphNextConfig = { secret: TEST_SECRET }
      const wrappedHandler = ciphHandler(config)(handler as any)

      const req = createMockRequest("POST", "/api/test")
      const response = await wrappedHandler(req)

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.code).toBe("CIPH001")
    })

    it("should return CIPH002 when fingerprint decryption fails", async () => {
      const handler = vi.fn()
      const config: CiphNextConfig = { secret: TEST_SECRET }
      const wrappedHandler = ciphHandler(config)(handler as any)

      const req = createMockRequest("POST", "/api/test", null, {
        "x-fingerprint": "invalid-base64url",
      })
      const response = await wrappedHandler(req)

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.code).toBe("CIPH002")
    })

    it("should return CIPH003 on fingerprint IP mismatch with strictFingerprint=true", async () => {
      const handler = vi.fn()
      const config: CiphNextConfig = { secret: TEST_SECRET, strictFingerprint: true }
      const wrappedHandler = ciphHandler(config)(handler as any)

      // Fingerprint has different IP
      const fingerprint = JSON.stringify({ ip: "192.168.1.1", userAgent: TEST_UA })
      const encryptedFp = await core.encryptFingerprint(fingerprint, TEST_SECRET)
      const encrypted = await encryptBody({ data: "test" }, fingerprint)

      const req = createMockRequest("POST", "/api/test", encrypted.ciphertext, {
        "x-fingerprint": encryptedFp,
      })

      const response = await wrappedHandler(req)
      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.code).toBe("CIPH003")
    })

    it("should bypass IP validation when strictFingerprint=false", async () => {
      const handler = vi.fn(async (req: any, ctx: any) => {
        return new Response(JSON.stringify({ ok: true }))
      })

      const config: CiphNextConfig = { secret: TEST_SECRET, strictFingerprint: false }
      const wrappedHandler = ciphHandler(config)(handler as any)

      // Different IP in fingerprint
      const fingerprint = JSON.stringify({ ip: "192.168.1.1", userAgent: TEST_UA })
      const encryptedFp = await core.encryptFingerprint(fingerprint, TEST_SECRET)
      const encrypted = await encryptBody({ data: "test" }, fingerprint)

      const req = createMockRequest("POST", "/api/test", encrypted.ciphertext, {
        "x-fingerprint": encryptedFp,
      })

      const response = await wrappedHandler(req)
      expect(response.status).toBe(200)
      expect(handler).toHaveBeenCalled()
    })

    it("should return CIPH004 when body decryption fails", async () => {
      const handler = vi.fn()
      const config: CiphNextConfig = { secret: TEST_SECRET }
      const wrappedHandler = ciphHandler(config)(handler as any)

      const fingerprint = JSON.stringify({ ip: TEST_IP, userAgent: TEST_UA })
      const encryptedFp = await core.encryptFingerprint(fingerprint, TEST_SECRET)

      const req = createMockRequest("POST", "/api/test", "invalid-ciphertext", {
        "x-fingerprint": encryptedFp,
      })

      const response = await wrappedHandler(req)
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.code).toBe("CIPH004")
    })

    it("should return CIPH005 when payload exceeds maxPayloadSize", async () => {
      const handler = vi.fn()
      const config: CiphNextConfig = { secret: TEST_SECRET, maxPayloadSize: 100 }
      const wrappedHandler = ciphHandler(config)(handler as any)

      const fingerprint = JSON.stringify({ ip: TEST_IP, userAgent: TEST_UA })
      const encryptedFp = await core.encryptFingerprint(fingerprint, TEST_SECRET)

      const req = createMockRequest("POST", "/api/test", "x".repeat(500), {
        "x-fingerprint": encryptedFp,
        "content-length": "500",
      })

      const response = await wrappedHandler(req)
      expect(response.status).toBe(413)
      const json = await response.json()
      expect(json.code).toBe("CIPH005")
    })
  })

  describe("excludeRoutes", () => {
    it("should skip encryption for excluded routes", async () => {
      const handler = vi.fn(async (req: any, ctx: any) => {
        expect(ctx.ciphDecryptedJson).toBeUndefined()
        return new Response(JSON.stringify({ ok: true }))
      })

      const config: CiphNextConfig = {
        secret: TEST_SECRET,
        excludeRoutes: ["/api/health"],
      }
      const wrappedHandler = ciphHandler(config)((handler as any))

      const req = createMockRequest("GET", "/api/health")
      const response = await wrappedHandler(req)

      expect(response.status).toBe(200)
      expect(handler).toHaveBeenCalled()
    })

    it("should support wildcard patterns in excludeRoutes", async () => {
      const handler = vi.fn(async (req: any, ctx: any) => {
        return new Response(JSON.stringify({ ok: true }))
      })

      const config: CiphNextConfig = {
        secret: TEST_SECRET,
        excludeRoutes: ["/api/public/*"],
      }
      const wrappedHandler = ciphHandler(config)((handler as any))

      const req = createMockRequest("GET", "/api/public/info")
      const response = await wrappedHandler(req)

      expect(response.status).toBe(200)
      expect(handler).toHaveBeenCalled()
    })
  })

  describe("GET requests (no body)", () => {
    it("should handle GET with encrypted fingerprint but no body", async () => {
      const handler = vi.fn(async (req: any, ctx: any) => {
        expect(ctx.ciphDecryptedJson).toBeUndefined()
        return new Response(JSON.stringify({ data: "response" }))
      })

      const config: CiphNextConfig = { secret: TEST_SECRET }
      const wrappedHandler = ciphHandler(config)(handler as any)

      const fingerprint = JSON.stringify({ ip: TEST_IP, userAgent: TEST_UA })
      const encryptedFp = await core.encryptFingerprint(fingerprint, TEST_SECRET)

      const req = createMockRequest("GET", "/api/test", null, {
        "x-fingerprint": encryptedFp,
      })

      const response = await wrappedHandler(req)
      expect(response.status).toBe(200)
      expect(handler).toHaveBeenCalled()
    })
  })
})
