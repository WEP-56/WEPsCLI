#!/usr/bin/env node

import { execSync } from "node:child_process";
import { listPackageGroup } from "./package-groups.mjs";

const group = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!group) {
	console.error("Usage: node scripts/publish-workspace-group.mjs <core|cli> [--dry-run]");
	process.exit(1);
}

const packages = listPackageGroup(group).filter(({ pkg }) => pkg.private !== true);

if (packages.length === 0) {
	console.error(`No publishable packages found for group: ${group}`);
	process.exit(1);
}

for (const entry of packages) {
	const command = `npm publish --workspace ${entry.workspace} --access public${dryRun ? " --dry-run" : ""}`;
	console.log(`$ ${command}`);
	execSync(command, {
		cwd: process.cwd(),
		stdio: "inherit",
		encoding: "utf8",
	});
}
