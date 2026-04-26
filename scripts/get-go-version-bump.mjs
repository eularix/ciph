#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parse changeset files to determine Go module version bump
 * Returns: { currentVersion, bumpType: 'major|minor|patch', nextVersion }
 */

const changesetDir = path.join(__dirname, '../.changeset');

function parseChangesets() {
  const files = fs.readdirSync(changesetDir).filter(f =>
    f.endsWith('.md') && f !== 'README.md'
  );

  let maxBump = 'patch'; // patch < minor < major
  const bumpOrder = { patch: 0, minor: 1, major: 2 };

  for (const file of files) {
    const content = fs.readFileSync(path.join(changesetDir, file), 'utf-8');

    // Parse YAML frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;

    const frontmatter = match[1];

    // Check for ciph-go entry or any @ciph entry (affects Go modules)
    const hasCiphGoEntry = /["']?ciph-go["']?\s*:\s*(major|minor|patch)/.test(frontmatter);
    const hasCiphEntry = /@ciph\/\w+["']?\s*:\s*(major|minor|patch)/.test(frontmatter);

    if (hasCiphGoEntry || hasCiphEntry) {
      // Extract bump type
      const bumpMatch = frontmatter.match(/:\s*(major|minor|patch)/);
      if (bumpMatch) {
        const bump = bumpMatch[1];
        if (bumpOrder[bump] > bumpOrder[maxBump]) {
          maxBump = bump;
        }
      }
    }
  }

  return maxBump;
}

function calculateNextVersion(currentVersion, bumpType) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

// Get latest Go module tag
try {
  let latestTag = '';

  const result = spawnSync('git', [
    'tag',
    '-l',
    'modules/ciph-go/core/v*',
    '--sort=-version:refname'
  ], {
    encoding: 'utf-8'
  });

  if (result.status === 0 && result.stdout) {
    latestTag = result.stdout.trim().split('\n')[0] || '';
  }

  const currentVersion = latestTag
    ? latestTag.replace(/.*v/, '')
    : '0.1.0';

  const bumpType = parseChangesets();
  const nextVersion = calculateNextVersion(currentVersion, bumpType);

  console.log(JSON.stringify({
    currentVersion,
    bumpType,
    nextVersion
  }));
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
