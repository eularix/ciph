# @ciph/svelte — Request/Response Flow

## Client Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Component                                                           │
│  await client.post('/api/users', { name: 'Alice' })                │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────────┐
         │ ciphClient Request         │
         │ Interceptor                │
         └────────────┬───────────────┘
                      │
         ┌────────────▼──────────────────┐
         │ Check excludeRoutes           │
         │ /api/users NOT in list → ✓   │
         └────────────┬──────────────────┘
                      │
         ┌────────────▼──────────────────┐
         │ Get or Generate:              │
         │ • Fingerprint (cached)        │
         │ • Key pair (cached)           │
         │ • Session key (cached)        │
         └────────────┬──────────────────┘
                      │
         ┌────────────▼──────────────────────┐
         │ Derive ECDH shared bits:          │
         │  sharedBits = ECDH(              │
         │    clientPrivateKey,             │
         │    serverPublicKey              │
         │  ) → 32 bytes                    │
         └────────────┬──────────────────────┘
                      │
         ┌────────────▼──────────────────────┐
         │ Derive Session Key:               │
         │  sessionKey = HKDF(               │
         │    salt=sharedBits,               │
         │    label="ciph-v2-session"       │
         │  ) → 32 bytes                    │
         └────────────┬──────────────────────┘
                      │
         ┌────────────▼──────────────────┐
         │ Derive Request Key:           │
         │  requestKey = HKDF(           │
         │    salt=hash(fingerprint),    │
         │    ikm=sessionKey,            │
         │    label="ciph-v2-request"   │
         │  ) → 32 bytes                 │
         └────────────┬──────────────────┘
                      │
         ┌────────────▼─────────────────────────┐
         │ Set Headers:                         │
         │  X-Fingerprint: <fingerprint>        │
         │  X-Client-PublicKey: <pubKey>       │
         │  Content-Type: text/plain            │
         │  (+ any default headers)             │
         └────────────┬─────────────────────────┘
                      │
         ┌────────────▼─────────────────────┐
         │ Encrypt Request Body:            │
         │  plaintext = '{"name":"Alice"}'  │
         │                                  │
         │  ciphertext = AES-256-GCM(       │
         │    plaintext,                    │
         │    requestKey                    │
         │  )                               │
         │  = base64url(IV || AuthTag ||    │
         │             EncryptedData)      │
         │  ≈ "rH6s8kL9m2p3...[long]..."  │
         └────────────┬─────────────────────┘
                      │
         ┌────────────▼──────────────────┐
         │ axios.post(                    │
         │   url: '/api/users',           │
         │   data: ciphertext,            │
         │   headers: {...}               │
         │ )                              │
         └────────────┬──────────────────┘
                      │
                      ▼
         ┌────────────────────────────┐
         │ HTTP POST Request           │
         │                            │
         │ Headers:                   │
         │  X-Fingerprint: 0x...      │
         │  X-Client-PublicKey: 0x... │
         │  Content-Type: text/plain  │
         │                            │
         │ Body (raw ciphertext):     │
         │  rH6s8kL9m2p3q4r5...      │
         └────────────┬───────────────┘
                      │
                      ▼
    ┌─────────────────────────────────┐
    │ Network / Server Processing     │
    └────────────┬────────────────────┘
                 │
                 ▼
         ┌────────────────────────┐
         │ HTTP 200 Response      │
         │                        │
         │ Body (encrypted):      │
         │  sL2m3n4o5p6q7r8s9... │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────────────┐
         │ ciphClient Response            │
         │ Interceptor                    │
         └────────────┬────────────────────┘
                      │
         ┌────────────▼────────────────────────┐
         │ Check Status Code                   │
         │ 401 CIPH003 → Retry:                │
         │   • Generate fresh key pair         │
         │   • Generate fresh fingerprint      │
         │   • Keep session key                │
         │   • Retry original request          │
         │                                     │
         │ Otherwise → Continue ✓              │
         └────────────┬────────────────────────┘
                      │
         ┌────────────▼────────────────────────┐
         │ Derive Request Key (same as before):│
         │  requestKey = HKDF(                 │
         │    salt=hash(fingerprint),          │
         │    ikm=sessionKey                   │
         │  )                                  │
         └────────────┬────────────────────────┘
                      │
         ┌────────────▼──────────────────────┐
         │ Decrypt Response Body:            │
         │  plaintext = AES-256-GCM.decrypt( │
         │    ciphertext,                    │
         │    requestKey                     │
         │  )                                │
         │  = '{"id":1,"name":"Alice"}'      │
         └────────────┬──────────────────────┘
                      │
         ┌────────────▼──────────────────┐
         │ Parse JSON:                   │
         │  data = {                     │
         │    id: 1,                     │
         │    name: 'Alice'              │
         │  }                            │
         └────────────┬──────────────────┘
                      │
         ┌────────────▼──────────────────────┐
         │ Emit to DevTools (dev only):      │
         │  method: 'POST'                   │
         │  route: '/api/users'              │
         │  status: 200                      │
         │  encrypted: true                  │
         │  encryptedBody: 'rH6s8kL9...'    │
         │  plainBody: {...}                 │
         │  plainResponse: {...}             │
         │  error: null                      │
         └────────────┬──────────────────────┘
                      │
         ┌────────────▼─────────────────────┐
         │ Return CiphResponse<T>:          │
         │  {                                │
         │    data: { id: 1, name: 'Alice' },│
         │    status: 200,                   │
         │    statusText: 'OK',              │
         │    headers: {...},                │
         │    ciph: {...}                    │
         │  }                                │
         └────────────┬─────────────────────┘
                      │
                      ▼
         ┌──────────────────────────────┐
         │ Component receives plaintext │
         │ res.data = {                │
         │   id: 1,                     │
         │   name: 'Alice'              │
         │  }                            │
         └──────────────────────────────┘
```

## Server Request Flow (SvelteKit Handle Hook)

```
┌──────────────────────────────────────────────────────┐
│ Client sends encrypted POST /api/users               │
│ Headers:                                             │
│  X-Fingerprint: <encrypted-fingerprint-value>       │
│  X-Client-PublicKey: <client-ecdh-public-key>       │
│ Body: <ciphertext>                                   │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
    ┌──────────────────────────────┐
    │ SvelteKit Router             │
    │ (Route handler registered)   │
    └──────┬───────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ ciphHooks() Handler:          │
    │ Phase 1: Pre-Handler          │
    │ (Decrypt Request)             │
    └──────┬───────────────────────┘
           │
    ┌──────▼───────────────────────┐
    │ Check excludeRoutes:          │
    │ /api/users NOT excluded → ✓   │
    └──────┬───────────────────────┘
           │
    ┌──────▼───────────────────────────────┐
    │ Validate Headers:                    │
    │  X-Fingerprint: present? ✓           │
    │  X-Client-PublicKey: present? ✓      │
    │                                     │
    │ (CIPH001 error if missing)           │
    └──────┬───────────────────────────────┘
           │
    ┌──────▼───────────────────────────────┐
    │ Derive ECDH Shared Bits:             │
    │  sharedBits = ECDH(                  │
    │    serverPrivateKey,                 │
    │    clientPublicKey                   │
    │  ) → 32 bytes                        │
    │                                     │
    │ (CIPH002 error if fails)             │
    └──────┬───────────────────────────────┘
           │
    ┌──────▼───────────────────────────────┐
    │ Derive Session Key:                  │
    │  sessionKey = HKDF(                  │
    │    salt=sharedBits,                  │
    │    label="ciph-v2-session"          │
    │  ) → 32 bytes                        │
    └──────┬───────────────────────────────┘
           │
    ┌──────▼───────────────────────────────┐
    │ Hash Fingerprint:                    │
    │  fingerprintHash = SHA-256(          │
    │    encryptedFingerprint              │
    │  )                                   │
    └──────┬───────────────────────────────┘
           │
    ┌──────▼────────────────────────────┐
    │ Derive Request Key:                │
    │  requestKey = HKDF(                │
    │    salt=fingerprintHash,           │
    │    ikm=sessionKey,                 │
    │    label="ciph-v2-request"        │
    │  ) → 32 bytes                      │
    └──────┬────────────────────────────┘
           │
    ┌──────▼────────────────────────────────┐
    │ Decrypt Request Body:                 │
    │  plaintext = AES-256-GCM.decrypt(   │
    │    ciphertext,                       │
    │    requestKey                        │
    │  )                                   │
    │  = '{"name":"Bob"}'                  │
    │                                     │
    │ (CIPH004 error if fails)             │
    └──────┬────────────────────────────────┘
           │
    ┌──────▼────────────────────────────────┐
    │ Inject plaintext into RequestEvent:  │
    │  event.request.body = plaintext     │
    └──────┬────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────┐
    │ Call resolve(event):             │
    │ Your route handler receives:     │
    │  POST /api/users                 │
    │  body: { name: 'Bob' }           │
    │                                  │
    │ Handler logic runs...            │
    │ Returns: { id: 2, name: 'Bob' } │
    └──────┬───────────────────────────┘
           │
           ▼
    ┌────────────────────────────────┐
    │ Phase 2: Post-Handler          │
    │ (Encrypt Response)             │
    └──────┬───────────────────────────┘
           │
    ┌──────▼────────────────────────┐
    │ Get Response Body:             │
    │  plainBody = '{"id":2,         │
    │              "name":"Bob"}'    │
    └──────┬────────────────────────┘
           │
    ┌──────▼───────────────────────────┐
    │ Derive Request Key (same as req): │
    │  requestKey = HKDF(               │
    │    salt=fingerprintHash,          │
    │    ikm=sessionKey                 │
    │  )                                │
    └──────┬───────────────────────────┘
           │
    ┌──────▼────────────────────────────┐
    │ Encrypt Response:                 │
    │  ciphertext = AES-256-GCM(        │
    │    plaintext,                     │
    │    requestKey                     │
    │  )                                │
    │  = base64url(...)                 │
    │                                   │
    │ (CIPH006 error if fails)          │
    └──────┬────────────────────────────┘
           │
    ┌──────▼────────────────────────────────┐
    │ Emit Log to DevTools (dev only):      │
    │  method: 'POST'                      │
    │  route: '/api/users'                 │
    │  status: 200                         │
    │  encrypted: true                     │
    │  plainRequestBody: { name: 'Bob' }   │
    │  plainResponseBody: { id: 2, ... }   │
    │  error: null                         │
    └──────┬────────────────────────────────┘
           │
    ┌──────▼─────────────────────────┐
    │ Return Response:                │
    │  status: 200                    │
    │  body: <encrypted-ciphertext>   │
    │  headers:                       │
    │    Content-Type: text/plain     │
    └──────┬─────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────┐
    │ HTTP 200 Response                │
    │                                  │
    │ Headers:                         │
    │  Content-Type: text/plain        │
    │                                  │
    │ Body (encrypted):                │
    │  sL2m3n4o5p6q7r8s9t0u1v2w3... │
    └──────┬───────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────┐
    │ Client Response Interceptor      │
    │ (see Client Response Flow above) │
    └──────────────────────────────────┘
```

## Key Derivation Timeline

```
┌─────────────────────────────────────────┐
│ First Request (Tab Lifetime)            │
├─────────────────────────────────────────┤
│                                         │
│ 1. Generate Key Pair (CLIENT)           │
│    + Cached for tab lifetime            │
│    + Ephemeral (new pair on CIPH003)   │
│                                         │
│ 2. Generate Fingerprint                 │
│    + User-Agent + Screen + Timezone     │
│    + Cached for tab lifetime            │
│    + Fresh on CIPH003 retry             │
│                                         │
│ 3. ECDH Derivation                      │
│    ClientPriv + ServerPub → Shared 256 bits
│    Derived once, cached                 │
│                                         │
│ 4. HKDF Session Key                     │
│    HKDF(shared, "session") → 32 bytes  │
│    Cached, same for all matching pairs │
│                                         │
│ 5. HKDF Request Key                     │
│    HKDF(session, salt=hash(fp)) → 32   │
│    Different for each fingerprint      │
│    Used for encrypt/decrypt            │
│                                         │
└─────────────────────────────────────────┘
```

## Error Recovery Flow (CIPH003)

```
Client sends request with old fingerprint
    │
    ▼
Server detects IP/UA mismatch → 401 CIPH003
    │
    ▼
Client Response Interceptor
    │
    ├─ Check: 401 + CIPH003 + onFingerprintMismatch='retry' + !_ciphRetried
    │
    ▼ YES
Reset: cachedKeyPair = null, cachedFingerprint = null
Keep:  cachedSessionKey (same ECDH derivation)
    │
    ▼
Retry original request
    │
    ├─ Generate fresh key pair
    ├─ Generate fresh fingerprint
    ├─ Derive request key (new fingerprint hash + same session key)
    ├─ Encrypt body again
    │
    ▼
Send request
    │
    ▼
Server validates new fingerprint → 200 OK
    │
    ▼
Decrypt response
    │
    ▼
Return to component
```
