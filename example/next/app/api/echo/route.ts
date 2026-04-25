import { ciphHandler } from "@ciph/nextjs/server"
import { NextResponse } from "next/server"

export const POST = ciphHandler({
  privateKey: process.env.CIPH_PRIVATE_KEY,
})(async (req, ctx) => {
  const body = ctx.ciphDecryptedJson
  return NextResponse.json({
    echo: body,
    timestamp: new Date().toISOString(),
  })
})
