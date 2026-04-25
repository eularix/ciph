# Ciph + Next.js Example

Fullstack encrypted HTTP communication using @ciph/nextjs.

## Quick Start

```bash
# Install dependencies
bun install

# Run dev server
bun run dev
```

Open http://localhost:3000

## How It Works

**Frontend** (`app/page.tsx`):
- Wraps app with `<CiphProvider>`
- Uses `useCiph()` hook for `ciph.get()` / `ciph.post()`
- All requests encrypted automatically

**Backend** (`app/api/`):
- Uses `ciphHandler()` middleware wrapper
- Receives decrypted body in `ctx.ciphDecryptedJson`
- Response automatically encrypted

**Shared Secret**: `.env.local` has `CIPH_SECRET` (32+ chars)

## Test It

1. Click "Send Encrypted Message" → POST `/api/echo` (encrypted roundtrip)
2. Click "Fetch Encrypted Data" → GET `/api/employees` (encrypted response)
3. Open DevTools Network tab → see ciphertext in body (not readable)
4. App receives plain JSON after decryption

## What's Encrypted

- Request bodies (POST/PUT/PATCH)
- Response bodies (JSON)
- Fingerprint (device ID derived from UA + screen + timezone)

## Zero Config Change

No manual encrypt/decrypt in app code. Transparent middleware handles all encryption automatically.

## Learn More

- [@ciph/nextjs docs](../../packages/next)
- [@ciph/core](../../packages/core) - crypto primitives
- [@ciph/react](../../packages/react) - frontend hooks
