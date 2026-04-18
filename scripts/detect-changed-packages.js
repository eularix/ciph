#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = path.join(__dirname, '../packages');

function getChangedPackages(baseBranch = 'origin/main') {
  try {
    const cmd = `git diff --name-only ${baseBranch}...HEAD`;
    const diff = execSync(cmd, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean);

    const packages = new Set();
    diff.forEach(file => {
      const match = file.match(/^packages\/([^/]+)\//);
      if (match) {
        packages.add(match[1]);
      }
    });

    return Array.from(packages).sort();
  } catch {
    console.log('No commits to compare, returning empty');
    return [];
  }
}

function getPackageNames(packageDirs) {
  return packageDirs.map(dir => {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(PACKAGES_DIR, dir, 'package.json'), 'utf-8')
    );
    return pkgJson.name;
  });
}

function main() {
  const baseBranch = process.argv[2] || 'origin/main';
  const changedDirs = getChangedPackages(baseBranch);
  const changedNames = getPackageNames(changedDirs);

  console.log(JSON.stringify({
    directories: changedDirs,
    packages: changedNames,
  }, null, 2));

  process.exit(0);
}

main();
