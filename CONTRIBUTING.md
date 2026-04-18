# Contributing Guide

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev
```

## Making Changes

### Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make changes** in any package under `packages/`

3. **Test locally**
   ```bash
   pnpm test
   pnpm lint
   pnpm type-check
   pnpm build
   ```

4. **Create changeset** (before pushing)
   ```bash
   pnpm changeset
   ```
   
   Select packages, choose version bump, describe changes.

5. **Commit changeset**
   ```bash
   git add .changeset/
   git commit -m "chore: add changeset"
   ```

6. **Push and create PR**
   ```bash
   git push origin feat/my-feature
   ```

7. **CI validates & tests** ← GitHub Actions automatically runs

8. **Get reviewed & merge** ← Includes changesets in PR

9. **Automatic release** ← Version bump PR created, then published

---

## Common Tasks

### Run Tests for Single Package

```bash
cd packages/core
pnpm test
```

### Build Single Package

```bash
cd packages/core
pnpm build
```

### Add Changeset Interactively

```bash
pnpm changeset
# Follow prompts to select packages and bump type
```

### Check Changeset Status

```bash
pnpm changeset:status
```

Shows what packages have unpublished changes.

### Format & Lint

```bash
pnpm lint              # Check all packages
pnpm type-check        # TypeScript type checking
```

---

## Version Bumping Guide

Use **Semantic Versioning**: `MAJOR.MINOR.PATCH`

- **patch** (0.1.0 → 0.1.1) - Bug fixes, internal improvements, no API changes
- **minor** (0.1.0 → 0.2.0) - New features, backwards compatible
- **major** (0.1.0 → 1.0.0) - Breaking changes to API/behavior

### Examples

**Bug fix in @ciph/core:**
```
pnpm changeset
→ Select @ciph/core
→ Choose "patch"
→ Message: "Fix ECDH key derivation edge case"
```

**New feature in @ciph/client:**
```
pnpm changeset
→ Select @ciph/client
→ Choose "minor"
→ Message: "Add fallbackToPlain option for graceful degradation"
```

**Breaking change in @ciph/hono:**
```
pnpm changeset
→ Select @ciph/hono
→ Choose "major"
→ Message: "Remove deprecated v1 symmetric mode"
```

---

## File Structure

```
ciph/
├── .changeset/              ← Version management
│   ├── config.json         ← Changeset configuration
│   └── README.md           ← How to create changesets
├── .github/
│   ├── CI-CD.md            ← CI/CD documentation
│   └── workflows/
│       ├── ci.yml          ← Runs on PR, validates all packages
│       └── release.yml     ← Publishes after merge
├── packages/               ← Published npm packages
│   ├── core/              ← @ciph/core (crypto primitives)
│   ├── client/            ← @ciph/client (HTTP client)
│   ├── hono/              ← @ciph/hono (Hono middleware)
│   ├── react/             ← @ciph/react (React wrapper)
│   ├── devtools-client/   ← @ciph/devtools-client (browser panel)
│   └── devtools-server/   ← @ciph/devtools-server (inspector UI)
├── example/               ← Example applications (not published)
├── docs/                  ← Documentation site (not published)
└── README.md
```

---

## CI/CD Pipeline

### On Pull Request

✅ **quality** - Lint & TypeScript checks  
✅ **test** - Vitest coverage  
✅ **build** - Turbo build verification  
✅ **changeset** - Validates changesets exist (warning if missing)

All jobs must pass before merge. Missing changesets show as comment but don't fail.

### On Merge

1. **Changeset detects changes** in `.changeset/` directory
2. **Automatic version PR created** - Lists all bumped packages
3. **Merge version PR** - Triggers publish workflow
4. **Publish to npm** - Each package published independently
5. **GitHub releases created** - One release per published package

---

## Troubleshooting

### "Build failed"

```bash
# Check what's failing
pnpm turbo build

# Debug single package
cd packages/core
pnpm build

# Check for TypeScript errors
pnpm type-check
```

### "Lint errors"

```bash
# Check all files
pnpm lint

# Fix auto-fixable errors
pnpm lint -- --fix
```

### "Tests failing"

```bash
# Run tests with output
pnpm test

# Watch mode for development
cd packages/core
pnpm test:watch
```

### "Changeset not detected"

Check file exists:
```bash
ls .changeset/*.md
# Should show something like: .changeset/add-v2-ecdh.md

# Valid format:
cat .changeset/add-v2-ecdh.md
# ---
# "@ciph/core": minor
# ---
# Description here
```

---

## Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: ESLint configured in each package
- **Testing**: Vitest for unit tests
- **Build**: tsup for bundling

Ensure these pass before committing:

```bash
pnpm lint      # ESLint
pnpm type-check # TypeScript
pnpm test      # Vitest
```

---

## Release Checklist

Before cutting a release, ensure:

- [ ] All tests pass locally: `pnpm test`
- [ ] No TypeScript errors: `pnpm type-check`
- [ ] Linter passes: `pnpm lint`
- [ ] Packages build: `pnpm build`
- [ ] Changeset added: `.changeset/*.md` file exists
- [ ] Changeset describes all changed packages
- [ ] Version bump types are appropriate (patch/minor/major)

---

## Questions?

Refer to:
- [`.changeset/README.md`](.changeset/README.md) - Changeset details
- [`.github/CI-CD.md`](.github/CI-CD.md) - CI/CD pipeline details
- `CLAUDE.md` - Project architecture
