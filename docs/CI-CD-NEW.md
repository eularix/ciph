# CI/CD Guide — Automatic Versioning

> Commit-message driven releases. feature → dev (beta) → main (stable).

## Overview

No manual changesets. Version bumps determined by commit message on merge.

```
feature branch
    ↓ (merge with "release: minor/major")
dev branch
    ├─ Workflow: Auto beta release (0.1.4-beta.1)
    ├─ Published to npm with beta tag
    └─ Git tag: beta-@ciph/react-0.1.4-beta.1
    ↓ (merge after testing)
main branch
    ├─ Workflow: Promote beta → stable (0.1.4)
    ├─ Generate CHANGELOG per package
    ├─ Published to npm with latest tag
    └─ Git tags: react-v0.1.4, hono-v0.1.4, etc
    └─ GitHub releases created
```

## Branch Flow

### 1. Feature → Dev (Create Beta Release)

**Merge PR into dev with message containing `release: minor` or `release: major`:**

```bash
git commit -m "feat: add new encryption method

release: minor"
# or
git commit -m "feat: breaking change

release: major"
```

**What happens:**
1. `.github/workflows/beta-release.yml` triggers
2. Detects changed packages (files under `packages/*/`)
3. Parses commit message for `release: minor/major`
4. Bumps **only changed packages** to beta version:
   - `release: minor` → 0.1.4 → 0.2.0-beta.1
   - `release: major` → 0.1.4 → 1.0.0-beta.1
   - `release: patch` → 0.1.4 → 0.1.5-beta.1 (default)
5. Commits version changes to dev
6. Builds all packages
7. Publishes **only changed packages** to npm with `beta` tag
8. Creates git tag: `beta-@ciph/core-0.2.0-beta.1`

**Example (only @ciph/react changed):**
```
Before: @ciph/react@0.1.4, @ciph/core@0.1.4
Commit: "release: minor"
After:  @ciph/react@0.2.0-beta.1, @ciph/core@0.1.4 (unchanged)
Published: npm install @ciph/react@0.2.0-beta.1 --tag beta
```

### 2. Dev → Main (Create Stable Release)

**Merge dev into main after testing beta version.**

**What happens:**
1. `.github/workflows/stable-release.yml` triggers
2. Detects changed packages since last stable release
3. Promotes versions: `0.2.0-beta.1` → `0.2.0` (removes `-beta.X`)
4. Updates inter-package dependencies (if @ciph/core changed, @ciph/client dependency updated)
5. Generates/updates `CHANGELOG.md` per package
6. Commits version promotions and changelogs to main
7. Builds all packages
8. Publishes **only changed packages** to npm with `latest` tag
9. Creates git tags: `react-v0.2.0`, `core-v0.2.0`, etc.
10. Creates GitHub releases per package

**Example:**
```
Before main: @ciph/react@0.2.0-beta.1, @ciph/core@0.1.4
Promote:     @ciph/react@0.2.0, @ciph/core@0.1.4
Published:   npm install @ciph/react@0.2.0
             GitHub release: @ciph/react v0.2.0 (with CHANGELOG excerpt)
```

## Per-Package Versioning

**Only packages with file changes in `packages/<name>/*` are versioned.**

Changed files detected via: `git diff origin/main...HEAD`

**Example:**
```
Commit changes:
  ✅ packages/react/src/index.ts    → @ciph/react bumped
  ✅ packages/hono/src/index.ts     → @ciph/hono bumped
  ❌ packages/core/src/index.ts     → @ciph/core NOT bumped (no changes)
  ❌ docs/                           → No packages bumped

Result:
  @ciph/react:  0.1.4 → 0.2.0
  @ciph/hono:   0.1.4 → 0.2.0
  @ciph/core:   0.1.4 (unchanged)
```

## Changelog Management

Each package has its own `CHANGELOG.md`:

```
packages/react/
├── src/
├── package.json
└── CHANGELOG.md    ← Per-package changelog
```

Automatically generated/updated on `dev → main` merge:
- Lists version, date, and changes
- User can manually edit before merging to main
- Git includes it in main commit

## Commit Message Format

### Required for version bumping:
```
<conventional subject>

release: minor     # or major, patch (patch is default)
```

### Optional:
```
feat: add new feature

description of what changed
more details

release: minor
```

### Without release keyword:
- Won't trigger beta/stable release workflows
- CI still runs (lint, test, build)
- Use for docs-only, non-package changes

## Troubleshooting

### "No changes detected"
**Problem:** Beta/stable release workflow outputs "has-changes: false"

**Check:**
1. Files actually changed in `packages/*/`?
2. Merge was to `dev` (beta) or `main` (stable)?
3. Workflow trigger paths correct in `.github/workflows/beta-release.yml` and `stable-release.yml`?

```bash
# Manual test
git diff origin/main...HEAD --name-only | grep "^packages/"
```

### "Package publish failed"
**Problem:** `npm ERR! 403 Forbidden` when publishing

**Check:**
1. `NPM_TOKEN` secret set in GitHub Secrets?
2. Token has publish permission?
3. Package name correct in `package.json`?

### "Version bump conflict"
**Problem:** Git merge conflict in `package.json` after workflow commit

**Solution:**
1. Don't merge dev → main immediately after beta release
2. Wait for bot commit to complete
3. Or manually resolve: keep your latest version from dev

## Git Tags

### Beta tags (on dev):
```
beta-@ciph/react-0.2.0-beta.1
beta-@ciph/hono-0.2.0-beta.1
```

### Stable tags (on main):
```
react-v0.2.0
hono-v0.2.0
core-v0.1.4
```

## NPM Tags

- `beta`: Latest beta version (dev release)
- `latest`: Latest stable version (main release)

**Install:**
```bash
npm install @ciph/react@latest       # stable 0.2.0
npm install @ciph/react@beta         # beta 0.2.0-beta.1
npm install @ciph/react@0.2.0-beta.1 # specific version
```

## Scripts Reference

All scripts in `scripts/`:
- `detect-changed-packages.js` — Compare branches, find which packages changed
- `bump-beta-versions.js` — Bump versions to `-beta.N`
- `bump-stable-versions.js` — Strip `-beta.N`, promote to stable

(Usually run by workflows, rarely manual)

## FAQ

**Q: Can I release multiple packages at once?**
A: Yes. Merge multiple PRs to dev, then merge dev to main. Workflow detects all changed packages.

**Q: What if I only changed docs?**
A: Don't include `release:` in commit. Workflows skip, CI still runs, no version bump.

**Q: Can I manually force a version bump?**
A: Not recommended, but you can edit `package.json` and commit before `dev → main` merge. Script will detect and promote it.

**Q: Do I need to update `package.json` manually?**
A: No. Workflows handle it automatically.

**Q: What about dependency versions between packages?**
A: `bump-stable-versions.js` updates all `@ciph/*` dependencies in `dependencies`, `devDependencies`, and `peerDependencies`.

---

## Migration from Changesets

Old flow: Manual `.changeset/*.md` files per PR.
New flow: Commit message `release: minor/major`.

**If you have pending changesets:**
1. Merge PR without changesets
2. Include `release:` keyword in merge commit
3. Workflow handles versioning

Old `.changeset/` directory can be removed, but no harm keeping it (not used by workflows).
