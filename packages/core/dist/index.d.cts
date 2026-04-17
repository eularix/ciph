/**
 * Core configuration passed to all Ciph operations.
 */
interface CiphCoreConfig {
    /**
     * Shared secret key. Must be identical on frontend and backend.
     * Minimum 32 characters. Stored in .env — never hardcoded.
     */
    secret: string;
    /**
     * Controls which components are included in fingerprint generation.
     */
    fingerprintOptions?: FingerprintOptions;
}
interface FingerprintOptions {
    /** Include screen resolution. Default: true */
    includeScreen?: boolean;
    /** Include timezone. Default: true */
    includeTimezone?: boolean;
    /** Additional custom fields to include in fingerprint */
    customFields?: Record<string, string>;
}
/**
 * Raw components used to generate a device fingerprint.
 */
interface FingerprintComponents {
    /** Client IP address. Backend-provided only. */
    ip?: string;
    /** User-Agent string */
    userAgent?: string;
    /** Screen resolution, e.g. "1920x1080" */
    screen?: string;
    /** IANA timezone, e.g. "Asia/Jakarta" */
    timezone?: string;
    /** Any additional custom fields */
    [key: string]: string | undefined;
}
/**
 * Result of fingerprint generation.
 */
interface FingerprintResult {
    /** SHA-256 hex digest of sorted components (64 chars) */
    fingerprint: string;
    /** The components used to generate this fingerprint */
    components: FingerprintComponents;
}
/**
 * Result of an encryption operation.
 */
interface EncryptResult {
    /** Base64url-encoded string: IV + AuthTag + Ciphertext */
    ciphertext: string;
    /** The IV used (base64url). Embedded in ciphertext, exposed for debugging only. */
    iv: string;
}
/**
 * Result of a decryption operation.
 */
interface DecryptResult {
    /** Decrypted plain text */
    plaintext: string;
}
/**
 * ECDH P-256 key pair. Used for asymmetric key exchange (v2).
 * - privateKey: base64url-encoded pkcs8 (server only, never exposed)
 * - publicKey:  base64url-encoded raw uncompressed P-256 point (65 bytes)
 */
interface CiphKeyPair {
    privateKey: string;
    publicKey: string;
}
/**
 * All Ciph error codes.
 */
type CiphErrorCode = "CIPH001" | "CIPH002" | "CIPH003" | "CIPH004" | "CIPH005" | "CIPH006" | "CIPH007";
/**
 * Structured error thrown by all @ciph/* packages.
 */
declare class CiphError extends Error {
    readonly code: CiphErrorCode;
    readonly cause?: unknown | undefined;
    constructor(code: CiphErrorCode, message: string, cause?: unknown | undefined);
}
/**
 * Error response shape sent over HTTP.
 */
interface CiphErrorResponse {
    code: CiphErrorCode;
    message: string;
}
interface CiphServerLogEcdh {
    clientPublicKey: string;
    sessionKeyDerived: boolean;
}
interface CiphServerLog {
    id: string;
    method: string;
    route: string;
    status: number;
    duration: number;
    timestamp: string;
    request: {
        plainBody: unknown | null;
        encryptedBody: string | null;
        headers: Record<string, string>;
        ip: string;
        userAgent: string;
    };
    response: {
        plainBody: unknown | null;
        encryptedBody: string;
    };
    fingerprint: {
        value: string;
        ipMatch: boolean;
        uaMatch: boolean;
    };
    excluded: boolean;
    error: CiphErrorCode | null;
}
interface CiphClientLog {
    id: string;
    method: string;
    route: string;
    status: number;
    duration: number;
    timestamp: string;
    request: {
        plainBody: unknown | null;
        encryptedBody: string | null;
        headers: Record<string, string>;
    };
    response: {
        plainBody: unknown | null;
        encryptedBody: string | null;
    };
    fingerprint: {
        value: string;
        cached: boolean;
        retried: boolean;
    };
    excluded: boolean;
    error: string | null;
}

declare function randomBytes(length: number): Uint8Array;
declare function toBase64url(bytes: Uint8Array): string;
declare function fromBase64url(str: string): Uint8Array;
declare function deriveKey(secret: string, fingerprint: string): Promise<string>;
declare function generateFingerprint(components: FingerprintComponents, options?: FingerprintOptions): Promise<FingerprintResult>;
declare function encryptFingerprint(fingerprint: string, secret: string): Promise<string>;
declare function decryptFingerprint(encrypted: string, secret: string): Promise<string>;
declare function validateFingerprint(stored: FingerprintComponents, incoming: FingerprintComponents): boolean;
declare function encrypt(plaintext: string, key: string): Promise<EncryptResult>;
declare function decrypt(ciphertext: string, key: string): Promise<DecryptResult>;

/**
 * Generate a new ECDH P-256 key pair.
 * Server: call once, store privateKey in CIPH_PRIVATE_KEY env var.
 * Client: call per-session to get an ephemeral key pair.
 */
declare function generateKeyPair(): Promise<CiphKeyPair>;
/**
 * Perform ECDH key exchange.
 * - privateKey: base64url pkcs8 (your private key)
 * - peerPublicKey: base64url raw uncompressed point (peer's public key)
 * Returns 32 raw shared bytes (x-coordinate of ECDH shared point).
 */
declare function deriveECDHBits(privateKey: string, peerPublicKey: string): Promise<Uint8Array>;
/**
 * Derive a session AES-256 key from raw ECDH shared bytes.
 * Uses HKDF-SHA256 with info = "ciph-v2-session".
 * Returns base64url AES key.
 */
declare function deriveSessionKey(rawSharedBytes: Uint8Array): Promise<string>;
/**
 * Derive a per-request AES-256 key from session key + device fingerprint hash.
 * Uses HKDF-SHA256 with salt = fingerprintHash (hex), info = "ciph-v2-request".
 * Returns base64url AES key.
 */
declare function deriveRequestKey(sessionKey: string, fingerprintHash: string): Promise<string>;

export { type CiphClientLog, type CiphCoreConfig, CiphError, type CiphErrorCode, type CiphErrorResponse, type CiphKeyPair, type CiphServerLog, type CiphServerLogEcdh, type DecryptResult, type EncryptResult, type FingerprintComponents, type FingerprintOptions, type FingerprintResult, decrypt, decryptFingerprint, deriveECDHBits, deriveKey, deriveRequestKey, deriveSessionKey, encrypt, encryptFingerprint, fromBase64url, generateFingerprint, generateKeyPair, randomBytes, toBase64url, validateFingerprint };
