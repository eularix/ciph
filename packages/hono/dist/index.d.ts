import * as core from '@ciph/core';
import { MiddlewareHandler } from 'hono';

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
        enabled?: boolean;
        /** Port for the inspector HTTP + WebSocket server. Default: 4321 */
        port?: number;
    } | false;
    /** @internal test-only */
    _testOverrides?: {
        encrypt?: typeof core.encrypt;
    };
}
declare function ciphExclude(): MiddlewareHandler;
declare function ciph(config: CiphHonoConfig): MiddlewareHandler;

export { type CiphHonoConfig, ciph, ciphExclude };
