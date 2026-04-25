"use client"

import { ReactNode } from "react"
import { ClientProvider } from "./client-provider"

export default function Providers({ children }: { children: ReactNode }) {
  return <ClientProvider>{children}</ClientProvider>
}

