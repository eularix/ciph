import { ciphPublicKeyHandler } from "@ciph/nextjs/server"

const publicKey = process.env.NEXT_PUBLIC_CIPH_SERVER_PUBLIC_KEY || ""

export const GET = () => ciphPublicKeyHandler(publicKey)
