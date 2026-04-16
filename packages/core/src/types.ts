/**
 * Core configuration passed to all Ciph operations.
 */
export interface CiphCoreConfig {
  /** 
   * Shared secret key. Must be identical on frontend and backend.
   * Minimum 32 characters. Stored in .env — never hardcoded.
   */
  secret: string

  /**
   * Controls which components are included in fingerprint generation.
   */
  fingerprintOptions?: FingerprintOptions
}

export interface FingerprintOptions {
  /** Include screen resolution. Default: true */
  includeScreen?: boolean

  /** Include timezone. Default: true */
  includeTimezone?: boolean

  /** Additional custom fields to include in fingerprint */
  customFields?: Record<string, string>
}

/**
 * Raw components used to generate a device fingerprint.
 */
export interface FingerprintComponents {
  /** Client IP address. Backend-provided only. */
  ip?: string

  /** User-Agent string */
  userAgent?: string

  /** Screen resolution, e.g. "1920x1080" */
  screen?: string

  /** IANA timezone, e.g. "Asia/Jakarta" */
  timezone?: string

  /** Any additional custom fields */
  [key: string]: string | undefined
}

/**
 * Result of fingerprint generation.
 */
export interface FingerprintResult {
  /** SHA-256 hex digest of sorted components (64 chars) */
  fingerprint: string

  /** The components used to generate this fingerprint */
  components: FingerprintComponents
}

/**
 * Result of an encryption operation.
 */
export interface EncryptResult {
  /** Base64url-encoded string: IV + AuthTag + Ciphertext */
  ciphertext: string

  /** The IV used (base64url). Embedded in ciphertext, exposed for debugging only. */
  iv: string
}

/**
 * Result of a decryption operation.
 */
export interface DecryptResult {
  /** Decrypted plain text */
  plaintext: string
}

/**
 * All Ciph error codes.
 */
export type CiphErrorCode =
  | "CIPH001" // X-Fingerprint header missing
  | "CIPH002" // Fingerprint decryption failed (wrong secret)
  | "CIPH003" // Fingerprint mismatch (IP or UA changed)
  | "CIPH004" // Request body decryption failed
  | "CIPH005" // Payload too large
  | "CIPH006" // Response encryption failed

/**
 * Structured error thrown by all @ciph/* packages.
 */
export class CiphError extends Error {
  constructor(
    public readonly code: CiphErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = "CiphError"
  }
}

/**
 * Error response shape sent over HTTP.
 */
export interface CiphErrorResponse {
  code: CiphErrorCode
  message: string
}

export interface CiphServerLog {
  id: string
  method: string
  route: string
  status: number
  duration: number
  timestamp: string
  request: {
    plainBody: unknown | null
    encryptedBody: string | null
    headers: Record<string, string>
    ip: string
    userAgent: string
  }
  response: {
    plainBody: unknown | null
    encryptedBody: string
  }
  fingerprint: {
    value: string
    ipMatch: boolean
    uaMatch: boolean
  }
  excluded: boolean
  error: CiphErrorCode | null
}

export interface CiphClientLog {
  id: string
  method: string
  route: string
  status: number
  duration: number
  timestamp: string
  request: {
    plainBody: unknown | null
    encryptedBody: string | null
    headers: Record<string, string>
  }
  response: {
    plainBody: unknown | null
    encryptedBody: string | null
  }
  fingerprint: {
    value: string
    cached: boolean
    retried: boolean
  }
  excluded: boolean
  error: string | null
}