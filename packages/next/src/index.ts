/**
 * @ciph/nextjs - Transparent HTTP encryption for Next.js
 *
 * Combines @ciph/react (client-side) with Next.js API routes (server-side)
 * for end-to-end encryption without changing developer experience.
 *
 * Usage:
 * - Frontend: Use `CiphProvider` and `useCiph()` hook (re-exported from @ciph/react)
 * - Backend: Wrap API handlers with `ciphHandler(config)`
 */

// Server-side exports
export { ciphHandler, ciphPublicKeyHandler, type CiphNextConfig } from "./server"

// Client-side exports (re-exported from @ciph/react)
export { CiphProvider, useCiph, createClient } from "./client"
export type { CiphProviderProps, CiphClientEmitter } from "./client"
