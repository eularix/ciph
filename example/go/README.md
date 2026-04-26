# Ciph Go Example — Fiber Backend

Simple REST API backend with Ciph encryption. Works with React frontend.

## Endpoints

All `/api/*` endpoints have encrypted request/response bodies.

### GET /health
Health check (unencrypted).

### GET /api/users
List all users.

**Response:**
```json
{
  "users": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" }
  ],
  "count": 1
}
```

### GET /api/users/:id
Get single user.

**Response:**
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

### POST /api/users
Create user.

**Request (encrypted):**
```json
{
  "name": "Charlie",
  "email": "charlie@example.com"
}
```

**Response:**
```json
{
  "id": 3,
  "name": "Charlie",
  "email": "charlie@example.com"
}
```

### PUT /api/users/:id
Update user (encrypted request/response).

### DELETE /api/users/:id
Delete user (encrypted response).

## Setup

**1. Generate keys:**
```bash
cd example/go
go run cmd/generate-keys/main.go
```

Output:
```
CIPH_PRIVATE_KEY=UPEh_68Fe7YljzZUvyU_ME5N9LQoFa7Laf8Ox41P_NM
CIPH_PUBLIC_KEY=BD-krXaQ80ls0m2I...
```

**2. Create .env:**
```bash
echo "CIPH_PRIVATE_KEY=<from above>" > .env
```

**3. Run backend:**
```bash
cd example/go
go run cmd/main.go
```

Server at: `http://localhost:3001`
DevTools at: `http://localhost:3001/ciph`

**3. Connect React frontend:**

In your React app:
```ts
import { createClient } from '@ciph/client'

const ciph = createClient({
  baseURL: 'http://localhost:3001',
  serverPublicKey: process.env.CIPH_PUBLIC_KEY,
})

// Use like axios
const users = await ciph.get('/api/users')
const newUser = await ciph.post('/api/users', { name: 'Dave', email: 'dave@example.com' })
```

## DevTools

Open `http://localhost:3001/ciph` while making requests to see:
- Decrypted request/response bodies
- Encrypted vs plaintext
- Fingerprint info
- Error codes

## Project Structure

```
example/go/
├── cmd/main.go           (Fiber app + endpoints)
├── internal/fiber_adapter.go (Fiber ↔ Ciph middleware)
├── go.mod
└── README.md
```

## Notes

- Private key never exposed
- Request/response bodies encrypted transparently
- Fingerprint validates device (IP + User-Agent)
- All responses in `/api/*` are encrypted
