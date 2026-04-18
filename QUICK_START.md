# Quick Reference

## 5-Minute Setup

```bash
# Clone & install
git clone https://github.com/eularix/ciph
cd ciph
pnpm install

# Start developing
pnpm dev

# Test your changes
pnpm test
pnpm lint
pnpm type-check
```

## Before Pushing

```bash
# This validates everything
pnpm build
pnpm test
pnpm type-check

# Add a changeset (REQUIRED for packages/ changes)
pnpm changeset
# → Select packages
# → Choose patch|minor|major
# → Describe change
```

## After Merge

✅ Automatic PR created to bump versions  
✅ Automatic publish to npm  
✅ Automatic GitHub releases  

No manual steps needed!

## Package Structure

```
packages/
├── core           → @ciph/core (crypto primitives)
├── client         → @ciph/client (frontend HTTP client)
├── hono           → @ciph/hono (backend middleware)
├── react          → @ciph/react (React wrapper)
├── devtools-client → @ciph/devtools-client
└── devtools-server → @ciph/devtools-server
```

## Changesets Quick Commands

```bash
# Create changeset
pnpm changeset

# Check status
pnpm changeset:status

# Version (run by CI)
pnpm changeset:version

# Publish (run by CI)
pnpm changeset:publish
```

## Bump Type Decision

- **patch** = Bug fix, internal PR, no API change
- **minor** = New feature, backwards compatible
- **major** = Breaking change

## File to Create/Edit

1. Make your changes in `packages/*/src/`
2. Update tests in `packages/*/src/*.test.ts`
3. Run `pnpm build` to verify
4. Create changeset: `pnpm changeset`
5. Commit & push
6. CI validates everything ✅
7. Merge → Auto-publish 🚀

## Common Issues

| Problem | Solution |
|---------|----------|
| Build fails | `cd packages/X && pnpm build` to debug |
| Tests fail | `pnpm test` to see errors |
| Lint warns | `pnpm lint --fix` to auto-fix |
| No changeset | `pnpm changeset` to create |

## See Also

- [`CONTRIBUTING.md`](CONTRIBUTING.md) - Full guide
- [`.github/CI-CD.md`](.github/CI-CD.md) - CI/CD details
- [`.changeset/README.md`](.changeset/README.md) - Changesets guide
