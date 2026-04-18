---
"@ciph/core": minor
"@ciph/client": minor
"@ciph/hono": minor
"@ciph/react": minor
---

Implement ECDH v2 asymmetric encryption for enhanced security

- Replace v1 shared secret with P-256 ECDH key exchange
- Session key derivation with HKDF-SHA256
- Device fingerprint binding for request keys
- Automatic key negotiation via X-Client-PublicKey header
- Maintains AES-256-GCM for body encryption
- Forward secrecy with ephemeral client keys
