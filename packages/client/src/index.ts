import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from "axios"
import {
  CiphError,
  decrypt,
  deriveKey,
  encrypt,
  encryptFingerprint,
  generateFingerprint,
  type CiphErrorCode,
  type FingerprintOptions
} from "@ciph/core"

export interface CiphClientConfig {
  baseURL: string
  secret: string 
  fingerprintOptions?: FingerprintOptions
  onFingerprintMismatch?: "retry" | "throw" | "ignore"
  fallbackToPlain?: boolean
  excludeRoutes?: string[]
  headers?: Record<string, string>
}

export interface RequestConfig extends AxiosRequestConfig {
  encrypt?: boolean
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

interface InternalCiphMeta {
  _ciphRetried?: boolean
  _ciphFingerprint?: string
  _ciphEncryptedBody?: string | null
  _ciphPlainBody?: unknown
  _ciphExcluded?: boolean
}

type CiphAxiosConfig = InternalAxiosRequestConfig & InternalCiphMeta & RequestConfig

let cachedFingerprint: string | null = null

function normalizePath(url: string): string {
  try {
    const parsed = new URL(url, "http://localhost")
    return parsed.pathname
  } catch {
    const [path] = url.split("?")
    return path || "/"
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function globToRegex(glob: string): RegExp {
  const normalized = glob.startsWith("/") ? glob : `/${glob}`
  const pattern = `^${escapeRegex(normalized).replace(/\\\*/g, ".*")}$`
  return new RegExp(pattern)
}

function isExcludedRoute(url: string, excludeRoutes: string[]): boolean {
  const path = normalizePath(url)
  return excludeRoutes.some((route) => globToRegex(route).test(path))
}

function getBrowserFingerprintComponents(
  fingerprintOptions?: FingerprintOptions,
  requestFields?: Record<string, string>
): { components: Record<string, string>; fingerprintOptions: FingerprintOptions } {
  const includeScreen = fingerprintOptions?.includeScreen ?? true
  const includeTimezone = fingerprintOptions?.includeTimezone ?? true

  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "node"
  const screenValue =
    typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "unknown"
  const timezoneValue =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown"
      : "unknown"

  const components: Record<string, string> = {
    userAgent
  }

  if (includeScreen) {
    components.screen = screenValue
  }

  if (includeTimezone) {
    components.timezone = timezoneValue
  }

  const globalFields = fingerprintOptions?.customFields ?? {}
  for (const [k, v] of Object.entries(globalFields)) {
    components[k] = v
  }

  if (requestFields) {
    for (const [k, v] of Object.entries(requestFields)) {
      components[k] = v
    }
  }

  return {
    components,
    fingerprintOptions: {
      includeScreen,
      includeTimezone
    }
  }
}

async function getOrCreateFingerprint(
  fingerprintOptions?: FingerprintOptions,
  requestFields?: Record<string, string>,
  forceRefresh?: boolean
): Promise<{ value: string; cached: boolean }> {
  if (!forceRefresh && cachedFingerprint) {
    return { value: cachedFingerprint, cached: true }
  }

  const built = getBrowserFingerprintComponents(fingerprintOptions, requestFields)
  const generated = await generateFingerprint(built.components, built.fingerprintOptions)
  cachedFingerprint = generated.fingerprint
  return { value: generated.fingerprint, cached: false }
}

function parseCiphHeaders(headers: Record<string, unknown>): CiphResponse<unknown>["ciph"] {
  const coinsUsedRaw = headers["x-coins-used"]
  const coinsRemainingRaw = headers["x-coins-remaining"]
  const modelUsedRaw = headers["x-model-used"]

  const coinsUsed =
    typeof coinsUsedRaw === "string" && coinsUsedRaw.trim().length > 0
      ? Number(coinsUsedRaw)
      : undefined
  const coinsRemaining =
    typeof coinsRemainingRaw === "string" && coinsRemainingRaw.trim().length > 0
      ? Number(coinsRemainingRaw)
      : undefined
  const modelUsed = typeof modelUsedRaw === "string" ? modelUsedRaw : undefined

  const result: CiphResponse<unknown>["ciph"] = {}
  if (Number.isFinite(coinsUsed)) result.coinsUsed = coinsUsed as number
  if (Number.isFinite(coinsRemaining)) result.coinsRemaining = coinsRemaining as number
  if (typeof modelUsed === "string") result.modelUsed = modelUsed
  return result
}

function toRecordHeaders(headers: AxiosResponse["headers"]): Record<string, string> {
  const out: Record<string, string> = {}
  const source = headers as Record<string, unknown>
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === "string") {
      out[k] = v
    } else if (Array.isArray(v)) {
      out[k] = v.join(", ")
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = String(v)
    }
  }
  return out
}

function makeCiphResponse<T>(response: AxiosResponse<T>): CiphResponse<T> {
  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: toRecordHeaders(response.headers),
    ciph: parseCiphHeaders(response.headers as Record<string, unknown>)
  }
}

export function createClient(config: CiphClientConfig): {
  get: <T = unknown>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>
  post: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  put: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  patch: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>
  delete: <T = unknown>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>
} {
  const excludeRoutes = config.excludeRoutes ?? ["/health"]
  const onFingerprintMismatch = config.onFingerprintMismatch ?? "retry"
  const fallbackToPlain = config.fallbackToPlain ?? false

  const instance: AxiosInstance = axios.create({
    baseURL: config.baseURL,
    ...(config.headers !== undefined && { headers: config.headers })
  })

  instance.interceptors.request.use(
    async (incomingConfig: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
      const req = incomingConfig as CiphAxiosConfig
      const url = req.url ?? "/"
      const excluded = isExcludedRoute(url, excludeRoutes)
      req._ciphExcluded = excluded
      if (!req._ciphRetried) {
        req._ciphPlainBody = req.data ?? null
      }

      if (excluded) {
        return req
      }

      const shouldEncrypt = req.encrypt ?? true
      if (!shouldEncrypt) {
        return req
      }

      const built = getBrowserFingerprintComponents(config.fingerprintOptions, req.fingerprintFields)
      const fingerprintPayload = JSON.stringify({
        ip: built.components.ip ?? "",
        userAgent: req.headers.get("user-agent") ?? built.components.userAgent ?? "node"
      })
      req._ciphFingerprint = fingerprintPayload

      const encryptedFingerprint = await encryptFingerprint(fingerprintPayload, config.secret)
      req.headers.set("X-Fingerprint", encryptedFingerprint)

      const method = (req.method ?? "get").toUpperCase()
      const hasBody = method !== "GET" && method !== "HEAD" && typeof req.data !== "undefined"

      if (!hasBody) {
        req._ciphEncryptedBody = null
        return req
      }

      if (typeof req._ciphPlainBody === "string" && req.headers.get("Content-Type") === "text/plain") {
        req._ciphEncryptedBody = req._ciphPlainBody
        return req
      }

      try {
        const key = await deriveKey(config.secret, fingerprintPayload)
        const plainText = typeof req.data === "string" ? req.data : JSON.stringify(req.data)
        const encryptedBody = await encrypt(plainText, key)
        req.data = encryptedBody.ciphertext
        req._ciphEncryptedBody = encryptedBody.ciphertext
        req.headers.set("Content-Type", "text/plain")
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

  instance.interceptors.response.use(
    async (response: AxiosResponse): Promise<AxiosResponse> => {
      const req = response.config as CiphAxiosConfig
      if (req._ciphExcluded) {
        return response
      }

      const encryptedBody = response.data
      if (typeof encryptedBody !== "string") {
        return response
      }

      const fingerprint = req._ciphFingerprint ?? cachedFingerprint
      if (!fingerprint) {
        throw new CiphError("CIPH001", "Missing fingerprint for response decryption")
      }

      try {
        const key = await deriveKey(config.secret, fingerprint)
        const decrypted = await decrypt(encryptedBody, key)
        response.data = JSON.parse(decrypted.plaintext) as unknown
      } catch (error) {
        if (fallbackToPlain) {
          return response
        }
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

      if (!excluded && isMismatch && req && !req._ciphRetried) {
        if (onFingerprintMismatch === "throw") {
          throw new CiphError("CIPH003", "Fingerprint mismatch", error)
        }

        if (onFingerprintMismatch === "ignore") {
          throw error
        }

        cachedFingerprint = null

        const refreshed = getBrowserFingerprintComponents(config.fingerprintOptions, req.fingerprintFields)
        const refreshedPayload = JSON.stringify({
          ip: refreshed.components.ip ?? "",
          userAgent: req.headers.get("user-agent") ?? refreshed.components.userAgent ?? "node"
        })

        req._ciphRetried = true
        req._ciphFingerprint = refreshedPayload

        const encryptedFingerprint = await encryptFingerprint(refreshedPayload, config.secret)
        req.headers.set("X-Fingerprint", encryptedFingerprint)

        const method = (req.method ?? "get").toUpperCase()
        const hasBody = method !== "GET" && method !== "HEAD" && typeof req._ciphPlainBody !== "undefined"

        if (hasBody && (req.encrypt ?? true)) {
          const key = await deriveKey(config.secret, refreshedPayload)
          const plainText =
            typeof req._ciphPlainBody === "string"
              ? req._ciphPlainBody
              : JSON.stringify(req._ciphPlainBody)
          const encryptedBody = await encrypt(plainText, key)
          req.data = encryptedBody.ciphertext
          req.headers.set("Content-Type", "text/plain")
        }

        try {
          return await instance.request(req)
        } catch (retryResult) {
          if (axios.isAxiosError(retryResult)) {
            throw new CiphError("CIPH003", "Fingerprint mismatch after retry", retryResult)
          }
          throw retryResult
        }
      }

      throw error
    }
  )

  return {
    async get<T = unknown>(url: string, requestConfig?: RequestConfig): Promise<CiphResponse<T>> {
      const res = await instance.get<T>(url, requestConfig)
      return makeCiphResponse(res)
    },
    async post<T = unknown>(
      url: string,
      data?: unknown,
      requestConfig?: RequestConfig
    ): Promise<CiphResponse<T>> {
      const res = await instance.post<T>(url, data, requestConfig)
      return makeCiphResponse(res)
    },
    async put<T = unknown>(
      url: string,
      data?: unknown,
      requestConfig?: RequestConfig
    ): Promise<CiphResponse<T>> {
      const res = await instance.put<T>(url, data, requestConfig)
      return makeCiphResponse(res)
    },
    async patch<T = unknown>(
      url: string,
      data?: unknown,
      requestConfig?: RequestConfig
    ): Promise<CiphResponse<T>> {
      const res = await instance.patch<T>(url, data, requestConfig)
      return makeCiphResponse(res)
    },
    async delete<T = unknown>(
      url: string,
      requestConfig?: RequestConfig
    ): Promise<CiphResponse<T>> {
      const res = await instance.delete<T>(url, requestConfig)
      return makeCiphResponse(res)
    }
  }
}
