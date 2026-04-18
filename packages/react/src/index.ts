// HTTP client (escape hatch — use CiphProvider + useCiph in React apps)
export { createClient } from "./client"
export type {
  CiphClientConfig,
  CiphClient,
  CiphResponse,
  RequestConfig,
} from "./client"

// React context + hooks
export { CiphProvider, useCiph } from "./context"
export type { CiphProviderProps, CiphDevtoolsConfig } from "./context"

// Built-in devtools emitter (for advanced: emit custom logs or subscribe)
export { autoInitClientEmitter, emitClientLog } from "./devtools/emitter"
export type { CiphClientEmitter } from "./devtools/emitter"

// Standalone Inspector
export { CiphInspector } from "./devtools/CiphInspector"
export type { CiphInspectorProps } from "./devtools/CiphInspector"

// Re-export core error type for convenience
export { CiphError } from "@ciph/core"
export type { CiphErrorCode } from "@ciph/core"
