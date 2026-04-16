import { describe, it, expect, beforeEach, vi } from "vitest"
import { CiphDevtoolsClient } from "./client.js"
import type { CiphClientLog, CiphServerLog } from "@ciph/core"

type LogHandler = (payload: CiphClientLog | CiphServerLog) => void

class MockEmitter {
  private handlers: LogHandler[] = []

  on(event: "log", cb: LogHandler): () => void {
    if (event !== "log") return () => {}
    this.handlers.push(cb)
    return () => {
      const idx = this.handlers.indexOf(cb)
      if (idx >= 0) this.handlers.splice(idx, 1)
    }
  }

  emit(event: "log", payload: CiphClientLog | CiphServerLog): void {
    if (event !== "log") return
    for (const h of this.handlers) h(payload)
  }

  count(): number {
    return this.handlers.length
  }
}

function makeClientLog(overrides: Partial<CiphClientLog> = {}): CiphClientLog {
  return {
    id: overrides.id ?? "client-1",
    method: overrides.method ?? "GET",
    route: overrides.route ?? "/api/client",
    status: overrides.status ?? 200,
    duration: overrides.duration ?? 20,
    timestamp: overrides.timestamp ?? "2026-01-01T00:00:00.000Z",
    request: overrides.request ?? {
      plainBody: null,
      encryptedBody: null,
      headers: {},
    },
    response: overrides.response ?? {
      plainBody: { ok: true },
      encryptedBody: "cipher",
    },
    fingerprint: overrides.fingerprint ?? {
      value: "fp",
      cached: false,
      retried: false,
    },
    excluded: overrides.excluded ?? false,
    error: overrides.error ?? null,
  }
}

function makeServerLog(overrides: Partial<CiphServerLog> = {}): CiphServerLog {
  return {
    id: overrides.id ?? "server-1",
    method: overrides.method ?? "POST",
    route: overrides.route ?? "/api/server",
    status: overrides.status ?? 201,
    duration: overrides.duration ?? 40,
    timestamp: overrides.timestamp ?? "2026-01-01T00:00:01.000Z",
    request: overrides.request ?? {
      plainBody: { a: 1 },
      encryptedBody: "cipher-req",
      headers: {},
      ip: "127.0.0.1",
      userAgent: "vitest",
    },
    response: overrides.response ?? {
      plainBody: { ok: true },
      encryptedBody: "cipher-res",
    },
    fingerprint: overrides.fingerprint ?? {
      value: "fp",
      ipMatch: true,
      uaMatch: true,
    },
    excluded: overrides.excluded ?? false,
    error: overrides.error ?? null,
  }
}

describe("CiphDevtoolsClient", () => {
  let clientEmitter: MockEmitter
  let serverEmitter: MockEmitter

  beforeEach(() => {
    clientEmitter = new MockEmitter()
    serverEmitter = new MockEmitter()
    ;(globalThis as unknown as { __ciphClientEmitter__?: MockEmitter }).__ciphClientEmitter__ = clientEmitter
    ;(globalThis as unknown as { ciphServerEmitter?: MockEmitter }).ciphServerEmitter = serverEmitter
  })

  it("connect() subscribes to both emitters", () => {
    const c = new CiphDevtoolsClient({ autoConnect: false })
    expect(clientEmitter.count()).toBe(0)
    expect(serverEmitter.count()).toBe(0)

    c.connect()

    expect(clientEmitter.count()).toBe(1)
    expect(serverEmitter.count()).toBe(1)
  })

  it("disconnect() unsubscribes and stops collecting", () => {
    const c = new CiphDevtoolsClient({ autoConnect: true })
    expect(clientEmitter.count()).toBe(1)
    expect(serverEmitter.count()).toBe(1)

    c.disconnect()
    expect(clientEmitter.count()).toBe(0)
    expect(serverEmitter.count()).toBe(0)

    clientEmitter.emit("log", makeClientLog({ id: "c-after" }))
    serverEmitter.emit("log", makeServerLog({ id: "s-after" }))
    expect(c.getLogs()).toHaveLength(0)
  })

  it("getLogs() returns collected entries in newest-first order", () => {
    const c = new CiphDevtoolsClient({ autoConnect: true })

    clientEmitter.emit("log", makeClientLog({ id: "c1", timestamp: "2026-01-01T00:00:00.000Z" }))
    serverEmitter.emit("log", makeServerLog({ id: "s1", timestamp: "2026-01-01T00:00:01.000Z" }))
    clientEmitter.emit("log", makeClientLog({ id: "c2", timestamp: "2026-01-01T00:00:02.000Z" }))

    const logs = c.getLogs()
    expect(logs).toHaveLength(3)
    expect(logs[0]?.id).toBe("c2")
    expect(logs[1]?.id).toBe("s1")
    expect(logs[2]?.id).toBe("c1")
  })

  it("circular buffer evicts oldest when maxLogs reached", () => {
    const c = new CiphDevtoolsClient({ autoConnect: true, maxLogs: 2 })

    clientEmitter.emit("log", makeClientLog({ id: "a" }))
    clientEmitter.emit("log", makeClientLog({ id: "b" }))
    clientEmitter.emit("log", makeClientLog({ id: "c" }))

    const logs = c.getLogs()
    expect(logs).toHaveLength(2)
    expect(logs.map((l) => l.id)).toEqual(["c", "b"])
  })

  it("onLog(cb) fires on each new entry and unsubscribe works", () => {
    const c = new CiphDevtoolsClient({ autoConnect: true })
    const cb = vi.fn()
    const unsub = c.onLog(cb)

    clientEmitter.emit("log", makeClientLog({ id: "1" }))
    serverEmitter.emit("log", makeServerLog({ id: "2" }))
    expect(cb).toHaveBeenCalledTimes(2)

    unsub()
    clientEmitter.emit("log", makeClientLog({ id: "3" }))
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it("getStats() returns accurate aggregated stats", () => {
    const c = new CiphDevtoolsClient({ autoConnect: true })

    clientEmitter.emit("log", makeClientLog({ id: "ok-client", status: 200, duration: 10, excluded: false }))
    serverEmitter.emit(
      "log",
      makeServerLog({ id: "err-server", status: 500, duration: 40, excluded: true, error: "CIPH006" })
    )
    serverEmitter.emit(
      "log",
      makeServerLog({ id: "err-server-2", status: 401, duration: 50, excluded: false, error: "CIPH003" })
    )

    const stats = c.getStats()
    expect(stats.totalRequests).toBe(3)
    expect(stats.totalErrors).toBe(2)
    expect(stats.avgDuration).toBe(Math.round((10 + 40 + 50) / 3))
    expect(stats.encryptedCount).toBe(2)
    expect(stats.excludedCount).toBe(1)
    expect(stats.errorBreakdown.CIPH006).toBe(1)
    expect(stats.errorBreakdown.CIPH003).toBe(1)
  })

  it("filter option excludes non-matching entries", () => {
    const c = new CiphDevtoolsClient({
      autoConnect: true,
      filter: (entry) => entry.log.status >= 400,
    })

    clientEmitter.emit("log", makeClientLog({ id: "ok", status: 200 }))
    clientEmitter.emit("log", makeClientLog({ id: "err", status: 500 }))

    const logs = c.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0]?.id).toBe("err")
  })

  it("server log interop via globalThis.ciphServerEmitter", () => {
    const c = new CiphDevtoolsClient({ autoConnect: true })
    serverEmitter.emit("log", makeServerLog({ id: "server-only" }))

    const logs = c.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0]?.source).toBe("server")
    expect(logs[0]?.id).toBe("server-only")
  })

  it("client log interop via window/global __ciphClientEmitter__", () => {
    const c = new CiphDevtoolsClient({ autoConnect: true })
    clientEmitter.emit("log", makeClientLog({ id: "client-only" }))

    const logs = c.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0]?.source).toBe("client")
    expect(logs[0]?.id).toBe("client-only")
  })

  it("autoConnect true starts listening on instantiation", () => {
    const c = new CiphDevtoolsClient({ autoConnect: true })
    expect(c.isConnected()).toBe(true)
    expect(clientEmitter.count()).toBe(1)
    expect(serverEmitter.count()).toBe(1)
  })
})
