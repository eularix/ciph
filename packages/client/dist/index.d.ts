import { AxiosRequestConfig } from 'axios';
import { FingerprintOptions } from '@ciph/core';

interface CiphClientConfig {
    baseURL: string;
    secret: string;
    fingerprintOptions?: FingerprintOptions;
    onFingerprintMismatch?: "retry" | "throw" | "ignore";
    fallbackToPlain?: boolean;
    excludeRoutes?: string[];
    headers?: Record<string, string>;
}
interface RequestConfig extends AxiosRequestConfig {
    encrypt?: boolean;
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
declare function createClient(config: CiphClientConfig): {
    get: <T = unknown>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>;
    post: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>;
    put: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>;
    patch: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<CiphResponse<T>>;
    delete: <T = unknown>(url: string, config?: RequestConfig) => Promise<CiphResponse<T>>;
};

export { type CiphClientConfig, type CiphResponse, type RequestConfig, createClient };
