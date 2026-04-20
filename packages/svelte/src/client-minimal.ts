// Minimal Ciph Svelte Client - Minimal working version
import type { AxiosInstance, AxiosRequestConfig } from "axios"
import { create } from "axios"
import type { CiphError, FingerprintComponents } from "@ciph/core"
import { writable } from "svelte/store"

export interface CiphClientConfig {
  baseURL: string
  secret: string
  excludeRoutes?: string[]
  fingerprintOptions?: {
    includeScreen?: boolean
    includeTimezone?: boolean
    customFields?: Record<string, string>
  }
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
  error: CiphError | null
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
 * // Use like axios:
 * const response = await client.get('/api/data')
 * ```
 */
export function ciphClient(config: CiphClientConfig): {
  client: CiphClient
  fingerprintStore: import("svelte/store").Writable<string | null>
  errorStore: import("svelte/store").Writable<CiphError | null>
  isEncryptingStore: import("svelte/store").Writable<boolean>
} {
  // Create Svelte stores for reactive state
  const fingerprintStore = writable<string | null>(null)
  const errorStore = writable<CiphError | null>(null)
  const isEncryptingStore = writable<boolean>(false)

  // Create axios instance
  const instance = create({
    baseURL: config.baseURL,
    headers: {
      "Content-Type": "application/json",
    },
  })

  // TODO: Add request interceptor for encryption
  // TODO: Add response interceptor for decryption
  // TODO: Implement fingerprint generation and caching
  // TODO: Implement ECDH key exchange
  // TODO: Implement AES-256-GCM encryption/decryption

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
