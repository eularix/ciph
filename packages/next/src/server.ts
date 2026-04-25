import * as core from "@ciph/core"
import type { CiphErrorCode, CiphServerLog } from "@ciph/core"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export interface CiphNextConfig {
  /**
   * v2 (ECDH asymmetric) — server's P-256 private key in base64url pkcs8.
   * Set from CIPH_PRIVATE_KEY env var. Takes priority over `secret` when present.
   */
  privateKey?: string

  /**
   * v1 (symmetric) — shared secret, min 32 chars.
   * Kept for backward compatibility. Use `privateKey` for new apps.
   * @deprecated Use privateKey (ECDH) instead.
   */
  secret?: string

  /**
   * Routes that skip encryption entirely. Globs supported.
   * Default: ["/health", "/api/health"]
   */
  excludeRoutes?: string[]

  /**
   * v1 only: validate IP in fingerprint against request IP.
   * v2: UA is always validated; IP is not in fingerprint.
   * Default: true
   */
  strictFingerprint?: boolean

  /** Max payload size in bytes. Default: 10 MB */
  maxPayloadSize?: number

  /**
   * If true, allow requests without encryption headers (plain pass-through).
   * Default: false. Migration only.
   */
  allowUnencrypted?: boolean

  /** @internal test-only */
  _testOverrides?: {
    encrypt?: typeof core.encrypt
  }
}

interface RequestState {
  startedAt: number
  excluded: boolean
  fingerprint: string | null
  ip: string
  userAgent: string
  ipMatch: boolean
  uaMatch: boolean
  encryptedRequestBody: string | null
  plainRequestBody: unknown | null
  encryptedResponseBody: string | null
  plainResponseBody: unknown | null
  errorCode: CiphErrorCode | null
  status: number
  ecdhClientPublicKey: string | null
  ecdhSessionKeyDerived: boolean
}

interface CiphContext {
  ciphDecryptedJson?: unknown
  ciphFingerprint?: string
}

const DEFAULT_EXCLUDE_ROUTES = ["/health", "/api/health", "/api/ciph-public-key"]
const DEFAULT_MAX_PAYLOAD_SIZE = 10_485_760
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"])
const CIPH_EXCLUDE_KEY = "x-ciph-exclude"

function getCiphServerEmitter(): { emit: (event: "log", payload: CiphServerLog) => void } | null {
  const g = globalThis as { ciphServerEmitter?: { emit: (event: "log", payload: CiphServerLog) => void } }
  if (g.ciphServerEmitter && typeof g.ciphServerEmitter.emit === "function") {
    return g.ciphServerEmitter
  }
  return null
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`)
}

function routeMatches(pathname: string, patterns: string[]): boolean {
  return patterns.some((p) => wildcardToRegex(p).test(pathname))
}

function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")
  if (realIp?.trim()) return realIp.trim()

  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded?.trim()) {
    const first = forwarded.split(",")[0]
    if (first) return first.trim()
  }

  const socket = (req as any).socket?.remoteAddress
  if (socket) return socket

  return "0.0.0.0"
}

function jsonError(code: CiphErrorCode, message: string, status: number): NextResponse {
  return NextResponse.json({ code, message }, { status })
}

function buildLog(req: NextRequest, state: RequestState): CiphServerLog {
  return {
    id: crypto.randomUUID(),
    method: req.method,
    route: req.nextUrl.pathname,
    status: state.status,
    duration: Date.now() - state.startedAt,
    timestamp: new Date().toISOString(),
    request: {
      plainBody: state.plainRequestBody,
      encryptedBody: state.encryptedRequestBody,
      headers: Object.fromEntries(req.headers),
      ip: state.ip,
      userAgent: state.userAgent,
    },
    response: {
      plainBody: state.plainResponseBody,
      encryptedBody: state.encryptedResponseBody ?? "",
    },
    fingerprint: {
      value: state.fingerprint ?? "",
      ipMatch: state.ipMatch,
      uaMatch: state.uaMatch,
    },
    excluded: state.excluded,
    error: state.errorCode,
  }
}

function emitDevLog(req: NextRequest, state: RequestState): void {
  if (process.env.NODE_ENV === "production") return
  const log = buildLog(req, state)
  getCiphServerEmitter()?.emit("log", log)
}

function buildWireResponse(ciphertext: string, status: number = 200): NextResponse {
  const body = JSON.stringify({ status: "encrypted", data: ciphertext })
  return new NextResponse(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}

/**
 * Serves the server's public key at GET /api/ciph-public-key.
 * Used by v2 clients to obtain the server public key for ECDH key exchange.
 */
export function ciphPublicKeyHandler(publicKey: string) {
  return NextResponse.json({ publicKey }, { status: 200 })
}

/**
 * Create a Next.js API route handler wrapper that adds encryption/decryption.
 *
 * Usage:
 * ```ts
 * export const POST = ciphHandler(config)(async (req, ctx) => {
 *   const body = ctx.ciphDecryptedJson
 *   return NextResponse.json({ result: body })
 * })
 * ```
 */
export function ciphHandler(config: CiphNextConfig) {
  return (
    handler: (
      req: NextRequest,
      ctx: CiphContext
    ) => Promise<NextResponse>
  ) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      const state: RequestState = {
        startedAt: Date.now(),
        excluded: false,
        fingerprint: null,
        ip: getClientIp(req),
        userAgent: req.headers.get("user-agent") ?? "",
        ipMatch: false,
        uaMatch: false,
        encryptedRequestBody: null,
        plainRequestBody: null,
        encryptedResponseBody: null,
        plainResponseBody: null,
        errorCode: null,
        status: 200,
        ecdhClientPublicKey: null,
        ecdhSessionKeyDerived: false,
      }

      const excludeRoutes = config.excludeRoutes ?? DEFAULT_EXCLUDE_ROUTES
      if (routeMatches(req.nextUrl.pathname, excludeRoutes)) {
        state.excluded = true
        return handler(req, {})
      }

      const secret = config.secret
      const privateKey = config.privateKey

      if (!secret && !privateKey) {
        state.errorCode = "CIPH006"
        state.status = 500
        emitDevLog(req, state)
        return jsonError("CIPH006", "No encryption secret or private key configured", 500)
      }

      try {
        const ctx: CiphContext = {}

        // Handle v1 (symmetric) flow
        if (secret && !privateKey) {
          const encryptedFingerprint = req.headers.get("x-fingerprint")
          if (!encryptedFingerprint) {
            if (!config.allowUnencrypted) {
              state.errorCode = "CIPH001"
              state.status = 401
              emitDevLog(req, state)
              return jsonError("CIPH001", "Missing X-Fingerprint header", 401)
            }
            return handler(req, ctx)
          }

          let fingerprint: string
          try {
            fingerprint = await core.decryptFingerprint(encryptedFingerprint, secret)
            state.fingerprint = fingerprint
            ctx.ciphFingerprint = fingerprint
          } catch {
            state.errorCode = "CIPH002"
            state.status = 401
            emitDevLog(req, state)
            return jsonError("CIPH002", "Failed to decrypt fingerprint", 401)
          }

          const fp = (() => {
            try {
              return JSON.parse(fingerprint) as { ip?: string; userAgent?: string }
            } catch {
              return null
            }
          })()

          state.ipMatch = (fp?.ip ?? "") === state.ip
          state.uaMatch = (fp?.userAgent ?? "") === state.userAgent

          const mismatch = (config.strictFingerprint ?? true) ? !state.ipMatch || !state.uaMatch : !state.uaMatch
          if (mismatch) {
            state.errorCode = "CIPH003"
            state.status = 401
            emitDevLog(req, state)
            return jsonError("CIPH003", "Fingerprint mismatch", 401)
          }

          // Payload size check
          const cl = req.headers.get("content-length")
          if (cl) {
            const n = Number(cl)
            if (!Number.isNaN(n) && n > (config.maxPayloadSize ?? DEFAULT_MAX_PAYLOAD_SIZE)) {
              state.errorCode = "CIPH005"
              state.status = 413
              emitDevLog(req, state)
              return jsonError("CIPH005", "Payload too large", 413)
            }
          }

          // Decrypt request body if present
          if (BODY_METHODS.has(req.method)) {
            const encryptedBody = await req.text()
            if (encryptedBody) {
              state.encryptedRequestBody = encryptedBody.substring(0, 100)
              const derivedKey = await core.deriveKey(secret, fingerprint)
              try {
                const decrypted = await core.decrypt(encryptedBody, derivedKey)
                state.plainRequestBody = JSON.parse(decrypted.plaintext)
                ctx.ciphDecryptedJson = state.plainRequestBody
              } catch {
                state.errorCode = "CIPH004"
                state.status = 400
                emitDevLog(req, state)
                return jsonError("CIPH004", "Failed to decrypt request body", 400)
              }
            }
          }
        } else if (privateKey) {
          // v2 ECDH asymmetric flow
          const clientPublicKeyHeader = req.headers.get("x-ciph-client-public-key")
          if (!clientPublicKeyHeader) {
            state.errorCode = "CIPH001"
            state.status = 401
            emitDevLog(req, state)
            return jsonError("CIPH001", "Missing X-Ciph-Client-Public-Key header", 401)
          }

          let clientPublicKeyDER: Uint8Array
          try {
            clientPublicKeyDER = core.fromBase64url(clientPublicKeyHeader)
            state.ecdhClientPublicKey = clientPublicKeyHeader.substring(0, 50)
          } catch {
            state.errorCode = "CIPH001"
            state.status = 401
            emitDevLog(req, state)
            return jsonError("CIPH001", "Invalid X-Ciph-Client-Public-Key format", 401)
          }

          // Derive ECDH shared secret
          let sharedSecret: Uint8Array
          try {
            sharedSecret = await core.deriveECDHBits(privateKey, clientPublicKeyHeader)
            state.ecdhSessionKeyDerived = true
          } catch {
            state.errorCode = "CIPH002"
            state.status = 401
            emitDevLog(req, state)
            return jsonError("CIPH002", "ECDH key derivation failed", 401)
          }

          // Derive session key
          let sessionKey: string
          try {
            sessionKey = await core.deriveSessionKey(sharedSecret)
          } catch {
            state.errorCode = "CIPH002"
            state.status = 401
            emitDevLog(req, state)
            return jsonError("CIPH002", "Session key derivation failed", 401)
          }

          // Get fingerprint from encrypted header
          const encryptedFingerprint = req.headers.get("x-fingerprint")
          if (!encryptedFingerprint) {
            state.errorCode = "CIPH001"
            state.status = 401
            emitDevLog(req, state)
            return jsonError("CIPH001", "Missing X-Fingerprint header", 401)
          }

          // Decrypt fingerprint (v2 uses session key directly, not derived from secret)
          let fingerprint: string
          try {
            // In v2, fingerprint is encrypted with session key
            const decrypted = await core.decrypt(encryptedFingerprint, sessionKey)
            fingerprint = decrypted.plaintext
            state.fingerprint = fingerprint
            ctx.ciphFingerprint = fingerprint
          } catch {
            state.errorCode = "CIPH002"
            state.status = 401
            emitDevLog(req, state)
            return jsonError("CIPH002", "Failed to decrypt fingerprint", 401)
          }

          const fp = (() => {
            try {
              return JSON.parse(fingerprint) as { userAgent?: string }
            } catch {
              return null
            }
          })()

          // v2: only validate UA, not IP
          state.uaMatch = (fp?.userAgent ?? "") === state.userAgent
          if (!state.uaMatch) {
            state.errorCode = "CIPH003"
            state.status = 401
            emitDevLog(req, state)
            return jsonError("CIPH003", "User agent mismatch", 401)
          }

          // Payload size check
          const cl = req.headers.get("content-length")
          if (cl) {
            const n = Number(cl)
            if (!Number.isNaN(n) && n > (config.maxPayloadSize ?? DEFAULT_MAX_PAYLOAD_SIZE)) {
              state.errorCode = "CIPH005"
              state.status = 413
              emitDevLog(req, state)
              return jsonError("CIPH005", "Payload too large", 413)
            }
          }

          // Decrypt request body if present
          if (BODY_METHODS.has(req.method)) {
            const encryptedBody = await req.text()
            if (encryptedBody) {
              state.encryptedRequestBody = encryptedBody.substring(0, 100)
              try {
                const decrypted = await core.decrypt(encryptedBody, sessionKey)
                state.plainRequestBody = JSON.parse(decrypted.plaintext)
                ctx.ciphDecryptedJson = state.plainRequestBody
              } catch {
                state.errorCode = "CIPH004"
                state.status = 400
                emitDevLog(req, state)
                return jsonError("CIPH004", "Failed to decrypt request body", 400)
              }
            }
          }
        }

        // Call handler with decrypted context
        const response = await handler(req, ctx)
        state.plainResponseBody = response.status < 400
        state.status = response.status

        // TODO: v2 response encryption
        // For now, return plaintext response. Client will handle decryption if needed.

        emitDevLog(req, state)
        return response
      } catch (error) {
        state.errorCode = "CIPH006"
        state.status = 500
        emitDevLog(req, state)
        return jsonError("CIPH006", error instanceof Error ? error.message : "Unknown error", 500)
      }
    }
  }
}
