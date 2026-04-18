# CI/CD Architecture

## Workflow Files

### `.github/workflows/ci.yml`
Runs on every push to `main` or `dev`, and all PRs.

**Jobs:**
- `quality` — ESLint, TypeScript strict checks
- `test` — Vitest with coverage
- `build` — Turbo build, verify dist/ exists

No version bumping. No publishing. Pure validation.

---

### `.github/workflows/beta-release.yml`
**Trigger:** Push to `dev` branch, paths: `packages/**`, `pnpm-lock.yaml`, `.github/workflows/beta-release.yml`

**Jobs:**

#### 1. `detect-and-bump`
```
Input: git log -1 --pretty=%B (latest commit message)
Input: git diff origin/main...HEAD (file changes)
Output: directories, packages, has-changes
```

Steps:
1. Run `scripts/detect-changed-packages.js origin/main`
   - Compare dev vs main
   - Find which `packages/*/` changed
   - Return `{ directories: ["react", "hono"], packages: ["@ciph/react", "@ciph/hono"] }`

2. Parse commit message → extract `release: minor/major/patch`
   - Default: `minor`

3. For each changed package:
   - Read `package.json` version (e.g., "0.1.4")
   - Call `bump-beta-versions.js` with commit type
   - Calculate new version:
     - `minor`: `0.1.4` → `0.2.0-beta.1`
     - `major`: `0.1.4` → `1.0.0-beta.1`
     - `patch`: `0.1.4` → `0.1.5-beta.1`
   - Update `packages/*/package.json`

4. Commit with message: `"chore: bump beta versions for dev release"`

5. Push to dev

#### 2. `beta-publish`
**Depends on:** `detect-and-bump`
**If:** `has-changes == 'true'`

Steps:
1. Checkout latest (includes bumped versions)
2. `pnpm install --frozen-lockfile`
3. `pnpm turbo build`
4. For each changed package:
   - Publish to npm with `--tag beta`
   - npm registry: `@ciph/react@0.2.0-beta.1` gets `beta` tag

5. Create git tags:
   - Format: `beta-@ciph/react-0.2.0-beta.1`
   - Push tags to origin

6. npm tags now visible:
   ```bash
   npm dist-tag ls @ciph/react
   # 0.2.0-beta.1: beta
   # 0.1.4: latest
   ```

---

### `.github/workflows/stable-release.yml`
**Trigger:** Push to `main` branch, paths: `packages/**`, `pnpm-lock.yaml`, `.github/workflows/stable-release.yml`

**Jobs:**

#### 1. `detect-and-promote`
```
Input: git diff <last-stable>...HEAD
Output: directories, packages, has-changes
```

Steps:
1. Find last stable release commit:
   ```bash
   git log --oneline main | grep -v "chore: bump stable versions" | head -1
   ```
   (Excludes bot commits, gets actual package changes)

2. Run `scripts/detect-changed-packages.js <last-stable-sha>`
   - Return changed package directories

3. For each changed package:
   - Read version (e.g., "0.2.0-beta.1")
   - Strip `-beta.X` → "0.2.0"
   - Update `package.json`

4. Update inter-package dependencies:
   - If `@ciph/react@0.2.0` changed, update all packages that depend on it
   - Check `dependencies`, `devDependencies`, `peerDependencies`
   - Set new version (e.g., `"@ciph/react": "0.2.0"`)

5. Generate `CHANGELOG.md` per package:
   ```
   packages/react/CHANGELOG.md
   packages/hono/CHANGELOG.md
   ```
   Format:
   ```markdown
   # Changelog

   ## [0.2.0] - 2026-04-18

   ### Added
   - New feature

   ### Fixed
   - Bug fix
   ```
   (User can edit before merge, or auto-generated on first release)

6. Commit:
   - `"chore: promote beta versions to stable for main release"`
   - `"chore: update changelogs for stable release"`

7. Push to main

#### 2. `publish-stable`
**Depends on:** `detect-and-promote`
**If:** `has-changes == 'true'`

Steps:
1. Checkout latest (includes promoted versions + changelogs)
2. `pnpm install --frozen-lockfile`
3. `pnpm turbo build`
4. For each changed package:
   - Publish to npm with `--tag latest`

5. Create git tags:
   - Format: `react-v0.2.0`, `hono-v0.2.0`
   - Push tags

6. Create GitHub releases:
   - Per package
   - Tag: `react-v0.2.0`
   - Title: `@ciph/react v0.2.0`
   - Body: First 20 lines of CHANGELOG.md
   - Uses `actions/github-script@v7` with GitHub API

7. Generate step summary:
   ```
   ## 📦 Release Summary

   ### Published Packages
   - `@ciph/react@0.2.0`
   - `@ciph/hono@0.2.0`
   ```

---

## Scripts

### `scripts/detect-changed-packages.js`
**Input:** `baseBranch` (default: `origin/main`)
**Output:** JSON
```json
{
  "directories": ["react", "hono"],
  "packages": ["@ciph/react", "@ciph/hono"]
}
```

**Logic:**
1. `git diff --name-only <baseBranch>...HEAD`
2. Regex match: `packages/([^/]+)/`
3. Return unique directories + corresponding package names from `package.json`

**Error handling:** Returns `[]` if no commits or diff fails

---

### `scripts/bump-beta-versions.js`
**Input:** JSON array of directories
**Example:** `["react", "hono"]`

**Logic:**
1. Parse commit message: `git log -1 --pretty=%B`
   - Extract: `release: minor/major/patch` (default: `minor`)

2. For each directory:
   - Read `packages/<dir>/package.json` → `version` (e.g., "0.1.4")
   - Parse version regex: `/(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?/`
   - Bump according to type:
     ```javascript
     if (major) newVersion = `${v.major+1}.0.0-beta.1`
     if (minor) newVersion = `${v.major}.${v.minor+1}.0-beta.1`
     if (patch) newVersion = `${v.major}.${v.minor}.${v.patch+1}-beta.1`
     ```
   - Write back to `package.json`

3. Log each bump

**Error handling:** Throw if version regex fails

---

### `scripts/bump-stable-versions.js`
**Input:** JSON array of directories

**Logic:**
1. For each directory:
   - Read `package.json` → `version` (e.g., "0.2.0-beta.1")
   - Strip `-beta.X`: "0.2.0"
   - Write back to `package.json`

2. Build dependency map:
   ```javascript
   versionMap = {
     "@ciph/react": "0.2.0",
     "@ciph/hono": "0.2.0"
   }
   ```

3. For every package in `packages/`:
   - Read `package.json`
   - Check `dependencies`, `devDependencies`, `peerDependencies`
   - If any key matches map, update to new version

4. Log each update

**Why:** Ensures internal dependencies stay in sync (e.g., if `@ciph/client` depends on `@ciph/core`, both get same version).

---

## Version Scheme

### Beta (dev)
- Format: `{major}.{minor}.{patch}-beta.{n}`
- Example: `0.2.0-beta.1`, `0.2.0-beta.2`
- When to bump beta.n: Not implemented (just resets to beta.1 each time)
- Tag: `@scope/name@{version}` with npm tag `beta`

### Stable (main)
- Format: `{major}.{minor}.{patch}`
- Example: `0.2.0`, `1.0.0`
- Semver: major breaking, minor feature, patch bugfix
- Tag: `@scope/name@{version}` with npm tag `latest`

---

## Git Workflow

```
feature branch (local)
    ↓ PR → code review
    ↓ merge to dev
    ↓ triggers: beta-release.yml
    ├─ detect changes
    ├─ bump versions → 0.2.0-beta.1
    ├─ commit version changes
    ├─ publish to npm (beta tag)
    └─ create git tag: beta-@ciph/react-0.2.0-beta.1
    
dev branch (tested)
    ↓ PR → final review
    ↓ merge to main
    ↓ triggers: stable-release.yml
    ├─ detect changes
    ├─ promote versions → 0.2.0
    ├─ generate changelogs
    ├─ commit versions + changelogs
    ├─ publish to npm (latest tag)
    ├─ create git tags: react-v0.2.0
    └─ create GitHub releases

main branch (production)
```

---

## npm Registry State

After all workflows complete:

```bash
npm view @ciph/react versions --json
[
  "0.1.4",
  "0.2.0-beta.1",
  "0.2.0"
]

npm dist-tag ls @ciph/react
0.2.0: latest
0.2.0-beta.1: beta

npm install @ciph/react          # gets 0.2.0
npm install @ciph/react@beta     # gets 0.2.0-beta.1
npm install @ciph/react@0.2.0-beta.1  # specific
```

---

## Permissions

Required GitHub Secrets:
- `NPM_TOKEN` — npm publish
- `TURBO_TOKEN` (optional) — Turbo caching
- `TURBO_TEAM` (optional) — Turbo team

Required GitHub Permissions:
- `contents: write` — Commit, tag, push
- `pull-requests: write` — Create PRs (not used currently)

---

## Edge Cases

### 1. Multiple packages changed in one commit
✅ **Handled:** All bump together (same type) to same beta/stable version

### 2. No packages changed (docs-only commit)
✅ **Handled:** `has-changes: false` → workflows skip

### 3. Conflict between feature branch and bot commits
⚠️ **Potential issue:** If user merges dev→main before bot finishes, git conflict. Solution: Wait for bot commits, or manually resolve.

### 4. Package A depends on Package B, both changed
✅ **Handled:** `bump-stable-versions.js` updates dependencies after promoting versions

### 5. User edits version manually before commit
❌ **Not handled:** Scripts assume `package.json` versions are source of truth. If user edits, scripts might calculate wrong bump.

---

## Debugging

### Check what changed:
```bash
git diff origin/main...HEAD --name-only | grep "^packages/"
```

### Check commit message:
```bash
git log -1 --pretty=%B
```

### Test detect script locally:
```bash
node scripts/detect-changed-packages.js origin/main
```

### Test bump script locally (dry run):
```bash
# Don't actually run, but inspect what would happen
node scripts/bump-beta-versions.js '["react"]'
```

### View workflow runs:
GitHub → Actions → Filter by branch (dev or main)

### Check npm tags live:
```bash
npm dist-tag ls @ciph/react
npm view @ciph/react@beta
```

---

## Future Improvements

1. **Beta iteration:** Detect if version already has `-beta.X`, bump to beta.2, beta.3, etc.
   - Currently: Always resets to beta.1
   - Would need: Check existing npm versions before bumping

2. **Manual changelog:** Allow user to edit CHANGELOG.md before merge
   - Currently: Auto-generated, user can only edit on main
   - Improvement: Generate on dev, let user refine before merging to main

3. **Dependency resolution:** Handle external dependencies (non-@ciph packages)
   - Currently: Only updates @ciph/* inter-package deps
   - Improvement: Support pinning external deps to compatible ranges

4. **Release notes:** Generate from commit logs instead of CHANGELOG
   - Currently: Static CHANGELOG
   - Improvement: Parse conventional commits, auto-generate release notes

5. **Rollback:** Easy way to unpublish/revert stable release
   - Currently: Manual process
   - Improvement: Automated rollback script
