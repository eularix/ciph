import { deriveECDHBits, deriveSessionKey } from "@ciph/core"
import { createPrivateKeyFromPKCS8, createPublicKeyFromRaw } from "./crypto-test.mjs"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, "utf-8")
  const env = {}
  content.split("\n").forEach(line => {
    const [key, ...valueParts] = line.split("=")
    const trimmedKey = key?.trim()
    if (trimmedKey && !trimmedKey.startsWith("#")) {
      env[trimmedKey] = valueParts.join("=").trim()
    }
  })
  return env
}

const goEnv = loadEnv(path.join(__dirname, "go", ".env"))
const reactEnv = loadEnv(path.join(__dirname, "react", ".env"))

const goPrivKey = goEnv.CIPH_PRIVATE_KEY
const reactPubKey = reactEnv.CIPH_PUBLIC_KEY

console.log("=== ECDH Test ===\n")
console.log(`Go private key (PKCS8, first 50 chars): ${goPrivKey.slice(0, 50)}...`)
console.log(`React public key: ${reactPubKey}\n`)

if (!goPrivKey || !reactPubKey) {
  console.error("❌ Keys not found in .env files")
  process.exit(1)
}

try {
  // Step 1: Generate ephemeral client key pair (simulating React)
  const { generateKeyPair } = await import("@ciph/core")
  const clientKeyPair = await generateKeyPair()
  console.log(`✓ Generated client ephemeral keypair`)
  console.log(`  Client public key: ${clientKeyPair.publicKey}`)

  // Step 2: Client does ECDH(client_private, server_public)
  console.log(`\n✓ Client ECDH with server public key...`)
  const clientSharedSecret = await deriveECDHBits(clientKeyPair.privateKey, reactPubKey)
  const clientSessionKey = await deriveSessionKey(clientSharedSecret)
  console.log(`  Client session key: ${clientSessionKey}`)

  // Step 3: Simulate server doing ECDH(server_private, client_public)
  // This is where the mismatch would show
  console.log(`\n⚠️  Server ECDH simulation...`)
  console.log(`  Server needs to import PKCS8 private key and do ECDH with client public key`)
  console.log(`  This requires Go server to derive shared secret correctly`)
  console.log(`  If session keys don't match → CIPH004 error\n`)

  console.log(`✓ Client successfully derived session key`)
  console.log(`  If Go server derives same key, encryption/decryption succeeds`)
  console.log(`  If different, fingerprint decryption fails → CIPH004`)

} catch (err) {
  console.error(`❌ ECDH failed:`, err.message)
  console.error(`\nPossible issues:`)
  console.error(`1. Keys not synchronized`)
  console.error(`2. Public key format wrong`)
  console.error(`3. Private key format wrong (should be PKCS8)`)
  process.exit(1)
}
