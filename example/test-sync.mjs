#!/usr/bin/env node
import { deriveECDHBits, deriveSessionKey, generateKeyPair, encryptFingerprint, decryptFingerprint } from "@ciph/core"
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

const goPrivKey = goEnv.CIPH_PRIVATE_KEY?.trim()
const reactPubKey = reactEnv.VITE_CIPH_SERVER_PUBLIC_KEY?.trim()

console.log("=== Key Sync Test ===\n")

if (!goPrivKey || !reactPubKey) {
  console.error("❌ Keys missing from .env")
  console.error(`Go CIPH_PRIVATE_KEY: ${goPrivKey ? "✓" : "✗"}`)
  console.error(`React VITE_CIPH_SERVER_PUBLIC_KEY: ${reactPubKey ? "✓" : "✗"}`)
  process.exit(1)
}

console.log(`✓ Go private key loaded (${goPrivKey.length} chars)`)
console.log(`✓ React public key loaded (${reactPubKey.length} chars)\n`)

try {
  // Generate client ephemeral keypair (simulates React frontend)
  const clientKeyPair = await generateKeyPair()
  console.log("✓ Generated client ephemeral keypair")

  // Client does ECDH with server public key
  console.log("✓ Performing ECDH derivation...")
  const sharedSecret = await deriveECDHBits(clientKeyPair.privateKey, reactPubKey)
  console.log(`  Shared secret derived (${sharedSecret.byteLength} bytes)`)

  // Derive session key
  const sessionKey = await deriveSessionKey(sharedSecret)
  console.log(`✓ Session key derived: ${sessionKey}`)

  // Test fingerprint encryption/decryption
  const testFp = "test-fingerprint"
  const encryptedFp = await encryptFingerprint(testFp, sessionKey)
  console.log(`✓ Fingerprint encrypted successfully`)

  const decryptedFp = await decryptFingerprint(encryptedFp, sessionKey)
  if (decryptedFp === testFp) {
    console.log(`✓ Fingerprint decryption successful\n`)
    console.log("✅ Keys are properly synchronized!")
    console.log("If Go server still returns CIPH004, restart both servers cleanly:")
    console.log("  Go:   go run cmd/main.go")
    console.log("  React: npm run dev")
  } else {
    console.error(`✗ Decryption mismatch`)
  }

} catch (err) {
  console.error(`\n❌ Error:`, err.message)
  console.error(`\nThis means keys don't match or format is wrong`)
  process.exit(1)
}
