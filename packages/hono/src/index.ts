import * as core from "@ciph/core"
import type { CiphErrorCode, CiphServerLog } from "@ciph/core"
import type { Context, MiddlewareHandler, Next } from "hono"
import { autoInitEmitter, startDevtools, getCiphInspectorApp } from "./devtools"

export { getCiphInspectorApp }

const CIPH_EXCLUDE_KEY = "ciph.exclude.route"

export interface CiphHonoConfig {
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
   * Default: ["/health", "/ciph", "/ciph/*", "/ciph-public-key"]
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

  /**
   * Built-in devtools server configuration.
   * Automatically starts the HTTP + WebSocket inspector at http://localhost:<port>
   * in development mode. Completely disabled in production.
   *
   * @example
   * ciph({ privateKey: '...', devtools: { port: 4321 } })
   * // Inspector available at http://localhost:4321
   *
   * @example
   * ciph({ privateKey: '...', devtools: false }) // disable
   */
  devtools?: {
    /** Enable devtools inspector server. Default: true in development. */
    enabled?: boolean
    /** Port for the inspector HTTP + WebSocket server. Default: 4321 */
    port?: number
  } | false

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
  // v2
  ecdhClientPublicKey: string | null
  ecdhSessionKeyDerived: boolean
}

interface CiphServerEmitterLike {
  emit: (event: "log", payload: CiphServerLog) => void
}

type CiphContextWithVars = Context<{
  Variables: {
    [CIPH_EXCLUDE_KEY]?: boolean
    ciphDecryptedJson?: unknown
    ciphFingerprint?: string
  }
}>

const DEFAULT_EXCLUDE_ROUTES = ["/health", "/ciph", "/ciph/*", "/ciph-public-key"]
const DEFAULT_MAX_PAYLOAD_SIZE = 10_485_760
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"])

function getCiphServerEmitter(): CiphServerEmitterLike | null {
  const g = globalThis as { ciphServerEmitter?: CiphServerEmitterLike }
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

function getClientIp(c: Context): string {
  const realIp = c.req.header("x-real-ip")
  if (realIp?.trim()) return realIp.trim()

  const forwarded = c.req.header("x-forwarded-for")
  if (forwarded?.trim()) {
    const first = forwarded.split(",")[0]
    if (first) return first.trim()
  }

  type RawReq = Request & {
    socket?: { remoteAddress?: string }
    connection?: { remoteAddress?: string }
  }
  const raw = c.req.raw as RawReq
  return raw.socket?.remoteAddress ?? raw.connection?.remoteAddress ?? "0.0.0.0"
}

function jsonError(code: CiphErrorCode, message: string, status: number): Response {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}

function buildLog(c: Context, state: RequestState): CiphServerLog {
  return {
    id: crypto.randomUUID(),
    method: c.req.method,
    route: c.req.path,
    status: state.status,
    duration: Date.now() - state.startedAt,
    timestamp: new Date().toISOString(),
    request: {
      plainBody: state.plainRequestBody,
      encryptedBody: state.encryptedRequestBody,
      headers: (() => {
        const h: Record<string, string> = {}
        c.req.raw.headers.forEach((v, k) => { h[k] = v })
        return h
      })(),
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

function emitDevLog(c: Context, state: RequestState): void {
  if (process.env.NODE_ENV === "production") return
  getCiphServerEmitter()?.emit("log", buildLog(c, state))
}

// ─── Wire format helper ─────────────────────────────────────────────────────────────────

/**
 * Wraps the ciphertext in the standard JSON wire payload.
 * Content-Type will be set to application/json by the caller.
 */
function buildWireResponse(ciphertext: string, origResponse: Response): Response {
  const body = JSON.stringify({ status: "encrypted", data: ciphertext })
  const headers = new Headers(origResponse.headers)
  headers.set("content-type", "application/json; charset=utf-8")
  return new Response(body, {
    status: origResponse.status,
    statusText: origResponse.statusText,
    headers,
  })
}

// ─── Per-route exclusion helper ───────────────────────────────────────────────

export function ciphExclude(): MiddlewareHandler {
  return async (c: Context, next: Next): Promise<void> => {
    ;(c as CiphContextWithVars).set(CIPH_EXCLUDE_KEY, true)
    await next()
  }
}

// ─── v1 flow (symmetric / shared secret) ─────────────────────────────────────

async function handleV1(
  c: Context,
  cx: CiphContextWithVars,
  state: RequestState,
  config: CiphHonoConfig & { secret: string },
  next: Next,
  encryptFn: typeof core.encrypt
): Promise<Response | void> {
  const { secret, strictFingerprint = true, maxPayloadSize = DEFAULT_MAX_PAYLOAD_SIZE } = config

  const encryptedFingerprint = c.req.header("x-fingerprint")
  if (!encryptedFingerprint) {
    if (!config.allowUnencrypted) {
      state.errorCode = "CIPH001"
      state.status = 401
      emitDevLog(c, state)
      return jsonError("CIPH001", "Missing X-Fingerprint header", 401)
    }
    await next()
    state.status = c.res.status
    emitDevLog(c, state)
    return
  }

  let fingerprint: string
  try {
    fingerprint = await core.decryptFingerprint(encryptedFingerprint, secret)
    state.fingerprint = fingerprint
    cx.set("ciphFingerprint", fingerprint)
  } catch {
    state.errorCode = "CIPH002"
    state.status = 401
    emitDevLog(c, state)
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

  const mismatch = strictFingerprint ? !state.ipMatch || !state.uaMatch : !state.uaMatch
  if (mismatch) {
    state.errorCode = "CIPH003"
    state.status = 401
    emitDevLog(c, state)
    return jsonError("CIPH003", "Fingerprint mismatch", 401)
  }

  // Payload size check
  const cl = c.req.header("content-length")
  if (cl) {
    const n = Number(cl)
    if (!Number.isNaN(n) && n > maxPayloadSize) {
      state.errorCode = "CIPH005"
      state.status = 413
      emitDevLog(c, state)
      return jsonError("CIPH005", "Payload too large", 413)
    }
  }

  let key: string | null = null
  if (BODY_METHODS.has(c.req.method)) {
    const encryptedBody = await c.req.text()
    state.encryptedRequestBody = encryptedBody.length > 0 ? encryptedBody : null

    if (encryptedBody.length > maxPayloadSize) {
      state.errorCode = "CIPH005"
      state.status = 413
      emitDevLog(c, state)
      return jsonError("CIPH005", "Payload too large", 413)
    }

    if (encryptedBody.length > 0) {
      try {
        key = await core.deriveKey(secret, fingerprint)
        const result = await core.decrypt(encryptedBody, key)
        const plain = JSON.parse(result.plaintext) as unknown
        state.plainRequestBody = plain
        cx.set("ciphDecryptedJson", plain)
        const origJson = c.req.json.bind(c.req)
        c.req.json = (async <T = unknown>() => plain as T) as typeof origJson
      } catch {
        state.errorCode = "CIPH004"
        state.status = 400
        emitDevLog(c, state)
        return jsonError("CIPH004", "Failed to decrypt request body", 400)
      }
    }
  }

  await next()

  try {
    state.status = c.res.status
    const plainText = await c.res.clone().text()
    state.plainResponseBody = plainText.length > 0
      ? (() => { try { return JSON.parse(plainText) as unknown } catch { return plainText } })()
      : null

    if (!key) key = await core.deriveKey(secret, fingerprint)
    const encrypted = await encryptFn(plainText, key)
    state.encryptedResponseBody = encrypted.ciphertext

    c.res = buildWireResponse(encrypted.ciphertext, c.res)
    emitDevLog(c, state)
  } catch {
    state.errorCode = "CIPH006"
    state.status = 500
    emitDevLog(c, state)
    c.res = jsonError("CIPH006", "Failed to encrypt response", 500)
  }
}

// ─── v2 flow (ECDH asymmetric) ────────────────────────────────────────────────

async function handleV2(
  c: Context,
  cx: CiphContextWithVars,
  state: RequestState,
  config: CiphHonoConfig & { privateKey: string },
  next: Next,
  encryptFn: typeof core.encrypt
): Promise<Response | void> {
  const { privateKey, strictFingerprint = true, maxPayloadSize = DEFAULT_MAX_PAYLOAD_SIZE } = config

  // 1. Read client ephemeral public key
  const clientPublicKey = c.req.header("x-client-publickey")
  if (!clientPublicKey) {
    if (!config.allowUnencrypted) {
      state.errorCode = "CIPH001"
      state.status = 401
      emitDevLog(c, state)
      return jsonError("CIPH001", "Missing X-Client-PublicKey header", 401)
    }
    await next()
    state.status = c.res.status
    emitDevLog(c, state)
    return
  }

  state.ecdhClientPublicKey = clientPublicKey

  // 2. ECDH → session key
  let sessionKey: string
  try {
    const rawShared = await core.deriveECDHBits(privateKey, clientPublicKey)
    sessionKey = await core.deriveSessionKey(rawShared)
    state.ecdhSessionKeyDerived = true
  } catch {
    state.errorCode = "CIPH007"
    state.status = 401
    emitDevLog(c, state)
    return jsonError("CIPH007", "ECDH key derivation failed", 401)
  }

  // 3. Decrypt X-Fingerprint (encrypted with session key)
  const encryptedFp = c.req.header("x-fingerprint")
  if (!encryptedFp) {
    state.errorCode = "CIPH001"
    state.status = 401
    emitDevLog(c, state)
    return jsonError("CIPH001", "Missing X-Fingerprint header", 401)
  }

  let fpComponents: Record<string, string>
  try {
    const decrypted = await core.decrypt(encryptedFp, sessionKey)
    fpComponents = JSON.parse(decrypted.plaintext) as Record<string, string>
  } catch {
    state.errorCode = "CIPH002"
    state.status = 401
    emitDevLog(c, state)
    return jsonError("CIPH002", "Failed to decrypt fingerprint", 401)
  }

  // 4. Validate UA (v2 drops IP — client doesn't know its external IP)
  const requestUA = c.req.header("user-agent") ?? ""
  state.uaMatch = (fpComponents["userAgent"] ?? "") === requestUA
  state.ipMatch = true // not validated in v2

  if (strictFingerprint && !state.uaMatch) {
    state.errorCode = "CIPH003"
    state.status = 401
    emitDevLog(c, state)
    return jsonError("CIPH003", "Fingerprint mismatch: User-Agent changed", 401)
  }

  // 5. Recompute fingerprint hash (same sort+SHA-256 the client used)
  const fpResult = await core.generateFingerprint(fpComponents)
  state.fingerprint = fpResult.fingerprint
  cx.set("ciphFingerprint", fpResult.fingerprint)

  // 6. Derive per-request key (fingerprint-bound)
  const requestKey = await core.deriveRequestKey(sessionKey, fpResult.fingerprint)

  // 7. Payload size check
  const cl = c.req.header("content-length")
  if (cl) {
    const n = Number(cl)
    if (!Number.isNaN(n) && n > maxPayloadSize) {
      state.errorCode = "CIPH005"
      state.status = 413
      emitDevLog(c, state)
      return jsonError("CIPH005", "Payload too large", 413)
    }
  }

  // 8. Decrypt request body
  if (BODY_METHODS.has(c.req.method)) {
    const encryptedBody = await c.req.text()
    state.encryptedRequestBody = encryptedBody.length > 0 ? encryptedBody : null

    if (encryptedBody.length > maxPayloadSize) {
      state.errorCode = "CIPH005"
      state.status = 413
      emitDevLog(c, state)
      return jsonError("CIPH005", "Payload too large", 413)
    }

    if (encryptedBody.length > 0) {
      try {
        const result = await core.decrypt(encryptedBody, requestKey)
        const plain = JSON.parse(result.plaintext) as unknown
        state.plainRequestBody = plain
        cx.set("ciphDecryptedJson", plain)
        const origJson = c.req.json.bind(c.req)
        c.req.json = (async <T = unknown>() => plain as T) as typeof origJson
      } catch {
        state.errorCode = "CIPH004"
        state.status = 400
        emitDevLog(c, state)
        return jsonError("CIPH004", "Failed to decrypt request body", 400)
      }
    }
  }

  // 9. Run handler
  await next()

  // 10. Encrypt response
  try {
    state.status = c.res.status
    const plainText = await c.res.clone().text()
    state.plainResponseBody = plainText.length > 0
      ? (() => { try { return JSON.parse(plainText) as unknown } catch { return plainText } })()
      : null

    const encrypted = await encryptFn(plainText, requestKey)
    state.encryptedResponseBody = encrypted.ciphertext

    c.res = buildWireResponse(encrypted.ciphertext, c.res)
    emitDevLog(c, state)
  } catch {
    state.errorCode = "CIPH006"
    state.status = 500
    emitDevLog(c, state)
    c.res = jsonError("CIPH006", "Failed to encrypt response", 500)
  }
}

// ─── Main middleware ──────────────────────────────────────────────────────────

export function ciph(config: CiphHonoConfig): MiddlewareHandler {
  if (!config.privateKey && !config.secret) {
    throw new Error(
      "[ciph] CiphHonoConfig requires either `privateKey` (v2 ECDH, recommended) " +
        "or `secret` (v1 symmetric, deprecated)."
    )
  }

  // ── Built-in devtools (dev only) ──────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const dtRaw = config.devtools
    if (dtRaw !== false) {
      const dtOpts = dtRaw ?? {}
      const dtEnabled = dtOpts.enabled ?? true
      if (dtEnabled) {
        const port = dtOpts.port ?? 4321
        // Both calls are idempotent — safe to call multiple times
        autoInitEmitter()
        void startDevtools(port)
      }
    }
  }

  const excludeRoutes = config.excludeRoutes ?? DEFAULT_EXCLUDE_ROUTES
  const encryptFn = config._testOverrides?.encrypt ?? core.encrypt

  return async (c: Context, next: Next): Promise<Response | void> => {
    const cx = c as CiphContextWithVars

    const state: RequestState = {
      startedAt: Date.now(),
      excluded: false,
      fingerprint: null,
      ip: getClientIp(c),
      userAgent: c.req.header("user-agent") ?? "",
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

    // Check exclusion
    const pathExcluded = routeMatches(c.req.path, excludeRoutes)
    const middlewareExcluded = cx.get(CIPH_EXCLUDE_KEY) === true

    if (pathExcluded || middlewareExcluded) {
      state.excluded = true
      await next()
      state.status = c.res.status
      emitDevLog(c, state)
      return
    }

    // Route to v2 or v1
    if (config.privateKey) {
      return handleV2(
        c,
        cx,
        state,
        config as CiphHonoConfig & { privateKey: string },
        next,
        encryptFn
      )
    }

    return handleV1(
      c,
      cx,
      state,
      config as CiphHonoConfig & { secret: string },
      next,
      encryptFn
    )
  }
}
