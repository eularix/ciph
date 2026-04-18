import { createContext, useContext, useMemo, type ReactNode } from "react"
import { createClient, type CiphClient, type CiphClientConfig } from "./client"
import { autoInitClientEmitter } from "./devtools/emitter"
import { CiphDevtoolsPanel, type CiphDevtoolsPanelProps } from "./devtools/CiphDevtoolsPanel"

// ─── Auto-init client emitter in dev ──────────────────────────────────────────
// Called at module level so the emitter exists before any Axios interceptor runs.
if (process.env.NODE_ENV !== "production") {
  autoInitClientEmitter()
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CiphContext = createContext<CiphClient | null>(null)

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

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface CiphProviderProps
  extends Omit<CiphClientConfig, "baseURL" | "serverPublicKey"> {
  baseURL: string
  serverPublicKey: string
  children: ReactNode
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
  devtools?: CiphDevtoolsConfig | false
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
export function CiphProvider({ children, devtools: devtoolsConfig, ...config }: CiphProviderProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const client = useMemo(() => createClient(config), [config.baseURL, config.serverPublicKey])

  const isProduction = process.env.NODE_ENV === "production"
  const devtoolsEnabled =
    !isProduction &&
    devtoolsConfig !== false &&
    (devtoolsConfig?.enabled ?? true)

  // Build panel props without undefined values (satisfies exactOptionalPropertyTypes)
  const dt = devtoolsConfig !== false ? devtoolsConfig : undefined
  const panelProps: CiphDevtoolsPanelProps = {}
  if (dt?.maxLogs !== undefined) panelProps.maxLogs = dt.maxLogs
  if (dt?.defaultOpen !== undefined) panelProps.defaultOpen = dt.defaultOpen
  if (dt?.position !== undefined) panelProps.position = dt.position

  return (
    <CiphContext.Provider value={client}>
      {children}
      {devtoolsEnabled && <CiphDevtoolsPanel client={client} {...panelProps} />}
    </CiphContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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
export function useCiph(): CiphClient {
  const client = useContext(CiphContext)
  if (!client) {
    throw new Error(
      "[ciph] useCiph() called outside <CiphProvider>. " +
        "Wrap your app with <CiphProvider baseURL=... serverPublicKey=...>."
    )
  }
  return client
}
