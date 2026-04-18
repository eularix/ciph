#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = path.join(__dirname, '../packages');

function removeBetatag(version) {
  return version.replace(/-beta\.\d+$/, '');
}

function updatePackageVersion(packageDir, newVersion) {
  const pkgJsonPath = path.join(PACKAGES_DIR, packageDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  pkg.version = newVersion;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
}

function updateDependency(packageDir, depName, newVersion) {
  const pkgJsonPath = path.join(PACKAGES_DIR, packageDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

  if (pkg.dependencies && pkg.dependencies[depName]) {
    pkg.dependencies[depName] = newVersion;
  }
  if (pkg.devDependencies && pkg.devDependencies[depName]) {
    pkg.devDependencies[depName] = newVersion;
  }
  if (pkg.peerDependencies && pkg.peerDependencies[depName]) {
    pkg.peerDependencies[depName] = newVersion;
  }

  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
}

function main() {
  const changedPackages = JSON.parse(process.argv[2] || '[]');
  if (changedPackages.length === 0) {
    console.log('No changed packages, skipping');
    process.exit(0);
  }

  const versionMap = new Map();

  changedPackages.forEach(pkgDir => {
    const pkgJsonPath = path.join(PACKAGES_DIR, pkgDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const currentVersion = pkg.version;
    const stableVersion = removeBetatag(currentVersion);

    console.log(`Promoting ${pkgDir}: ${currentVersion} → ${stableVersion}`);
    updatePackageVersion(pkgDir, stableVersion);
    versionMap.set(pkg.name, stableVersion);
  });

  const allPackageDirs = fs.readdirSync(PACKAGES_DIR);
  allPackageDirs.forEach(dir => {
    const stat = fs.statSync(path.join(PACKAGES_DIR, dir));
    if (stat.isDirectory()) {
      versionMap.forEach((version, depName) => {
        updateDependency(dir, depName, version);
      });
    }
  });

  console.log('Stable versions promoted successfully');
  process.exit(0);
}

main();
