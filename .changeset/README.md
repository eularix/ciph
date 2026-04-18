# Changesets

This directory contains changeset files that describe version bumps and breaking changes.

## Creating a Changeset

When contributing changes that should be released, create a changeset:

```bash
# Interactive mode
pnpm changeset

# Command line mode
pnpm changeset add --packages @ciph/core --type minor --message "Your change description"
```

### Changeset Types

- **patch**: Bug fixes and internal improvements (0.1.0 → 0.1.1)
- **minor**: New features, backwards compatible (0.1.0 → 0.2.0)
- **major**: Breaking changes (0.1.0 → 1.0.0)

### Examples

```
.changeset/add-v2-ecdh.md:
---
"@ciph/core": minor
"@ciph/hono": minor
"@ciph/react": minor
"@ciph/client": minor
---

Implement ECDH v2 asymmetric encryption for enhanced security
```

For each package that has changes, list its name and version bump type.

## Releasing

Changesets are automatically versioned and published when merged to main via the release workflow.

See `.github/workflows/release.yml` for the release process.
