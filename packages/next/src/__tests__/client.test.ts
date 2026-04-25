import { describe, it, expect } from "vitest"

/**
 * Client-side tests for @ciph/nextjs
 *
 * Since @ciph/nextjs client re-exports @ciph/react,
 * we test that imports work correctly and are available.
 *
 * Full functionality is tested in @ciph/react package tests.
 */

describe("@ciph/nextjs client exports", () => {
  it("should export CiphProvider from re-export", async () => {
    const { CiphProvider } = await import("../client")
    expect(CiphProvider).toBeDefined()
    expect(typeof CiphProvider).toBe("function")
  })

  it("should export useCiph hook from re-export", async () => {
    const { useCiph } = await import("../client")
    expect(useCiph).toBeDefined()
    expect(typeof useCiph).toBe("function")
  })

  it("should export createClient from re-export", async () => {
    const { createClient } = await import("../client")
    expect(createClient).toBeDefined()
    expect(typeof createClient).toBe("function")
  })

  it("should have correct type exports", async () => {
    const { CiphProvider, useCiph, createClient } = await import("../client")
    expect(CiphProvider).toBeDefined()
    expect(useCiph).toBeDefined()
    expect(createClient).toBeDefined()
  })
})

describe("@ciph/nextjs index exports", () => {
  it("should export all server utilities", async () => {
    const { ciphHandler, ciphPublicKeyHandler } = await import("../index")
    expect(ciphHandler).toBeDefined()
    expect(ciphPublicKeyHandler).toBeDefined()
  })

  it("should export all client utilities", async () => {
    const { CiphProvider, useCiph, createClient } = await import("../index")
    expect(CiphProvider).toBeDefined()
    expect(useCiph).toBeDefined()
    expect(createClient).toBeDefined()
  })
})
