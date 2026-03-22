import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageDir = path.dirname(__dirname);
const packagesDir = path.resolve(packageDir, "..");

const dependencies = [
	{ name: "tui", dist: path.join(packagesDir, "tui", "dist", "index.js") },
	{ name: "ai", dist: path.join(packagesDir, "ai", "dist", "index.js") },
	{ name: "agent", dist: path.join(packagesDir, "agent", "dist", "index.js") },
	{ name: "coding-agent", dist: path.join(packagesDir, "coding-agent", "dist", "index.js") },
];

for (const dependency of dependencies) {
	if (existsSync(dependency.dist)) {
		continue;
	}

	const workdir = path.join(packagesDir, dependency.name);
	const result = spawnSync("npm", ["run", "build"], {
		cwd: workdir,
		stdio: "inherit",
		shell: process.platform === "win32",
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}
