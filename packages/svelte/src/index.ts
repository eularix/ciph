// Main export for @ciph/svelte
// Client-side exports
export { ciphClient } from "./client"
export type {
  CiphClientConfig,
  CiphClient,
  CiphResponse,
  CiphClientContext,
  RequestConfig,
} from "./client"

// Server-side exports
export { ciphHooks, ciphPublicKeyEndpoint } from "./server"
export type { CiphSvelteKitConfig } from "./server"

// DevTools exports
// Note: Import CiphDevtoolsPanel.svelte directly in your Svelte components:
// <script>
//   import CiphDevtoolsPanel from '@ciph/svelte/src/devtools/CiphDevtoolsPanel.svelte'
// </script>
export {
  initClientEmitter,
  getCiphClientEmitter,
} from "./devtools/emitter"
export type {
  CiphClientEmitter,
} from "./devtools/emitter"

// Re-export core error type for convenience
export { CiphError } from "@ciph/core"
export type { CiphErrorCode } from "@ciph/core"
