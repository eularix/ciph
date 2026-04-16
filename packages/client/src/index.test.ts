import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import {
  decrypt,
  decryptFingerprint,
  deriveKey,
  encrypt,
  generateFingerprint,
  type FingerprintOptions
} from "@ciph/core"
import { createClient, type CiphClientConfig } from "./index"

const TEST_SECRET = "abcdefghijklmnopqrstuvwxyz123456"

type ServerControl = {
  close: () => void
}

function getComponentsFromUserAgent(ua: string, options?: FingerprintOptions) {
  const includeScreen = options?.includeScreen ?? true
  const includeTimezone = options?.includeTimezone ?? true
  const base: Record<string, string> = { userAgent: ua }
  if (includeScreen) base.screen = "unknown"
  if (includeTimezone) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    base.timezone = tz || "unknown"
  }
  if (options?.customFields) {
    for (const [k, v] of Object.entries(options.customFields)) {
      base[k] = v
    }
  }
  return base
}

async function createTestServer(port: number): Promise<ServerControl> {
  const app = new Hono()

  app.get("/health", (c) => c.json({ ok: true }))

  app.post("/echo", async (c) => {
    const encryptedFingerprint = c.req.header("x-fingerprint")
    if (!encryptedFingerprint) {
      return c.json({ code: "CIPH001", message: "missing fingerprint" }, 401)
    }

    const plaintextFingerprint = await decryptFingerprint(encryptedFingerprint, TEST_SECRET)
    const key = await deriveKey(TEST_SECRET, plaintextFingerprint)
    const bodyCipher = await c.req.text()
    const plain = await decrypt(bodyCipher, key)
    const parsed = JSON.parse(plain.plaintext) as Record<string, unknown>

    const encryptedResponse = await encrypt(
      JSON.stringify({ echoed: parsed.message ?? null }),
      key
    )

    c.header("X-Coins-Used", "1")
    c.header("X-Coins-Remaining", "99")
    c.header("X-Model-Used", "test-model")
    return c.text(encryptedResponse.ciphertext, 200)
  })

  app.get("/cipher", async (c) => {
    const encryptedFingerprint = c.req.header("x-fingerprint")
    if (!encryptedFingerprint) {
      return c.json({ code: "CIPH001", message: "missing fingerprint" }, 401)
    }

    const plaintextFingerprint = await decryptFingerprint(encryptedFingerprint, TEST_SECRET)
    const key = await deriveKey(TEST_SECRET, plaintextFingerprint)
    const encryptedResponse = await encrypt(JSON.stringify({ ok: true }), key)
    return c.text(encryptedResponse.ciphertext, 200)
  })

  app.get("/force-mismatch", (c) => {
    return c.json({ code: "CIPH003", message: "forced mismatch" }, 401)
  })

  const server = serve({
    fetch: app.fetch,
    port
  })

  return {
    close: () => server.close()
  }
}

describe("@ciph/client integration", () => {
  const port = 43219
  const baseURL = `http://127.0.0.1:${port}`
  let server: ServerControl

  beforeAll(async () => {
    server = await createTestServer(port)
  })

  afterAll(() => {
    server.close()
  })

  it("skips encryption on excluded route", async () => {
    const client = createClient({
      baseURL,
      secret: TEST_SECRET,
      excludeRoutes: ["/health"]
    })

    const response = await client.get<{ ok: boolean }>("/health")
    expect(response.status).toBe(200)
    expect(response.data.ok).toBe(true)
  })

  it("encrypts request body and decrypts response body", async () => {
    const client = createClient({
      baseURL,
      secret: TEST_SECRET
    })

    const response = await client.post<{ echoed: string }>("/echo", { message: "hello" })
    expect(response.status).toBe(200)
    expect(response.data.echoed).toBe("hello")
    expect(response.ciph.coinsUsed).toBe(1)
    expect(response.ciph.coinsRemaining).toBe(99)
    expect(response.ciph.modelUsed).toBe("test-model")
  })

  it("decrypts encrypted GET response", async () => {
    const client = createClient({
      baseURL,
      secret: TEST_SECRET
    })

    const response = await client.get<{ ok: boolean }>("/cipher")
    expect(response.status).toBe(200)
    expect(response.data.ok).toBe(true)
  })

  it("retries once on CIPH003 then throws when mismatch persists", async () => {
    const clientConfig: CiphClientConfig = {
      baseURL,
      secret: TEST_SECRET,
      onFingerprintMismatch: "retry"
    }
    const client = createClient(clientConfig)

    await expect(client.get("/force-mismatch")).rejects.toBeDefined()
  })
})
