#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = path.join(__dirname, '../packages');

function parseVersionType(commitMessage) {
  if (commitMessage.includes('release: major')) return 'major';
  if (commitMessage.includes('release: minor')) return 'minor';
  if (commitMessage.includes('release: patch')) return 'patch';
  return 'minor';
}

function getLatestCommitMessage() {
  try {
    const msg = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' });
    return msg.trim();
  } catch {
    return '';
  }
}

function parseVersion(versionStr) {
  const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?/);
  if (!match) throw new Error(`Invalid version: ${versionStr}`);
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    betaNum: match[4] ? parseInt(match[4], 10) : null,
  };
}

function bumpBetaVersion(currentVersion, bumpType) {
  const v = parseVersion(currentVersion);

  let newVersion;
  if (bumpType === 'major') {
    newVersion = `${v.major + 1}.0.0-beta.1`;
  } else if (bumpType === 'minor') {
    newVersion = `${v.major}.${v.minor + 1}.0-beta.1`;
  } else {
    newVersion = `${v.major}.${v.minor}.${v.patch + 1}-beta.1`;
  }

  return newVersion;
}

function bumpPackageVersion(packageDir, newVersion) {
  const pkgJsonPath = path.join(PACKAGES_DIR, packageDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  pkg.version = newVersion;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
}

function main() {
  const changedPackages = JSON.parse(process.argv[2] || '[]');
  if (changedPackages.length === 0) {
    console.log('No changed packages, skipping version bump');
    process.exit(0);
  }

  const commitMsg = getLatestCommitMessage();
  const bumpType = parseVersionType(commitMsg);

  console.log(`Detected bump type: ${bumpType}`);
  console.log(`Changed packages: ${changedPackages.join(', ')}`);

  changedPackages.forEach(pkgDir => {
    const pkgJsonPath = path.join(PACKAGES_DIR, pkgDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const newVersion = bumpBetaVersion(pkg.version, bumpType);

    console.log(`Bumping ${pkgDir}: ${pkg.version} → ${newVersion}`);
    bumpPackageVersion(pkgDir, newVersion);
  });

  process.exit(0);
}

main();
