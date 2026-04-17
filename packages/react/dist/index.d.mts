import { AxiosRequestConfig } from 'axios';
import { FingerprintOptions, CiphClientLog } from '@ciph/core';
export { CiphError, CiphErrorCode } from '@ciph/core';
import * as react_jsx_runtime from 'react/jsx-runtime';
import { ReactNode } from 'react';

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

interface CiphDevtoolsConfig {
    /** Show the floating panel. Default: true in development, false in production. */
    enabled?: boolean;
    /** Max logs to keep in panel. Default: 500 */
    maxLogs?: number;
    /** Panel open by default. Default: false */
    defaultOpen?: boolean;
    /** Panel position. Default: "bottom-right" */
    position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}
interface CiphProviderProps extends Omit<CiphClientConfig, "baseURL" | "serverPublicKey"> {
    baseURL: string;
    serverPublicKey: string;
    children: ReactNode;
    /**
     * Built-in devtools configuration.
     * Pass `false` to disable entirely.
     * Devtools are always disabled in production regardless of this setting.
     *
     * @example
     * // Default (auto-shown in dev)
     * <CiphProvider baseURL="..." serverPublicKey="...">
     *   <App />
     * </CiphProvider>
     *
     * @example
     * // Custom config
     * <CiphProvider devtools={{ defaultOpen: true, position: "bottom-left" }}>
     *   <App />
     * </CiphProvider>
     *
     * @example
     * // Disable entirely
     * <CiphProvider devtools={false}>
     *   <App />
     * </CiphProvider>
     */
    devtools?: CiphDevtoolsConfig | false;
}
/**
 * Wraps your app to provide a Ciph client via React context.
 * Creates the client instance once (stable across renders).
 *
 * In development, automatically renders the built-in 🛡️ Ciph Inspector
 * floating panel — no extra imports or JSX needed.
 *
 * @example
 * ```tsx
 * <CiphProvider baseURL={import.meta.env.VITE_API_URL} serverPublicKey={import.meta.env.VITE_CIPH_SERVER_PUBLIC_KEY}>
 *   <App />
 * </CiphProvider>
 * ```
 */
declare function CiphProvider({ children, devtools: devtoolsConfig, ...config }: CiphProviderProps): react_jsx_runtime.JSX.Element;
/**
 * Returns the Ciph HTTP client from the nearest `<CiphProvider>`.
 * Throws if called outside a provider.
 *
 * @example
 * ```ts
 * const ciph = useCiph()
 * const res = await ciph.get('/api/users')
 * ```
 */
declare function useCiph(): CiphClient;

interface CiphClientEmitter {
    emit(event: "log", log: CiphClientLog): void;
    on(event: "log", listener: (log: CiphClientLog) => void): () => void;
}
declare global {
    var __ciphClientEmitter__: CiphClientEmitter | undefined;
}
/**
 * Creates `globalThis.__ciphClientEmitter__` if not already set.
 * Should be called once at module init (inside CiphProvider, dev-mode only).
 * Idempotent — safe to call multiple times.
 */
declare function autoInitClientEmitter(): void;
/**
 * Emit a CiphClientLog to the global emitter.
 * Called by client.ts interceptors after each request/response.
 * No-op if emitter is not initialized (production / SSR).
 */
declare function emitClientLog(log: CiphClientLog): void;

export { type CiphClient, type CiphClientConfig, type CiphClientEmitter, type CiphDevtoolsConfig, CiphProvider, type CiphProviderProps, type CiphResponse, type RequestConfig, autoInitClientEmitter, createClient, emitClientLog, useCiph };
