import { ciphHandler } from "@ciph/nextjs/server"
import { NextResponse } from "next/server"

export const GET = ciphHandler({
  privateKey: process.env.CIPH_PRIVATE_KEY,
})(async (req, ctx) => {
  return NextResponse.json({
    data: [
      { id: 1, name: "Dimas" },
      { id: 2, name: "John" },
    ],
  })
})
