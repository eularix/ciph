import * as core from '@ciph/core';
import { MiddlewareHandler } from 'hono';

interface CiphHonoConfig {
    secret: string;
    excludeRoutes?: string[];
    strictFingerprint?: boolean;
    maxPayloadSize?: number;
    allowUnencrypted?: boolean;
    /** @internal test-only override, never set in production */
    _testOverrides?: {
        encrypt?: typeof core.encrypt;
    };
}
declare function ciphExclude(): MiddlewareHandler;
declare function ciph(config: CiphHonoConfig): MiddlewareHandler;

export { type CiphHonoConfig, ciph, ciphExclude };
