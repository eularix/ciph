// Ciph Svelte Client - Transparent HTTP Encryption
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios"
import Axios from "axios"
import type { CiphError, EncryptResult, DecryptResult, CiphClientLog } from "@ciph/core"
import {
  encrypt,
  decrypt,
  generateFingerprint,
  deriveKey,
  CiphError as CiphErrorClass,
} from "@ciph/core"
import { writable } from "svelte/store"
import { initClientEmitter } from "./devtools/emitter"

export interface CiphClientConfig {
  baseURL: string
  secret: string
  excludeRoutes?: string[]
  fingerprintOptions?: {
    includeScreen?: boolean
    includeTimezone?: boolean
    customFields?: Record<string, string>
  }
  onFingerprintMismatch?: "retry" | "throw" | "ignore"
  fallbackToPlain?: boolean
}

export interface CiphClient {
  instance: AxiosInstance
  get: AxiosInstance["get"]
  post: AxiosInstance["post"]
  put: AxiosInstance["put"]
  patch: AxiosInstance["patch"]
  delete: AxiosInstance["delete"]
}

export interface CiphResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
}

export interface RequestConfig extends AxiosRequestConfig {
  skipEncryption?: boolean
}

export interface CiphClientContext {
  fingerprint: string | null
  isEncrypting: boolean
  error: string | null
}

// ─── Module-level state ───────────────────────────────────────────────────

let cachedFingerprint: string | null = null

/**
 * Emit a log to the devtools panel (if dev mode)
 */
function emitDevtoolsLog(log: CiphClientLog): void {
  if (typeof globalThis === "undefined") return

  const emitter = (globalThis as any).__ciphClientEmitter__
  if (!emitter?.emit) return

  emitter.emit("log", log)
}

/**
 * Generate device fingerprint from browser components
 */
async function generateDeviceFingerprint(
  options?: CiphClientConfig["fingerprintOptions"]
): Promise<string> {
  const components: Record<string, string> = {
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  }

  if (options?.includeScreen !== false && typeof globalThis !== "undefined") {
    try {
      const screen = (globalThis as any).screen
      if (screen && typeof screen.width === "number" && typeof screen.height === "number") {
        components.screen = `${screen.width}x${screen.height}`
      }
    } catch {
      // Ignore screen errors
    }
  }

  if (options?.includeTimezone !== false) {
    try {
      components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      // Ignore timezone errors
    }
  }

  if (options?.customFields) {
    Object.assign(components, options.customFields)
  }

  const result = await generateFingerprint(components)
  return result.fingerprint
}

/**
 * Create a Ciph-enabled HTTP client for Svelte.
 *
 * @example
 * ```typescript
 * import { ciphClient } from '@ciph/svelte'
 *
 * const { client, fingerprintStore, errorStore } = ciphClient({
 *   baseURL: 'https://api.example.com',
 *   secret: process.env.VITE_CIPH_SECRET,
 * })
 *
 * // Use like axios - encryption/decryption is transparent:
 * const response = await client.post('/api/data', { message: 'hello' })
 * console.log(response.data) // Plain object
 * ```
 */
export function ciphClient(config: CiphClientConfig): {
  client: CiphClient
  fingerprintStore: ReturnType<typeof writable<string | null>>
  errorStore: ReturnType<typeof writable<string | null>>
  isEncryptingStore: ReturnType<typeof writable<boolean>>
} {
  // Initialize devtools emitter
  initClientEmitter()

  // Create Svelte stores for reactive state
  const fingerprintStore = writable<string | null>(null)
  const errorStore = writable<string | null>(null)
  const isEncryptingStore = writable<boolean>(false)

  // Create axios instance
  const instance = Axios.create({
    baseURL: config.baseURL,
    headers: {
      "Content-Type": "text/plain",
    },
  })

  // Store request data for logging in response interceptor
  const requestDataMap = new Map<
    string,
    {
      method: string
      url: string
      plainBody?: string | undefined
      encryptedBody?: string | undefined
      timestamp: number
    }
  >()

  // ─── Request Interceptor (Encryption) ──────────────────────────────────

  instance.interceptors.request.use(
    async (axiosConfig) => {
      const requestConfig = axiosConfig as AxiosRequestConfig & { skipEncryption?: boolean }
      
      // Skip encryption for excluded routes
      if (
        requestConfig.skipEncryption ||
        config.excludeRoutes?.some((route) => {
          const regex = new RegExp(`^${route.replace(/\*/g, ".*")}$`)
          return regex.test(axiosConfig.url || "")
        })
      ) {
        return axiosConfig
      }

      isEncryptingStore.set(true)

      try {
        // Generate or retrieve fingerprint
        if (!cachedFingerprint) {
          cachedFingerprint = await generateDeviceFingerprint(config.fingerprintOptions)
          fingerprintStore.set(cachedFingerprint)
        }

        // Derive encryption key
        const derivedKey = await deriveKey(config.secret, cachedFingerprint)

        // Encrypt request body if present
        let encryptedBody: EncryptResult | null = null
        let plainBody: string | undefined
        if (axiosConfig.data && ["POST", "PUT", "PATCH"].includes(axiosConfig.method?.toUpperCase() || "")) {
          plainBody =
            typeof axiosConfig.data === "string" ? axiosConfig.data : JSON.stringify(axiosConfig.data)
          encryptedBody = await encrypt(plainBody, derivedKey)
        }

        // Store request data for logging
        const requestId = `${Date.now()}-${Math.random()}`
        requestDataMap.set(requestId, {
          method: axiosConfig.method?.toUpperCase() || "GET",
          url: axiosConfig.url || "",
          plainBody: plainBody ?? undefined,
          encryptedBody: encryptedBody?.ciphertext ?? undefined,
          timestamp: Date.now(),
        })
        ;(axiosConfig as any).__ciphRequestId = requestId

        // Update headers for encrypted request
        if (encryptedBody) {
          axiosConfig.headers["Content-Type"] = "text/plain"
          axiosConfig.headers["X-Ciph-Fingerprint"] = cachedFingerprint
          axiosConfig.data = encryptedBody.ciphertext
        }

        return axiosConfig
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        errorStore.set(errMsg)
        throw error
      } finally {
        isEncryptingStore.set(false)
      }
    },
    (error) => {
      const errMsg = error instanceof Error ? error.message : String(error)
      errorStore.set(errMsg)
      return Promise.reject(error)
    }
  )

  // ─── Response Interceptor (Decryption) ─────────────────────────────────

  instance.interceptors.response.use(
    async (response: AxiosResponse) => {
      const requestId = (response.config as any).__ciphRequestId
      const requestData = requestId ? requestDataMap.get(requestId) : null

      // Skip decryption for non-encrypted responses
      let decryptedData: any = null
      let wasEncrypted = false

      if (response.data && typeof response.data === "string") {
        // Check if response is encrypted (heuristic: base64url format)
        if (/^[A-Za-z0-9_-]+$/.test(response.data)) {
          try {
            wasEncrypted = true

            if (!cachedFingerprint) {
              cachedFingerprint = await generateDeviceFingerprint(config.fingerprintOptions)
              fingerprintStore.set(cachedFingerprint)
            }

            // Derive decryption key
            const derivedKey = await deriveKey(config.secret, cachedFingerprint)

            // Decrypt response body
            const decryptedResult: DecryptResult = await decrypt(response.data, derivedKey)
            decryptedData = JSON.parse(decryptedResult.plaintext)
          } catch (error) {
            // If decryption fails, try to parse as-is
            try {
              decryptedData = JSON.parse(response.data)
              wasEncrypted = false
            } catch {
              decryptedData = response.data
            }
          }
        } else {
          // Try to parse as JSON
          try {
            decryptedData = JSON.parse(response.data)
          } catch {
            decryptedData = response.data
          }
        }
      } else {
        decryptedData = response.data
      }

      // Emit devtools log
      const route = response.config.url?.replace(config.baseURL, "") || response.config.url || ""
      const timestamp = requestData?.timestamp || Date.now()
      
      const log: Partial<CiphClientLog> = {
        id: `${timestamp}-${Math.random()}`,
        method: response.config.method?.toUpperCase() || "GET",
        route,
        status: response.status,
        duration: Date.now() - timestamp,
        timestamp: new Date(timestamp).toISOString(),
        excluded: false,
        request: {
          plainBody: requestData?.plainBody ? JSON.parse(requestData.plainBody) : null,
          encryptedBody: requestData?.encryptedBody ?? null,
          headers: response.config.headers as any,
        },
        response: {
          plainBody: decryptedData,
          encryptedBody: wasEncrypted && typeof response.data === "string" ? response.data : null,
        },
        fingerprint: {
          value: cachedFingerprint || "",
          cached: !!cachedFingerprint,
          retried: false,
        },
        error: null,
      }

      emitDevtoolsLog(log as any)

      // Cleanup
      if (requestId) {
        requestDataMap.delete(requestId)
      }

      // Return response with decrypted data
      return {
        ...response,
        data: decryptedData,
      }
    },
    (error) => {
      const errMsg = error instanceof Error ? error.message : String(error)
      errorStore.set(errMsg)

      // Emit error log
      if (error.response) {
        const timestamp = Date.now()
        const log: Partial<CiphClientLog> = {
          id: `${timestamp}-${Math.random()}`,
          method: error.response.config.method?.toUpperCase() || "GET",
          route: error.response.config.url?.replace(config.baseURL, "") || "",
          status: error.response.status,
          duration: 0,
          timestamp: new Date(timestamp).toISOString(),
          excluded: false,
          request: {
            plainBody: null,
            encryptedBody: null,
            headers: error.response.config.headers as any,
          },
          response: {
            plainBody: null,
            encryptedBody: null,
          },
          fingerprint: {
            value: cachedFingerprint || "",
            cached: !!cachedFingerprint,
            retried: false,
          },
          error: errMsg,
        }
        emitDevtoolsLog(log as any)
      }

      return Promise.reject(error)
    }
  )

  const client: CiphClient = {
    instance,
    get: instance.get.bind(instance),
    post: instance.post.bind(instance),
    put: instance.put.bind(instance),
    patch: instance.patch.bind(instance),
    delete: instance.delete.bind(instance),
  }

  return {
    client,
    fingerprintStore,
    errorStore,
    isEncryptingStore,
  }
}
