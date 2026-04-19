# @ciph/core

## 0.7.0

### Minor Changes

- 4b8f626: Release stable versions: remove beta tags and publish to npm latest
- 4b8f626: Release stable versions: remove beta tags and publish to npm latest
- b93548b: Release stable versions: remove beta tags and publish to npm latest

## 0.6.0

### Minor Changes

- 6a2ba72: Implement ECDH v2 asymmetric encryption for enhanced security

  - Replace v1 shared secret with P-256 ECDH key exchange
  - Session key derivation with HKDF-SHA256
  - Device fingerprint binding for request keys
  - Automatic key negotiation via X-Client-PublicKey header
  - Maintains AES-256-GCM for body encryption
  - Forward secrecy with ephemeral client keys
