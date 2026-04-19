import { AxiosRequestConfig } from 'axios';
import { FingerprintOptions, CiphClientLog } from '@ciph/core';
export { CiphError, CiphErrorCode } from '@ciph/core';
import { InjectionKey, App } from 'vue';

interface CiphClientConfig {
    /** Base URL for all requests. */
    baseURL: string;
    /**
     * Server's ECDH P-256 public key in base64url (raw 65-byte uncompressed point).
     * Matches CIPH_PRIVATE_KEY held by the backend.
     * Set from VITE_CIPH_SERVER_PUBLIC_KEY env var.
     */
    serverPublicKey: string;
    /** Fingerprint generation options. */
    fingerprintOptions?: FingerprintOptions;
    /**
     * Action when fingerprint mismatch (CIPH003) occurs after retry.
     * Default: "retry" — auto-retry once with fresh key pair + fingerprint.
     */
    onFingerprintMismatch?: "retry" | "throw" | "ignore";
    /**
     * If true, fall back to plain request when encryption fails.
     * Default: false. Never use in production.
     */
    fallbackToPlain?: boolean;
    /** Routes that skip encryption. Default: ["/health"]. */
    excludeRoutes?: string[];
    /** Default headers added to every request. */
    headers?: Record<string, string>;
}
interface RequestConfig extends AxiosRequestConfig {
    /** Override encryption for this request only. */
    encrypt?: boolean;
    /** Extra fingerprint fields for this request only. */
    fingerprintFields?: Record<string, string>;
}
interface CiphResponse<T> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    ciph: {
        coinsUsed?: number;
        coinsRemaining?: number;
        modelUsed?: string;
    };
}
type CiphClient = {
    get: <T = unknown>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>;
    post: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>;
    put: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>;
    patch: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>;
    delete: <T = unknown>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>;
};
declare function createClient(config: CiphClientConfig): CiphClient;

declare const CIPH_CLIENT_KEY: InjectionKey<CiphClient>;
interface CiphDevtoolsConfig {
    /** Show the floating panel. Default: true in development, false in production. */
    enabled?: boolean;
    /** Max logs to keep in panel. Default: 500 */
    maxLogs?: number;
    /** Panel open by default. Default: false */
    defaultOpen?: boolean;
    /** Panel position. Default: "bottom-right" */
    position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "bottom" | "top" | "left" | "right";
}
interface CiphPluginOptions extends CiphClientConfig {
    /**
     * Built-in devtools configuration.
     * Pass `false` to disable entirely.
     * Devtools are always disabled in production regardless of this setting.
     */
    devtools?: CiphDevtoolsConfig | false;
}
declare const CiphPlugin: {
    install(app: App, options: CiphPluginOptions): void;
};
/**
 * Returns the Ciph HTTP client injected by `app.use(CiphPlugin, { ... })`.
 * Throws if called outside a component tree where CiphPlugin was installed.
 *
 * @example
 * ```ts
 * const ciph = useCiph()
 * const res = await ciph.get('/api/users')
 * ```
 */
declare function useCiph(): CiphClient;

interface CiphClientEmitter {
    emit(event: "log", log: CiphClientLog, isBroadcast?: boolean): void;
    on(event: "log", listener: (log: CiphClientLog) => void): () => void;
}
declare global {
    var __ciphClientEmitter__: CiphClientEmitter | undefined;
}
/**
 * Creates `globalThis.__ciphClientEmitter__` if not already set.
 * Idempotent — safe to call multiple times.
 */
declare function autoInitClientEmitter(): void;
/**
 * Emit a CiphClientLog to the global emitter.
 * No-op if emitter is not initialized (production / SSR).
 */
declare function emitClientLog(log: CiphClientLog): void;

export { CIPH_CLIENT_KEY, type CiphClient, type CiphClientConfig, type CiphClientEmitter, type CiphDevtoolsConfig, CiphPlugin, type CiphPluginOptions, type CiphResponse, type RequestConfig, autoInitClientEmitter, createClient, emitClientLog, useCiph };
