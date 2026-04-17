// Escape hatch for code outside React component tree (e.g. service layer modules).
// In components, prefer useCiph() hook via CiphProvider.
import { createClient } from '@ciph/react'

export const ciph = createClient({
  baseURL: import.meta.env.VITE_API_URL as string,
  serverPublicKey: import.meta.env.VITE_CIPH_SERVER_PUBLIC_KEY as string,
})

