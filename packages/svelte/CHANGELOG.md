# @ciph/svelte — Changelog

## 2.0.0 — Initial Release

### Features

#### Client (`ciphClient`)
- ✓ Svelte stores for reactive state (`fingerprintStore`, `errorStore`, `isEncryptingStore`)
- ✓ Transparent HTTP encryption via axios interceptors
- ✓ ECDH v2 (P-256) asymmetric key exchange
- ✓ AES-256-GCM symmetric encryption
- ✓ Device fingerprinting with configurable components (User-Agent, screen, timezone, custom fields)
- ✓ Per-device key derivation via HKDF
- ✓ Automatic fingerprint caching (tab lifetime)
- ✓ Per-request encryption override (`encrypt?: boolean`)
- ✓ Per-request fingerprint fields override
- ✓ Auto-retry on fingerprint mismatch (CIPH003)
- ✓ Fallback to plaintext on encryption failure (configurable)
- ✓ Configurable route exclusion
- ✓ Dev-only devtools logging

#### Server (`ciphHooks`)
- ✓ SvelteKit `handle()` hook integration
- ✓ Phase-based middleware (pre-handler decrypt, post-handler encrypt)
- ✓ Request body decryption for POST/PUT/PATCH
- ✓ Response body encryption (all methods)
- ✓ ECDH v2 support (server-side static key pair)
- ✓ Fingerprint validation
- ✓ Payload size limits
- ✓ Configurable route exclusion
- ✓ Dev-only devtools logging
- ✓ Error responses with standardized codes (CIPH001-006)
- ✓ Public key endpoint helper (`ciphPublicKeyEndpoint`)

#### DevTools
- ✓ Floating, draggable panel (Svelte component)
- ✓ Log list with filtering (method, route, status, time, encryption flag)
- ✓ Detail view (plain bodies, encrypted bodies, errors)
- ✓ Keyboard shortcut toggle (Ctrl+Shift+C)
- ✓ Circular buffer (max logs configurable)
- ✓ Position presets (bottom-right, bottom-left, top-right, top-left)
- ✓ Production guard (auto-disabled, tree-shaken)
- ✓ Custom logging API (`emitClientLog`, `emitServerLog`)

### Types
- ✓ Full TypeScript support (strict mode)
- ✓ Exported types: `CiphClient`, `CiphResponse`, `CiphClientConfig`, `CiphSvelteKitConfig`
- ✓ Exported error types: `CiphError`, `CiphErrorCode`
- ✓ Generic response typing: `CiphResponse<T>`

### Documentation
- ✓ README.md — Quick start guide
- ✓ OVERVIEW.md — Architecture and design principles
- ✓ API.md — Complete API reference
- ✓ FLOW.md — Request/response flow diagrams
- ✓ DEVTOOLS.md — DevTools setup and usage
- ✓ FINGERPRINT.md — Fingerprint generation and validation
- ✓ CHANGELOG.md — Release notes (this file)

### Build
- ✓ tsup configuration (ESM + CJS output)
- ✓ TypeScript declaration files
- ✓ Source maps for debugging
- ✓ Strict TypeScript config

### Compatibility
- ✓ Svelte 4.x
- ✓ SvelteKit 2.x
- ✓ Node.js 18+
- ✓ All modern browsers (Web Crypto API)

### Known Limitations
- ✓ WebSockets not encrypted (v1)
- ✓ File uploads not encrypted (v1)
- ✓ No built-in session management (use standard auth)
- ✓ Fingerprint IP validation not yet implemented (v2)

### Breaking Changes
None (first release)

### Dependencies
- `axios` ^1.0.0
- `@ciph/core` 2.0.0
- `svelte` ^4.0.0
- `@sveltejs/kit` ^2.0.0

### Development Dependencies
- TypeScript ^5.0.0
- tsup ^8.0.0
- svelte-check ^3.0.0

---

## Future Roadmap

### v2.1.0 (Planned)
- [ ] IP validation in fingerprint (per-network binding)
- [ ] BroadcastChannel sync (fingerprint sync across tabs)
- [ ] Built-in request caching
- [ ] Optimistic response handling

### v2.2.0 (Planned)
- [ ] WebSocket encryption (requires core update)
- [ ] File upload/download encryption
- [ ] Batch request encryption
- [ ] Response streaming support

### v3.0.0 (Planned)
- [ ] Rust/WASM crypto backend (napi-rs integration)
- [ ] Hardware-backed key storage (WebAuthn)
- [ ] Perfect forward secrecy (PFS) with ephemeral keys

---

## Migration Guide

N/A (first release)

---

## Support

For issues, questions, or feature requests, please open an issue on GitHub or contact the Ciph team.

Version: 2.0.0
Release Date: 2024-01-XX
License: MIT
