# @ciph/core

> Isomorphic cryptographic core for the Ciph encryption library.

## What is this?

`@ciph/core` is the **foundational package** of the Ciph ecosystem. It provides all cryptographic primitives used by every other Ciph package:

- AES-256-GCM encryption & decryption
- Device fingerprint generation & validation
- Fingerprint-bound key derivation

This package is **not meant to be used directly** by end-users. It is a dependency of `@ciph/client`, `@ciph/hono`, `@ciph/express`, and all other Ciph adapters.

## Position in Ciph Ecosystem

```
@ciph/client  @ciph/hono  @ciph/express  @ciph/fetch
       \           |           |           /
        \          |           |          /
         \         |           |         /
          \        |           |        /
                @ciph/core
          (all crypto primitives live here)
```

## Runtime Support

| Runtime       | Engine Used         | Notes                          |
|---------------|---------------------|-------------------------------|
| Browser       | Web Crypto API      | Hardware-accelerated, built-in |
| Node.js       | `node:crypto`       | Built-in, no extra deps        |
| Bun / Deno    | Web Crypto API      | Natively supported             |

## Zero External Dependencies

`@ciph/core` has **zero runtime dependencies**. It relies only on:
- `Web Crypto API` (browser / Bun / Deno)
- `node:crypto` (Node.js built-in)

## What This Package Does NOT Do

- Does not handle HTTP requests or responses
- Does not implement any middleware
- Does not manage sessions or tokens
- Does not replace TLS/HTTPS
