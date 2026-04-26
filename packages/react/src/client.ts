// Ciph React client - transparent HTTP encryption
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios"
import {
  CiphError,
  decrypt,
  deriveECDHBits,
  deriveRequestKey,
  deriveSessionKey,
  encrypt,
  generateFingerprint,
  generateKeyPair,
  type CiphClientLog,
  type CiphErrorCode,
  type CiphKeyPair,
  type FingerprintOptions,
} from "@ciph/core"
import { emitClientLog } from "./devtools/emitter"

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CiphClientConfig {
  /** Base URL for all requests. */
  baseURL: string

  /**
   * Server's ECDH P-256 public key in base64url (raw 65-byte uncompressed point).
   * Matches CIPH_PRIVATE_KEY held by the backend.
   * Set from CIPH_PUBLIC_KEY env var.
   */
  serverPublicKey: string

  /** Fingerprint generation options. */
  fingerprintOptions?: FingerprintOptions

  /**
   * Action when fingerprint mismatch (CIPH003) occurs after retry.
   * Default: "retry" — auto-retry once with fresh key pair + fingerprint.
   */
  onFingerprintMismatch?: "retry" | "throw" | "ignore"

  /**
   * If true, fall back to plain request when encryption fails.
   * Default: false. Never use in production.
   */
  fallbackToPlain?: boolean

  /** Routes that skip encryption. Default: ["/health"]. */
  excludeRoutes?: string[]

  /** Default headers added to every request. */
  headers?: Record<string, string>
}

export interface RequestConfig extends AxiosRequestConfig {
  /** Override encryption for this request only. */
  encrypt?: boolean
  /** Extra fingerprint fields for this request only. */
  fingerprintFields?: Record<string, string>
}

export interface CiphResponse<T> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  ciph: {
    coinsUsed?: number
    coinsRemaining?: number
    modelUsed?: string
  }
}

export type CiphClient = {
  get: <T = unknown>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>
  post: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  put: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  patch: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  delete: <T = unknown>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>
}

// ─── Internal ─────────────────────────────────────────────────────────────────

interface InternalCiphMeta {
  _ciphRetried?: boolean
  _ciphEncryptedBody?: string | null
  _ciphPlainBody?: unknown
  _ciphExcluded?: boolean
  _ciphFingerprintHash?: string
  _ciphSessionKey?: string
  _ciphStartedAt?: number
  _ciphPlainResponse?: unknown
}

type CiphAxiosConfig = InternalAxiosRequestConfig & InternalCiphMeta & RequestConfig

// ─── Wire payload shape ───────────────────────────────────────────────────────

interface CiphWirePayload { status: "encrypted"; data: string }

function isCiphWirePayload(v: unknown): v is CiphWirePayload {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as CiphWirePayload).status === "encrypted" &&
    typeof (v as CiphWirePayload).data === "string"
  )
}

function normalizePath(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname
  } catch {
    return url.split("?")[0] ?? "/"
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function globToRegex(glob: string): RegExp {
  const n = glob.startsWith("/") ? glob : `/${glob}`
  return new RegExp(`^${escapeRegex(n).replace(/\\\*/g, ".*")}$`)
}

function isExcluded(url: string, routes: string[]): boolean {
  const path = normalizePath(url)
  return routes.some((r) => globToRegex(r).test(path))
}

function parseCiphHeaders(headers: Record<string, unknown>): CiphResponse<unknown>["ciph"] {
  const coinsUsed = headers["x-coins-used"]
  const coinsRemaining = headers["x-coins-remaining"]
  const modelUsed = headers["x-model-used"]

  const result: CiphResponse<unknown>["ciph"] = {}
  if (typeof coinsUsed === "string" && coinsUsed.trim().length > 0) {
    const n = Number(coinsUsed)
    if (Number.isFinite(n)) result.coinsUsed = n
  }
  if (typeof coinsRemaining === "string" && coinsRemaining.trim().length > 0) {
    const n = Number(coinsRemaining)
    if (Number.isFinite(n)) result.coinsRemaining = n
  }
  if (typeof modelUsed === "string") result.modelUsed = modelUsed
  return result
}

function toRecordHeaders(headers: AxiosResponse["headers"]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v
    else if (Array.isArray(v)) out[k] = v.join(", ")
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v)
  }
  return out
}

function makeCiphResponse<T>(response: AxiosResponse<T>): CiphResponse<T> {
  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: toRecordHeaders(response.headers),
    ciph: parseCiphHeaders(response.headers as Record<string, unknown>),
  }
}

// ─── Session state (per-client-instance, not module-level) ────────────────────

interface SessionState {
  keyPair: CiphKeyPair | null
  sessionKey: string | null
  fingerprintHash: string | null
}

async function buildDeviceComponents(
  options?: FingerprintOptions,
  extraFields?: Record<string, string>
): Promise<Record<string, string>> {
  const components: Record<string, string> = {}

  // userAgent
  if (typeof navigator !== "undefined") {
    components.userAgent = navigator.userAgent
  } else {
    components.userAgent = "node"
  }

  // screen
  const includeScreen = options?.includeScreen ?? true
  if (includeScreen && typeof screen !== "undefined") {
    components.screen = `${screen.width}x${screen.height}`
  }

  // timezone
  const includeTimezone = options?.includeTimezone ?? true
  if (includeTimezone && typeof Intl !== "undefined") {
    components.timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown"
  }

  // custom fields
  for (const [k, v] of Object.entries(options?.customFields ?? {})) {
    components[k] = v
  }
  for (const [k, v] of Object.entries(extraFields ?? {})) {
    components[k] = v
  }

  return components
}

async function initSession(
  session: SessionState,
  serverPublicKey: string,
  options?: FingerprintOptions,
  extraFields?: Record<string, string>
): Promise<{ sessionKey: string; fingerprintHash: string; publicKey: string }> {
  // 1. Generate ephemeral client key pair
  const keyPair = await generateKeyPair()
  session.keyPair = keyPair

  // 2. ECDH → raw shared bits
  const rawShared = await deriveECDHBits(keyPair.privateKey, serverPublicKey)

  // 3. Session key
  const sessionKey = await deriveSessionKey(rawShared)
  session.sessionKey = sessionKey

  // 4. Build device fingerprint
  const components = await buildDeviceComponents(options, extraFields)
  const fpResult = await generateFingerprint(components)
  session.fingerprintHash = fpResult.fingerprint

  return {
    sessionKey,
    fingerprintHash: fpResult.fingerprint,
    publicKey: keyPair.publicKey,
  }
}

function invalidateSession(session: SessionState): void {
  session.keyPair = null
  session.sessionKey = null
  session.fingerprintHash = null
}

// ─── createClient ─────────────────────────────────────────────────────────────

export function createClient(config: CiphClientConfig): CiphClient {
  const excludeRoutes = config.excludeRoutes ?? ["/health"]
  const onFingerprintMismatch = config.onFingerprintMismatch ?? "retry"
  const fallbackToPlain = config.fallbackToPlain ?? false

  // Per-instance session state
  const session: SessionState = {
    keyPair: null,
    sessionKey: null,
    fingerprintHash: null,
  }

  const instance: AxiosInstance = axios.create({
    baseURL: config.baseURL,
    ...(config.headers !== undefined && { headers: config.headers }),
  })

  // ── Request interceptor ───────────────────────────────────────────────────
  instance.interceptors.request.use(
    async (incoming: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
      const req = incoming as CiphAxiosConfig
      const url = req.url ?? "/"

      const excluded = isExcluded(url, excludeRoutes)
      req._ciphExcluded = excluded
      req._ciphStartedAt = Date.now()

      if (!req._ciphRetried) {
        req._ciphPlainBody = req.data ?? null
      }

      if (excluded || (req.encrypt === false)) {
        return req
      }

      // Get or init session
      let sessionKey = session.sessionKey
      let fingerprintHash = session.fingerprintHash
      let clientPublicKey = session.keyPair?.publicKey
      const wasSessionCached = !!(sessionKey && fingerprintHash && clientPublicKey)

      if (!wasSessionCached) {
        const s = await initSession(
          session,
          config.serverPublicKey,
          config.fingerprintOptions,
          req.fingerprintFields
        )
        sessionKey = s.sessionKey
        fingerprintHash = s.fingerprintHash
        clientPublicKey = s.publicKey
      }

      // Store on request for response interceptor
      req._ciphSessionKey = sessionKey!
      req._ciphFingerprintHash = fingerprintHash!

      // Build fingerprint components and encrypt them (for server UA validation)
      const fpComponents = await buildDeviceComponents(
        config.fingerprintOptions,
        req.fingerprintFields
      )
      const encryptedFp = await encrypt(JSON.stringify(fpComponents), sessionKey!)

      // Set headers
      req.headers.set("X-Client-PublicKey", clientPublicKey!)
      req.headers.set("X-Fingerprint", encryptedFp.ciphertext)

      // Encrypt body (POST / PUT / PATCH)
      const method = (req.method ?? "get").toUpperCase()
      const hasBody =
        method !== "GET" &&
        method !== "HEAD" &&
        typeof req.data !== "undefined" &&
        req.data !== null

      if (!hasBody) {
        req._ciphEncryptedBody = null
        // Emit request log (no body)
        emitClientLog(buildClientLog(req, null, null, fingerprintHash ?? "", wasSessionCached, false))
        return req
      }

      // Skip if already ciphertext (retry path already encrypted body)
      if (
        typeof req._ciphPlainBody === "string" &&
        req.headers.get("Content-Type") === "text/plain"
      ) {
        req._ciphEncryptedBody = req._ciphPlainBody as string
        return req
      }

      try {
        const requestKey = await deriveRequestKey(sessionKey!, fingerprintHash!)
        const plain =
          typeof req.data === "string" ? req.data : JSON.stringify(req.data)
        const encrypted = await encrypt(plain, requestKey)
        req.data = encrypted.ciphertext
        req._ciphEncryptedBody = encrypted.ciphertext
        req.headers.set("Content-Type", "text/plain")
        // Emit request log (with body)
        emitClientLog(buildClientLog(req, req._ciphPlainBody, encrypted.ciphertext, fingerprintHash ?? "", wasSessionCached, false))
      } catch (error) {
        if (fallbackToPlain) {
          req._ciphEncryptedBody = null
          return req
        }
        throw new CiphError("CIPH004", "Request body encryption failed", error)
      }

      return req
    }
  )

  // ── Response interceptor ─────────────────────────────────────────────────
  instance.interceptors.response.use(
    async (response: AxiosResponse): Promise<AxiosResponse> => {
      const req = response.config as CiphAxiosConfig

      if (req._ciphExcluded) return response

      // Detect JSON wire format { status: "encrypted", data: "..." }
      const rawData = response.data
      const isWirePayload = isCiphWirePayload(rawData)
      const encryptedBody: string | null = isWirePayload
        ? rawData.data
        : (typeof rawData === "string" ? rawData : null)

      if (!encryptedBody) return response

      const sessionKey = req._ciphSessionKey ?? session.sessionKey
      const fingerprintHash = req._ciphFingerprintHash ?? session.fingerprintHash

      if (!sessionKey || !fingerprintHash) {
        throw new CiphError("CIPH001", "Missing session key for response decryption")
      }

      try {
        const requestKey = await deriveRequestKey(sessionKey, fingerprintHash)
        const decrypted = await decrypt(encryptedBody, requestKey)
        const plainData = JSON.parse(decrypted.plaintext) as unknown
        req._ciphPlainResponse = plainData
        response.data = plainData

        // Emit completed request+response log
        emitClientLog(buildClientLog(
          req,
          req._ciphPlainBody ?? null,
          encryptedBody,
          fingerprintHash,
          true,
          req._ciphRetried ?? false,
          response.status,
          plainData,
          encryptedBody,
        ))
      } catch (error) {
        if (fallbackToPlain) return response
        throw new CiphError("CIPH004", "Response decryption failed", error)
      }

      return response
    },

    async (error: AxiosError): Promise<never> => {
      const response = error.response
      const req = error.config as CiphAxiosConfig | undefined

      const code = (response?.data as { code?: CiphErrorCode } | undefined)?.code
      const isMismatch = response?.status === 401 && code === "CIPH003"
      const excluded = req?._ciphExcluded ?? false

      // Auto-retry on fingerprint mismatch
      if (!excluded && isMismatch && req && !req._ciphRetried) {
        if (onFingerprintMismatch === "throw") {
          throw new CiphError("CIPH003", "Fingerprint mismatch", error)
        }
        if (onFingerprintMismatch === "ignore") {
          throw error
        }

        // Invalidate session and regenerate
        invalidateSession(session)

        const s = await initSession(
          session,
          config.serverPublicKey,
          config.fingerprintOptions,
          req.fingerprintFields
        )

        req._ciphRetried = true
        req._ciphSessionKey = s.sessionKey
        req._ciphFingerprintHash = s.fingerprintHash

        // Re-encrypt fingerprint payload
        const fpComponents = await buildDeviceComponents(
          config.fingerprintOptions,
          req.fingerprintFields
        )
        const encryptedFp = await encrypt(JSON.stringify(fpComponents), s.sessionKey)
        req.headers.set("X-Client-PublicKey", s.publicKey)
        req.headers.set("X-Fingerprint", encryptedFp.ciphertext)

        // Re-encrypt body if needed
        const method = (req.method ?? "get").toUpperCase()
        const hasBody =
          method !== "GET" &&
          method !== "HEAD" &&
          typeof req._ciphPlainBody !== "undefined" &&
          req._ciphPlainBody !== null

        if (hasBody && req.encrypt !== false) {
          const requestKey = await deriveRequestKey(s.sessionKey, s.fingerprintHash)
          const plain =
            typeof req._ciphPlainBody === "string"
              ? req._ciphPlainBody
              : JSON.stringify(req._ciphPlainBody)
          const encrypted = await encrypt(plain, requestKey)
          req.data = encrypted.ciphertext
          req.headers.set("Content-Type", "text/plain")
        }

        try {
          return await instance.request(req)
        } catch (retryErr) {
          if (axios.isAxiosError(retryErr)) {
            throw new CiphError("CIPH003", "Fingerprint mismatch after retry", retryErr)
          }
          throw retryErr
        }
      }

      throw error
    }
  )

  return {
    async get<T = unknown>(url: string, cfg?: RequestConfig): Promise<CiphResponse<T>> {
      return makeCiphResponse(await instance.get<T>(url, cfg))
    },
    async post<T = unknown>(url: string, data?: unknown, cfg?: RequestConfig): Promise<CiphResponse<T>> {
      return makeCiphResponse(await instance.post<T>(url, data, cfg))
    },
    async put<T = unknown>(url: string, data?: unknown, cfg?: RequestConfig): Promise<CiphResponse<T>> {
      return makeCiphResponse(await instance.put<T>(url, data, cfg))
    },
    async patch<T = unknown>(url: string, data?: unknown, cfg?: RequestConfig): Promise<CiphResponse<T>> {
      return makeCiphResponse(await instance.patch<T>(url, data, cfg))
    },
    async delete<T = unknown>(url: string, cfg?: RequestConfig): Promise<CiphResponse<T>> {
      return makeCiphResponse(await instance.delete<T>(url, cfg))
    },
  }
}

// ─── Client log builder ───────────────────────────────────────────────────────

function buildClientLog(
  req: CiphAxiosConfig,
  plainBody: unknown,
  encryptedBody: string | null,
  fingerprintHash: string,
  cached: boolean,
  retried: boolean,
  status = 0,
  plainResponse: unknown = null,
  encryptedResponse: string | null = null,
): CiphClientLog {
  const headers: Record<string, string> = {}
  req.headers?.forEach?.((v: string, k: string) => { headers[k] = v })

  return {
    id: crypto.randomUUID(),
    method: (req.method ?? "GET").toUpperCase(),
    route: req.url ?? "/",
    status,
    duration: req._ciphStartedAt ? Date.now() - req._ciphStartedAt : 0,
    timestamp: new Date().toISOString(),
    request: {
      plainBody,
      encryptedBody,
      headers,
    },
    response: {
      plainBody: plainResponse,
      encryptedBody: encryptedResponse,
    },
    fingerprint: {
      value: fingerprintHash,
      cached,
      retried,
    },
    excluded: req._ciphExcluded ?? false,
    error: null,
  }
}
