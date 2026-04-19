import * as core from '@ciph/core';
import { CiphServerLog } from '@ciph/core';
import { Hono, MiddlewareHandler } from 'hono';
import * as hono_types from 'hono/types';

interface CiphHonoEmitter {
    emit(event: "log", log: CiphServerLog): void;
    on(event: "log", listener: (log: CiphServerLog) => void): void;
    off(event: "log", listener: (log: CiphServerLog) => void): void;
}
declare global {
    var ciphServerEmitter: CiphHonoEmitter | undefined;
}
declare function getCiphInspectorApp(): Hono<hono_types.BlankEnv, hono_types.BlankSchema, "/">;

/**
 * Serves the server's public key at GET /ciph-public-key.
 * Used by v2 clients to obtain the server public key for ECDH key exchange.
 * Always unprotected — the public key is meant to be public.
 *
 * Setup (recommended - use with key generation CLI):
 * ```ts
 * // 1. Run: npx ciph generate-keys
 * // 2. Get both CIPH_PRIVATE_KEY and VITE_CIPH_SERVER_PUBLIC_KEY from output
 * // 3. In your Hono app:
 *
 * const publicKey = process.env.VITE_CIPH_SERVER_PUBLIC_KEY
 * app.get("/ciph-public-key", ciphPublicKeyEndpoint(publicKey))
 * app.use("*", ciph({ privateKey: process.env.CIPH_PRIVATE_KEY }))
 * ```
 */
declare function ciphPublicKeyEndpoint(publicKey: string): MiddlewareHandler;
interface CiphHonoConfig {
    /**
     * v2 (ECDH asymmetric) — server's P-256 private key in base64url pkcs8.
     * Set from CIPH_PRIVATE_KEY env var. Takes priority over `secret` when present.
     */
    privateKey?: string;
    /**
     * v1 (symmetric) — shared secret, min 32 chars.
     * Kept for backward compatibility. Use `privateKey` for new apps.
     * @deprecated Use privateKey (ECDH) instead.
     */
    secret?: string;
    /**
     * Routes that skip encryption entirely. Globs supported.
     * Default: ["/health", "/ciph", "/ciph/*", "/ciph-public-key"]
     */
    excludeRoutes?: string[];
    /**
     * v1 only: validate IP in fingerprint against request IP.
     * v2: UA is always validated; IP is not in fingerprint.
     * Default: true
     */
    strictFingerprint?: boolean;
    /** Max payload size in bytes. Default: 10 MB */
    maxPayloadSize?: number;
    /**
     * If true, allow requests without encryption headers (plain pass-through).
     * Default: false. Migration only.
     */
    allowUnencrypted?: boolean;
    /** @internal test-only */
    _testOverrides?: {
        encrypt?: typeof core.encrypt;
    };
}
declare function ciphExclude(): MiddlewareHandler;
declare function ciph(config: CiphHonoConfig): MiddlewareHandler;

export { type CiphHonoConfig, ciph, ciphExclude, ciphPublicKeyEndpoint, getCiphInspectorApp };
