import { generateKeyPair, deriveECDHBits, deriveSessionKey, encryptFingerprint, decryptFingerprint } from "@ciph/core"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load Go .env
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

const goEnv = loadEnv(path.join(__dirname, ".env"))
const reactEnv = loadEnv(path.join(__dirname, "../react/.env"))

const goPrivateKey = goEnv.CIPH_PRIVATE_KEY
const reactPublicKey = reactEnv.VITE_CIPH_SERVER_PUBLIC_KEY

console.log("=== Key Sync Debug ===\n")
console.log(`Go private key: ${goPrivateKey}`)
console.log(`React public key: ${reactPublicKey}`)
console.log()

if (!goPrivateKey || !reactPublicKey) {
  console.error("ERROR: Missing keys in .env files")
  process.exit(1)
}

// Test: Generate client key pair and do ECDH
console.log("=== Testing ECDH Derivation ===")
const clientKeyPair = await generateKeyPair()
console.log(`Client public key: ${clientKeyPair.publicKey}`)
console.log(`Client private key: ${clientKeyPair.privateKey.slice(0, 20)}...`)

try {
  // Client does ECDH with React's server public key
  const sharedSecret = await deriveECDHBits(clientKeyPair.privateKey, reactPublicKey)
  console.log(`\nShared secret derived successfully`)
  console.log(`Shared secret (hex): ${Buffer.from(sharedSecret).toString("hex")}`)

  // Derive session key
  const sessionKey = await deriveSessionKey(sharedSecret)
  console.log(`\nSession key derived: ${sessionKey}`)

  // Test fingerprint encryption/decryption
  console.log("\n=== Testing Fingerprint Encryption ===")
  const testFingerprint = "test-fingerprint-hash"
  const encrypted = await encryptFingerprint(testFingerprint, sessionKey)
  console.log(`Encrypted fingerprint: ${encrypted.slice(0, 50)}...`)

  const decrypted = await decryptFingerprint(encrypted, sessionKey)
  console.log(`Decrypted fingerprint: ${decrypted}`)
  console.log(`Match: ${decrypted === testFingerprint ? "✓ YES" : "✗ NO"}`)

  if (decrypted === testFingerprint) {
    console.log("\n✓ Keys are synchronized and crypto works!")
  } else {
    console.log("\n✗ Decryption failed - keys may be mismatched")
  }
} catch (err) {
  console.error(`\n✗ ECDH failed:`, err.message)
  console.error("\nThis means the React public key doesn't match the Go private key.")
  console.error("Regenerate keys and sync both .env files.")
}
