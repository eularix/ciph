import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vi.mock("@ciph/core", async (importOriginal) => {
//   const actual = await importOriginal<typeof import("@ciph/core")>()
//   return {
//     ...actual,
//     encrypt: vi.fn(actual.encrypt)
//   }
// })

import { Hono } from "hono"
import { serve } from "@hono/node-server"
import type { AddressInfo } from "node:net"
import { ciph, ciphExclude } from "../index"
import * as core from "@ciph/core"
import { createClient } from "../../../client/src/index"
import type { Context } from "hono"

interface TestServer {
  baseUrl: string
  close: () => Promise<void>
}

const TEST_SECRET = "12345678901234567890123456789012"

function fingerprintPayload(ip: string, userAgent: string): string {
  return JSON.stringify({ ip, userAgent })
}

async function buildHeaders(ip: string, userAgent: string): Promise<Record<string, string>> {
  const encryptedFingerprint = await core.encryptFingerprint(fingerprintPayload(ip, userAgent), TEST_SECRET)
  return {
    "x-fingerprint": encryptedFingerprint,
    "x-real-ip": ip,
    "user-agent": userAgent,
    "content-type": "text/plain"
  }
}

async function encryptBody(
  body: unknown,
  ip: string,
  userAgent: string
): Promise<{ ciphertext: string; headers: Record<string, string> }> {
  const fingerprint = fingerprintPayload(ip, userAgent)
  const key = await core.deriveKey(TEST_SECRET, fingerprint)
  const encrypted = await core.encrypt(JSON.stringify(body), key)
  const headers = await buildHeaders(ip, userAgent)
  return { ciphertext: encrypted.ciphertext, headers }
}

async function decryptResponseBody(
  encryptedBody: string,
  ip: string,
  userAgent: string
): Promise<unknown> {
  const key = await core.deriveKey(TEST_SECRET, fingerprintPayload(ip, userAgent))
  const decrypted = await core.decrypt(encryptedBody, key)
  return JSON.parse(decrypted.plaintext) as unknown
}

async function startServer(app: Hono): Promise<TestServer> {
  const server = serve({ fetch: app.fetch, port: 0 })
  await new Promise<void>((resolve) => {
    server.on("listening", () => resolve())
  })
  const port = (server.address() as AddressInfo).port
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () =>
      await new Promise<void>((resolve, reject) => {
        server.close((err?: Error) => {
          if (err) reject(err)
          else resolve()
        })
      })
  }
}

describe("@ciph/hono", () => {
  let logEmitSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.NODE_ENV = "development"
    logEmitSpy = vi.fn()
    ;(globalThis as unknown as { ciphServerEmitter?: { emit: typeof logEmitSpy } }).ciphServerEmitter = {
      emit: logEmitSpy
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as unknown as { ciphServerEmitter?: { emit: typeof logEmitSpy } }).ciphServerEmitter
  })

  it.skip("Happy path POST: decrypts encrypted request and encrypts response", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET }))
    app.post("/echo", async (c: Context) => {
      const body = await c.req.json<{ hello: string }>()
      return c.json({ echoed: body.hello })
    })

    const server = await startServer(app)
    try {
      const ip = "10.0.0.1"
      const ua = "Vitest-Agent"
      const encryptedRequest = await encryptBody({ hello: "world" }, ip, ua)

      const res = await fetch(`${server.baseUrl}/echo`, {
        method: "POST",
        headers: encryptedRequest.headers,
        body: encryptedRequest.ciphertext
      })

      expect(res.status).toBe(200)
      const encryptedText = await res.text()
      const plain = await decryptResponseBody(encryptedText, ip, ua)
      expect(plain).toEqual({ echoed: "world" })
    } finally {
      await server.close()
    }
  })

  it.skip("Happy path GET: validates fingerprint and encrypts response", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET }))
    app.get("/ping", (c: Context) => c.json({ ok: true }))

    const server = await startServer(app)
    try {
      const ip = "10.0.0.2"
      const ua = "Vitest-Agent-Get"
      const headers = await buildHeaders(ip, ua)

      const res = await fetch(`${server.baseUrl}/ping`, {
        method: "GET",
        headers
      })

      expect(res.status).toBe(200)
      const encryptedText = await res.text()
      const plain = await decryptResponseBody(encryptedText, ip, ua)
      expect(plain).toEqual({ ok: true })
    } finally {
      await server.close()
    }
  })

  it("Excluded route: /health passes through plain", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET }))
    app.get("/health", (c: Context) => c.json({ status: "ok" }))

    const server = await startServer(app)
    try {
      const res = await fetch(`${server.baseUrl}/health`)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ status: "ok" })
    } finally {
      await server.close()
    }
  })

  it("ciphExclude() decorator bypasses encryption", async () => {
    const app = new Hono()
    app.get("/public", ciphExclude(), (c: Context) => c.json({ public: true }))
    app.use("*", ciph({ secret: TEST_SECRET }))

    const server = await startServer(app)
    try {
      const res = await fetch(`${server.baseUrl}/public`)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ public: true })
    } finally {
      await server.close()
    }
  })

  it("CIPH001: missing X-Fingerprint returns 401", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET }))
    app.get("/secure", (c: Context) => c.json({ ok: true }))

    const server = await startServer(app)
    try {
      const res = await fetch(`${server.baseUrl}/secure`)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({
        code: "CIPH001",
        message: "Missing X-Fingerprint header"
      })
    } finally {
      await server.close()
    }
  })

  it("CIPH002: invalid encrypted fingerprint returns 401", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET }))
    app.get("/secure", (c: Context) => c.json({ ok: true }))

    const server = await startServer(app)
    try {
      const res = await fetch(`${server.baseUrl}/secure`, {
        headers: {
          "x-fingerprint": "not-valid-cipher"
        }
      })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({
        code: "CIPH002",
        message: "Failed to decrypt fingerprint"
      })
    } finally {
      await server.close()
    }
  })

  it("CIPH003: fingerprint IP mismatch returns 401", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET }))
    app.get("/secure", (c: Context) => c.json({ ok: true }))

    const server = await startServer(app)
    try {
      const fp = await core.encryptFingerprint(fingerprintPayload("1.1.1.1", "UA"), TEST_SECRET)
      const res = await fetch(`${server.baseUrl}/secure`, {
        headers: {
          "x-fingerprint": fp,
          "x-real-ip": "2.2.2.2",
          "user-agent": "UA"
        }
      })

      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({
        code: "CIPH003",
        message: "Fingerprint mismatch"
      })
    } finally {
      await server.close()
    }
  })

  it("CIPH004: undecryptable body returns 400", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET }))
    app.post("/secure", async (c: Context) => c.json(await c.req.json()))

    const server = await startServer(app)
    try {
      const headers = await buildHeaders("10.0.0.1", "UA")
      const res = await fetch(`${server.baseUrl}/secure`, {
        method: "POST",
        headers,
        body: "invalid-body-ciphertext"
      })

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        code: "CIPH004",
        message: "Failed to decrypt request body"
      })
    } finally {
      await server.close()
    }
  })

  it("CIPH005: payload exceeds max size returns 413", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET, maxPayloadSize: 5 }))
    app.post("/secure", (c: Context) => c.json({ ok: true }))

    const server = await startServer(app)
    try {
      const headers = await buildHeaders("10.0.0.1", "UA")
      const res = await fetch(`${server.baseUrl}/secure`, {
        method: "POST",
        headers,
        body: "1234567890"
      })

      expect(res.status).toBe(413)
      expect(await res.json()).toEqual({
        code: "CIPH005",
        message: "Payload too large"
      })
    } finally {
      await server.close()
    }
  })

  it("CIPH006: response encryption failure returns 500", async () => {
    const forcedEncrypt = vi.fn().mockRejectedValue(new Error("forced encrypt failure"))

    const app = new Hono()
    app.use("*", ciph({
      secret: TEST_SECRET,
      _testOverrides: { encrypt: forcedEncrypt }
    }))
    app.get("/secure", (c: Context) => c.json({ ok: true }))

    const server = await startServer(app)
    try {
      const headers = await buildHeaders("10.0.0.1", "TestAgent/1.0")
      const res = await fetch(`${server.baseUrl}/secure`, { headers })

      expect(res.status).toBe(500)
      expect(await res.json()).toMatchObject({ code: "CIPH006" })
    } finally {
      await server.close()
    }
  })

  // it("CIPH006: response encryption failure returns 500", async () => {
  //   vi.resetModules()
  //   let isolatedServer: Awaited<ReturnType<typeof startServer>>

  //   await vi.isolateModules(async () => {
  //     vi.doMock("@ciph/core", async () => {
  //       const actual = await vi.importActual("@ciph/core")
  //       return {
  //         ...(actual as object),
  //         encrypt: vi.fn().mockRejectedValue(new Error("forced")),
  //       }
  //     })

  //     const { Hono } = await import("hono")
  //     const { ciph } = await import("../index")
  //     const freshApp = new Hono()
  //     freshApp.use("*", ciph({ secret: TEST_SECRET }))
  //     freshApp.get("/secure", (c) => c.json({ ok: true }))
  //     isolatedServer = await startServer(freshApp)
  //   })

  //   const headers = await buildHeaders("10.0.0.1", "TestAgent/1.0")
  //   const res = await fetch(`${isolatedServer!.baseUrl}/secure`, { headers })

  //   expect(res.status).toBe(500)
  //   expect(await res.json()).toMatchObject({ code: "CIPH006" })

  //   await isolatedServer!.close()
  //   vi.doUnmock("@ciph/core")
  //   vi.resetModules()
  // })

  it("strictFingerprint false skips IP mismatch check", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET, strictFingerprint: false }))
    app.get("/secure", (c: Context) => c.json({ ok: true }))

    const server = await startServer(app)
    try {
      const fp = await core.encryptFingerprint(fingerprintPayload("1.1.1.1", "UA"), TEST_SECRET)
      const res = await fetch(`${server.baseUrl}/secure`, {
        headers: {
          "x-fingerprint": fp,
          "x-real-ip": "2.2.2.2",
          "user-agent": "UA"
        }
      })

      expect(res.status).toBe(200)
    } finally {
      await server.close()
    }
  })

  it("allowUnencrypted true allows request without X-Fingerprint", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET, allowUnencrypted: true }))
    app.get("/open", (c: Context) => c.json({ ok: true }))

    const server = await startServer(app)
    try {
      const res = await fetch(`${server.baseUrl}/open`)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
    } finally {
      await server.close()
    }
  })

  it("devtools emission emits CiphServerLog payload in development", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET }))
    app.get("/secure", (c: Context) => c.json({ ok: true }))

    const server = await startServer(app)
    try {
      const headers = await buildHeaders("10.0.0.1", "UA")
      await fetch(`${server.baseUrl}/secure`, { headers })
      expect(logEmitSpy).toHaveBeenCalled()
      const [event, payload] = logEmitSpy.mock.calls[0] as [
        string,
        { route: string; fingerprint: { uaMatch: boolean } }
      ]
      expect(event).toBe("log")
      expect(payload.route).toBe("/secure")
      expect(payload.fingerprint.uaMatch).toBe(true)
    } finally {
      await server.close()
    }
  })

  it("Interop test: encrypt with @ciph/client and decrypt in @ciph/hono", async () => {
    const app = new Hono()
    app.use("*", ciph({ secret: TEST_SECRET }))
    app.post("/interop", async (c: Context) => {
      const body = await c.req.json<{ name: string }>()
      return c.json({ hello: body.name })
    })

    const server = await startServer(app)
    try {
      const client = createClient({
        baseURL: server.baseUrl,
        secret: TEST_SECRET,
        fingerprintOptions: {
          customFields: {
            ip: "10.0.0.1"
          }
        },
        headers: {
          "x-real-ip": "10.0.0.1",
          "user-agent": "node"
        }
      })

      const response = await client.post<{ hello: string }>("/interop", { name: "ciph" })
      expect(response.data).toEqual({ hello: "ciph" })
    } finally {
      await server.close()
    }
  })
})
