Run bun run test:coverage --filter=!./example/*
$ turbo test:coverage "--filter=!./example/*"

Attention:
Turborepo now collects completely anonymous telemetry regarding usage.
This information is used to shape the Turborepo roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://turborepo.dev/docs/telemetry


   • Packages in scope: @ciph/client, @ciph/core, @ciph/devtools-client, @ciph/devtools-server, @ciph/hono, @ciph/react, @ciph/vue, docs
   • Running test:coverage in 8 packages
   • Remote caching enabled

docs:test:coverage
@ciph/core:build
@ciph/core:test:coverage
[Ciph] Log emitted: GET /ping → OK

stdout | src/__tests__/hono.test.ts > @ciph/hono > Excluded route: /health passes through plain
[Ciph] Log emitted: GET /health → OK

stdout | src/__tests__/hono.test.ts > @ciph/hono > CIPH001: missing X-Fingerprint returns 401
[Ciph] Log emitted: GET /secure → CIPH001

stdout | src/__tests__/hono.test.ts > @ciph/hono > CIPH002: invalid encrypted fingerprint returns 401
[Ciph] Log emitted: GET /secure → CIPH002

stdout | src/__tests__/hono.test.ts > @ciph/hono > CIPH003: fingerprint IP mismatch returns 401
[Ciph] Log emitted: GET /secure → CIPH003

stdout | src/__tests__/hono.test.ts > @ciph/hono > CIPH004: undecryptable body returns 400
[Ciph] Log emitted: POST /secure → CIPH004

stdout | src/__tests__/hono.test.ts > @ciph/hono > CIPH005: payload exceeds max size returns 413
[Ciph] Log emitted: POST /secure → CIPH005

stdout | src/__tests__/hono.test.ts > @ciph/hono > CIPH006: response encryption failure returns 500
[Ciph] Log emitted: GET /secure → CIPH006

stdout | src/__tests__/hono.test.ts > @ciph/hono > strictFingerprint false skips IP mismatch check
[Ciph] Log emitted: GET /secure → OK

stdout | src/__tests__/hono.test.ts > @ciph/hono > allowUnencrypted true allows request without X-Fingerprint
[Ciph] Log emitted: GET /open → OK

stderr | src/__tests__/hono.test.ts > @ciph/hono > Interop test: encrypt with @ciph/client and decrypt in @ciph/hono
stdout | src/__tests__/hono.test.ts > @ciph/hono > devtools emission emits CiphServerLog payload in development
[Ciph] Log emitted: GET /secure → OK

[ciph] Using deprecated v1 (symmetric) mode. Migrate to v2 by providing 'serverPublicKey' or 'publicKeyEndpoint' in config.

stdout | src/__tests__/hono.test.ts > @ciph/hono > Interop test: encrypt with @ciph/client and decrypt in @ciph/hono
[Ciph] Log emitted: POST /interop → OK

 ❯ src/__tests__/hono.test.ts (14 tests | 2 failed) 162ms
   × @ciph/hono > Happy path POST: decrypts encrypted request and encrypts response 14ms
     → globalThis.ciphServerEmitter?.on is not a function
   × @ciph/hono > Happy path GET: validates fingerprint and encrypts response 44ms
     → The operation failed for an operation-specific reason

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/__tests__/hono.test.ts > @ciph/hono > Happy path POST: decrypts encrypted request and encrypts response
TypeError: globalThis.ciphServerEmitter?.on is not a function
 ❯ Module.initDevtools src/devtools.ts:118:33
    116|   }
    117| 
    118|   globalThis.ciphServerEmitter?.on("log", (log) => {
       |                                 ^
    119|     // Add to in-memory circular buffer
    120|     _logs.unshift(log)
 ❯ Module.ciph src/index.ts:517:5
 ❯ src/__tests__/hono.test.ts:98:18

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/__tests__/hono.test.ts > @ciph/hono > Happy path GET: validates fingerprint and encrypts response
OperationError: The operation failed for an operation-specific reason
Caused by: Error: Cipher job failed
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

 Test Files  1 failed (1)
      Tests  2 failed | 12 passed (14)
   Start at  09:31:02
   Duration  888ms (transform 161ms, setup 0ms, collect 291ms, tests 162ms, environment 0ms, prepare 72ms)


Error: TypeError: globalThis.ciphServerEmitter?.on is not a function
 ❯ Module.initDevtools src/devtools.ts:118:33
 ❯ Module.ciph src/index.ts:517:5
 ❯ src/__tests__/hono.test.ts:98:18


error: script "test:coverage" exited with code 1
Error: @ciph/hono#test:coverage: command (/home/runner/work/ciph/ciph/packages/hono) /home/runner/.bun/bin/bun run test:coverage exited (1)
 ERROR  @ciph/hono#test:coverage: command (/home/runner/work/ciph/ciph/packages/hono) /home/runner/.bun/bin/bun run test:coverage exited (1)
 ERROR  run failed: command  exited (1)
error: script "test:coverage" exited with code 1

 Tasks:    9 successful, 10 total
Cached:    9 cached, 10 total
  Time:    2.126s 
Failed:    @ciph/hono#test:coverage

Error: Process completed with exit code 1.