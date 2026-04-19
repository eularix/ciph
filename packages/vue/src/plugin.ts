import { inject, type App, type InjectionKey } from "vue"
import { createClient, type CiphClient, type CiphClientConfig } from "./client"
import { autoInitClientEmitter } from "./devtools/emitter"

// ─── Injection key ────────────────────────────────────────────────────────────

export const CIPH_CLIENT_KEY: InjectionKey<CiphClient> = Symbol("ciph-client")

// ─── Devtools config ──────────────────────────────────────────────────────────

export interface CiphDevtoolsConfig {
  /** Show the floating panel. Default: true in development, false in production. */
  enabled?: boolean
  /** Max logs to keep in panel. Default: 500 */
  maxLogs?: number
  /** Panel open by default. Default: false */
  defaultOpen?: boolean
  /** Panel position. Default: "bottom-right" */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "bottom" | "top" | "left" | "right"
}

// ─── Plugin options ───────────────────────────────────────────────────────────

export interface CiphPluginOptions extends CiphClientConfig {
  /**
   * Built-in devtools configuration.
   * Pass `false` to disable entirely.
   * Devtools are always disabled in production regardless of this setting.
   */
  devtools?: CiphDevtoolsConfig | false
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export const CiphPlugin = {
  install(app: App, options: CiphPluginOptions): void {
    const { devtools: devtoolsConfig, ...clientConfig } = options

    const client = createClient(clientConfig)
    app.provide(CIPH_CLIENT_KEY, client)

    const nodeEnv = (typeof globalThis !== "undefined" &&
      "process" in globalThis &&
      (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.["NODE_ENV"]) || ""
    const isProduction = nodeEnv === "production"

    if (!isProduction) {
      autoInitClientEmitter()

      const dtConfig = devtoolsConfig === false ? undefined : devtoolsConfig
      const devtoolsEnabled = dtConfig?.enabled ?? true

      if (devtoolsEnabled) {
        const dt: CiphDevtoolsConfig | undefined = dtConfig
        const panelOptions = {
          ...(dt?.maxLogs !== undefined && { maxLogs: dt.maxLogs }),
          ...(dt?.defaultOpen !== undefined && { defaultOpen: dt.defaultOpen }),
          ...(dt?.position !== undefined && { position: dt.position }),
          client,
        }
        // Mount devtools panel after app is mounted
        app.mixin({
          mounted() {
            // Only run once on the root component
            if ((this as { $parent?: unknown }).$parent !== null) return
            import("./devtools/CiphDevtoolsPanel").then(({ mountDevtoolsPanel }) => {
              mountDevtoolsPanel(panelOptions)
            }).catch(() => { /* devtools unavailable */ })
          },
        })
      }
    }
  },
}

// ─── Composable ───────────────────────────────────────────────────────────────

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
export function useCiph(): CiphClient {
  const client = inject(CIPH_CLIENT_KEY)
  if (!client) {
    throw new Error(
      "[ciph] useCiph() called without CiphPlugin installed. " +
        "Call app.use(CiphPlugin, { baseURL, serverPublicKey }) in main.ts."
    )
  }
  return client
}
