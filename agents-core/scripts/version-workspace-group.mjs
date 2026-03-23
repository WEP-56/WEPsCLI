#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { listPackageGroup } from "./package-groups.mjs";

const group = process.argv[2];
const bumpType = process.argv[3];
const explicitVersion = process.argv[4];

if (!group || !bumpType) {
	console.error("Usage: node scripts/version-workspace-group.mjs <core|cli|desktop> <patch|minor|major|set> [version]");
	process.exit(1);
}

if (!["patch", "minor", "major", "set"].includes(bumpType)) {
	console.error(`Unsupported bump type: ${bumpType}`);
	process.exit(1);
}

function run(command) {
	console.log(`$ ${command}`);
	execSync(command, {
		cwd: process.cwd(),
		stdio: "inherit",
		encoding: "utf8",
	});
}

function parseVersion(value) {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
	if (!match) {
		throw new Error(`Invalid version: ${value}`);
	}

	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
}

function formatVersion(version) {
	return `${version.major}.${version.minor}.${version.patch}`;
}

function incrementVersion(currentVersion, type) {
	const parsed = parseVersion(currentVersion);

	switch (type) {
		case "patch":
			return formatVersion({
				...parsed,
				patch: parsed.patch + 1,
			});
		case "minor":
			return formatVersion({
				major: parsed.major,
				minor: parsed.minor + 1,
				patch: 0,
			});
		case "major":
			return formatVersion({
				major: parsed.major + 1,
				minor: 0,
				patch: 0,
			});
		default:
			return currentVersion;
	}
}

function writePackageVersion(packageJsonPath, pkg, nextVersion) {
	const updated = {
		...pkg,
		version: nextVersion,
	};
	writeFileSync(packageJsonPath, `${JSON.stringify(updated, null, "\t")}\n`);
}

const packages = listPackageGroup(group);

if (packages.length === 0) {
	console.error(`No packages found for group: ${group}`);
	process.exit(1);
}

const versions = new Set(packages.map(({ pkg }) => pkg.version));
if (group === "core" && versions.size > 1) {
	console.error(`Core package versions are not aligned: ${[...versions].join(", ")}`);
	process.exit(1);
}

const baseVersion = packages[0].pkg.version;
const nextVersion = bumpType === "set" ? explicitVersion : incrementVersion(baseVersion, bumpType);

if (!nextVersion) {
	console.error("A target version is required when bump type is 'set'.");
	process.exit(1);
}

parseVersion(nextVersion);

console.log(`Updating ${group} packages to ${nextVersion}`);
for (const { packageJsonPath, pkg } of packages) {
	if (pkg.version === nextVersion) {
		console.log(`  ${pkg.name}: already ${nextVersion}`);
		continue;
	}

	console.log(`  ${pkg.name}: ${pkg.version} -> ${nextVersion}`);
	writePackageVersion(packageJsonPath, pkg, nextVersion);
}

if (group === "core") {
	run("node scripts/sync-versions.js");
}

run("npm install");
