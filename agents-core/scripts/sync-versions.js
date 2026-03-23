#!/usr/bin/env node

/**
 * Syncs all core @mariozechner/* package dependency versions to match their current versions.
 * Product packages with independent versioning, such as wepscli and wepsdesktop, are excluded.
 */

import { writeFileSync } from "node:fs";
import { listPackageGroup } from "./package-groups.mjs";

// Read all package.json files and build version map
const packages = {};
const versionMap = {};

for (const entry of listPackageGroup("core")) {
	packages[entry.dir] = { path: entry.packageJsonPath, data: entry.pkg };
	versionMap[entry.pkg.name] = entry.pkg.version;
}

console.log("Current core versions:");
for (const [name, version] of Object.entries(versionMap).sort()) {
	console.log(`  ${name}: ${version}`);
}

// Verify all versions are the same (lockstep)
const versions = new Set(Object.values(versionMap));
if (versions.size > 1) {
	console.error("\nERROR: Not all core packages have the same version.");
	console.error("Expected lockstep versioning for the core package group. Run one of:");
	console.error("  npm run version:patch");
	console.error("  npm run version:minor");
	console.error("  npm run version:major");
	process.exit(1);
}

console.log("\nAll core packages are in lockstep.");

// Update all inter-package dependencies
let totalUpdates = 0;
for (const [dir, pkg] of Object.entries(packages)) {
	let updated = false;
	
	// Check dependencies
	if (pkg.data.dependencies) {
		for (const [depName, currentVersion] of Object.entries(pkg.data.dependencies)) {
			if (versionMap[depName]) {
				const newVersion = `^${versionMap[depName]}`;
				if (currentVersion !== newVersion) {
					console.log(`\n${pkg.data.name}:`);
					console.log(`  ${depName}: ${currentVersion} → ${newVersion}`);
					pkg.data.dependencies[depName] = newVersion;
					updated = true;
					totalUpdates++;
				}
			}
		}
	}
	
	// Check devDependencies
	if (pkg.data.devDependencies) {
		for (const [depName, currentVersion] of Object.entries(pkg.data.devDependencies)) {
			if (versionMap[depName]) {
				const newVersion = `^${versionMap[depName]}`;
				if (currentVersion !== newVersion) {
					console.log(`\n${pkg.data.name}:`);
					console.log(`  ${depName}: ${currentVersion} → ${newVersion} (devDependencies)`);
					pkg.data.devDependencies[depName] = newVersion;
					updated = true;
					totalUpdates++;
				}
			}
		}
	}
	
	// Write if updated
	if (updated) {
		writeFileSync(pkg.path, `${JSON.stringify(pkg.data, null, "\t")}\n`);
	}
}

if (totalUpdates === 0) {
	console.log("\nAll core inter-package dependencies are already in sync.");
} else {
	console.log(`\nUpdated ${totalUpdates} core dependency version(s).`);
}
