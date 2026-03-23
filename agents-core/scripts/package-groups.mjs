import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const GROUP_MATCHERS = {
	core: (pkg) => typeof pkg.name === "string" && pkg.name.startsWith("@mariozechner/"),
	cli: (pkg) => pkg.name === "wepscli",
	desktop: (pkg) => pkg.name === "wepsdesktop",
};

export function listTopLevelPackages(rootDir = process.cwd()) {
	const packagesDir = join(rootDir, "packages");
	return readdirSync(packagesDir, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => {
			const dir = dirent.name;
			const packageJsonPath = join(packagesDir, dir, "package.json");
			const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
			return {
				dir,
				packageJsonPath,
				workspace: `packages/${dir}`,
				pkg,
			};
		});
}

export function listPackageGroup(group, rootDir = process.cwd()) {
	const matcher = GROUP_MATCHERS[group];
	if (!matcher) {
		throw new Error(`Unknown package group: ${group}`);
	}

	return listTopLevelPackages(rootDir).filter(({ pkg }) => matcher(pkg));
}
