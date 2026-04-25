"use client"

import { CiphProvider, useCiph as useCiphFromReact, type CiphClient } from "@ciph/react"
import { ReactNode } from "react"

export function ClientProvider({ children }: { children: ReactNode }) {
  return (
    <CiphProvider
      baseURL={typeof window !== "undefined" ? window.location.origin : "http://localhost:3001"}
      serverPublicKey={process.env.NEXT_PUBLIC_CIPH_SERVER_PUBLIC_KEY || ""}
    >
      {children}
    </CiphProvider>
  )
}

export function useCiph(): CiphClient {
  return useCiphFromReact()
}

export function ClientOnly({ children }: { children: ReactNode }) {
  return children
}
