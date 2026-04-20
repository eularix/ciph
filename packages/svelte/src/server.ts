// Ciph SvelteKit Server Hooks - Full Implementation
import type { Handle } from "@sveltejs/kit"
import { initDevtools } from "./devtools"
import type { CiphDevtoolsConfig } from "./devtools"

export { initDevtools }
export type { CiphDevtoolsConfig }

export interface CiphSvelteKitConfig {
  /**
   * Server's ECDH P-256 private key in base64url (pkcs8 format).
   */
  privateKey: string

  /**
   * Routes that skip encryption. Default: ["/health", "/ciph", "/ciph/*"]
   */
  excludeRoutes?: string[]

  /**
   * Maximum payload size in bytes. Default: 10 MB
   */
  maxPayloadSize?: number

  /**
   * DevTools configuration for development.
   */
  devtools?: CiphDevtoolsConfig
}

/**
 * Creates a SvelteKit Handle hook for Ciph transparent encryption.
 * 
 * @example
 * ```typescript
 * // src/hooks.server.ts
 * import { ciphHooks } from '@ciph/svelte'
 * 
 * export const handle = ciphHooks({
 *   privateKey: process.env.CIPH_PRIVATE_KEY!,
 *   devtools: { enabled: process.env.NODE_ENV === 'development' }
 * })
 * ```
 */
export function ciphHooks(config: CiphSvelteKitConfig): Handle {
  if (!config.privateKey || config.privateKey.length < 32) {
    throw new Error("[ciph-svelte] privateKey must be at least 32 characters")
  }

  const excludeRoutes = config.excludeRoutes ?? ["/health", "/ciph", "/ciph/*"]
  const maxPayloadSize = config.maxPayloadSize ?? 10 * 1024 * 1024

  if (config.devtools?.enabled) {
    initDevtools(config.devtools)
  }

  return async ({ event, resolve }) => {
    const url = new URL(event.request.url)
    const pathname = url.pathname

    // ─── Phase 1: Check if route should be encrypted ─────────────────────

    const isExcluded = excludeRoutes.some((route) => {
      const regex = new RegExp(`^${route.replace(/\*/g, ".*")}$`)
      return regex.test(pathname)
    })

    if (isExcluded) {
      return resolve(event)
    }

    // ─── Phase 2: Decrypt request if encrypted ──────────────────────────

    let plainRequestBody: string | null = null

    if (["POST", "PUT", "PATCH"].includes(event.request.method)) {
      try {
        const fingerprint = event.request.headers.get("X-Ciph-Fingerprint")
        if (!fingerprint) {
          return errorResponse(401, "CIPH001", "Missing X-Ciph-Fingerprint header")
        }

        const encryptedBody = await event.request.text()
        if (!encryptedBody) {
          return errorResponse(400, "CIPH004", "Empty request body")
        }

        const { decrypt, deriveKey } = await import("@ciph/core")

        // Derive decryption key
        const derivedKey = await deriveKey(config.privateKey, fingerprint)

        // Decrypt request body
        const decrypted = await decrypt(encryptedBody, derivedKey)
        plainRequestBody = decrypted.plaintext

        // Clone request with decrypted body
        const clonedRequest = event.request.clone()
        Object.defineProperty(event, "request", {
          value: new Request(clonedRequest, {
            body: plainRequestBody,
          }),
          writable: false,
        })
      } catch (error) {
        console.error("[ciph-svelte] Request decryption failed:", error)
        return errorResponse(400, "CIPH004", "Request decryption failed")
      }
    }

    // ─── Phase 3: Call handler and capture response ──────────────────────

    let response = await resolve(event)

    // ─── Phase 4: Encrypt response ───────────────────────────────────────

    const fingerprint = event.request.headers.get("X-Ciph-Fingerprint")
    if (fingerprint && response.ok) {
      try {
        const responseText = await response.text()

        const { encrypt, deriveKey } = await import("@ciph/core")

        // Derive encryption key
        const derivedKey = await deriveKey(config.privateKey, fingerprint)

        // Only encrypt if response has content
        if (responseText.length > 0) {
          const encryptedResponse = await encrypt(responseText, derivedKey)

          // Return encrypted response
          return new Response(encryptedResponse.ciphertext, {
            status: response.status,
            statusText: response.statusText,
            headers: new Headers(response.headers),
          })
        }
      } catch (error) {
        console.error("[ciph-svelte] Response encryption failed:", error)
        return errorResponse(500, "CIPH006", "Response encryption failed")
      }
    }

    return response
  }
}

// ─── Helper: Error Response ─────────────────────────────────────────────

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Public key endpoint for ECDH key exchange.
 */
export function ciphPublicKeyEndpoint(config: { publicKey: string }): {
  GET: () => Promise<Response>
} {
  return {
    GET: async () => new Response(JSON.stringify({ publicKey: config.publicKey }), {
      headers: { "Content-Type": "application/json" },
    }),
  }
}
