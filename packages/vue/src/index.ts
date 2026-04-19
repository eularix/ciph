// HTTP client (escape hatch — use CiphPlugin + useCiph in Vue apps)
export { createClient } from "./client"
export type {
  CiphClientConfig,
  CiphClient,
  CiphResponse,
  RequestConfig,
} from "./client"

// Vue plugin + composable
export { CiphPlugin, useCiph, CIPH_CLIENT_KEY } from "./plugin"
export type { CiphPluginOptions, CiphDevtoolsConfig } from "./plugin"

// Devtools emitter (for advanced: emit custom logs or subscribe)
export { autoInitClientEmitter, emitClientLog } from "./devtools/emitter"
export type { CiphClientEmitter } from "./devtools/emitter"

// Re-export core error type for convenience
export { CiphError } from "@ciph/core"
export type { CiphErrorCode } from "@ciph/core"
