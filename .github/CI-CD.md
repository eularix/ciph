# CI/CD Documentation

## Overview

Ciph uses a sophisticated multi-package CI/CD pipeline with independent versioning and publishing for each package via **Changesets** and **Turborepo**.

### Packages

- `@ciph/core` - Core crypto primitives
- `@ciph/client` - Frontend HTTP client
- `@ciph/hono` - Hono middleware
- `@ciph/react` - React wrapper
- `@ciph/devtools-client` - Browser devtools panel
- `@ciph/devtools-server` - Backend inspector UI

## GitHub Actions Workflows

### CI Workflow (`.github/workflows/ci.yml`)

Runs on every **push to main** and **pull requests**.

#### Jobs

| Job | Purpose | Trigger |
|-----|---------|---------|
| **quality** | ESLint, TypeScript strict checks | Always |
| **test** | Vitest coverage for all packages | Always |
| **build** | Turbo build with per-package verification | Always |
| **changeset** | Validates changesets on PRs | PRs only |

**Status checks required:** All jobs must pass before merging.

### Release Workflow (`.github/workflows/release.yml`)

Runs when changesets are merged to main.

#### Jobs

| Job | Purpose |
|-----|---------|
| **version** | Creates/updates version bump PR via changesets |
| **publish** | Publishes updated packages to npm |

**Permissions:**
- `contents: write` - Create release commits
- `pull-requests: write` - Create version PRs

---

## Adding Changes (For Contributors)

### Step 1: Create Changeset

When your PR merges, create a changeset describing the changes:

```bash
# Interactive mode (recommended)
pnpm changeset

# Or direct mode
pnpm changeset add --packages @ciph/core --type minor --message "Your change"
```

### Step 2: Select Packages & Bump Type

```
? Which packages would you like to include? (space to select)
 ◉ @ciph/core
 ◉ @ciph/client
 ○ @ciph/hono
 ○ @ciph/react

? What kind of change is this for @ciph/core? (Use arrow keys)
 ▸ patch (bug fix)
   minor (feature)
   major (breaking)
```

### Step 3: Commit & Push

```bash
git add .changeset/
git commit -m "chore: add changeset for v2 ECDH"
git push
```

This creates a file like `.changeset/add-v2-ecdh.md`:

```markdown
---
"@ciph/core": minor
"@ciph/client": minor
"@ciph/hono": minor
---

Implement ECDH v2 asymmetric encryption for enhanced security
```

### Step 4: PR Validation

CI will check:
- ✅ All tests pass
- ✅ All packages build
- ✅ Changeset format is valid (auto-comment if missing)

### Step 5: Merge

Once approved, merge the PR with changesets included.

---

## Automatic Release Process

### What Happens After Merge

1. **Detect changesets** → Version bump PR created automatically
2. **Version bump PR** → Lists all affected packages and bumps
3. **Merge version PR** → Triggers publish workflow
4. **Publish to npm** → Each package published with new version
5. **Create releases** → GitHub releases created per package

### Example

```
Before:
  @ciph/core: 0.1.0
  @ciph/hono: 0.2.1

Changeset merged (minor bump to core):
  ↓ changeset detects changes

Auto-created Version PR:
  @ciph/core: 0.1.0 → 0.2.0 (minor)
  @ciph/hono: 0.2.1 → 0.2.2 (patch - auto-bumped due to dependency)

Merge version PR:
  ↓ triggers publish workflow

Published to npm:
  ✅ @ciph/core@0.2.0
  ✅ @ciph/hono@0.2.2

GitHub releases created:
  ✅ Release: @ciph/core@0.2.0
  ✅ Release: @ciph/hono@0.2.2
```

---

## Adding a New Package

To add a new package to the Ciph monorepo:

### 1. Create Package Directory

```bash
mkdir -p packages/my-package
cd packages/my-package
```

### 2. Create `package.json`

```json
{
  "name": "@ciph/my-package",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "dev": "tsup src/index.ts --watch --dts",
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  },
  "publishConfig": {
    "access": "public"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "workspace:*",
    "tsup": "workspace:*",
    "vitest": "workspace:*"
  }
}
```

### 3. Create TypeScript Config

Create `packages/my-package/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules"]
}
```

### 4. Create Build Config

Create `packages/my-package/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
})
```

### 5. Create Source Files

```bash
mkdir -p packages/my-package/src
# Add index.ts, etc.
```

### 6. Verify

```bash
pnpm install
pnpm build
pnpm test
```

**That's it!** The package will automatically be included in CI/CD. Once you merge changes:

1. ✅ CI tests all packages
2. ✅ CI builds your new package
3. ✅ When changesets are added, your package can be versioned
4. ✅ Release workflow publishes it to npm

---

## Troubleshooting

### "Changeset validation failed"

**Problem:** PR shows warning about missing changesets (but doesn't fail CI)

**Solution:**
```bash
pnpm changeset
# Select affected packages
# Commit and push
```

### "Build failed for @ciph/my-package"

**Check:**
1. Does `packages/my-package/tsup.config.ts` exist?
2. Does `src/index.ts` exist?
3. Does it have a `build` script in `package.json`?

```bash
cd packages/my-package
pnpm build
```

### "Package not published"

**Check:**
1. Changeset included the package? (`pnpm changeset status`)
2. Version PR created? (Check GitHub PRs)
3. NPM_TOKEN set in GitHub Secrets?

### Test/type-check failures

Run locally to debug:
```bash
pnpm test
pnpm type-check
pnpm lint
```

---

## Environment Variables (GitHub Secrets)

Required secrets in GitHub repository settings:

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | Publishing to npm registry |
| `GITHUB_TOKEN` | Creating releases (auto-provided) |
| `TURBO_TOKEN` | (Optional) Turbo caching |
| `TURBO_TEAM` | (Optional) Turbo team |

---

## References

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
