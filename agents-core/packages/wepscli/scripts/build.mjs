import { transformAsync } from "@babel/core";
import ts from "@babel/preset-typescript";
import solid from "babel-preset-solid";
import { mkdir, readdir, readFile, rm, watch, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageDir = path.dirname(__dirname);
const srcDir = path.join(packageDir, "src");
const distDir = path.join(packageDir, "dist");
const watchMode = process.argv.includes("--watch");

async function listFiles(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFiles(fullPath)));
			continue;
		}
		files.push(fullPath);
	}

	return files;
}

async function buildFile(filePath) {
	if (filePath.endsWith(".d.ts")) {
		return;
	}

	const relativePath = path.relative(srcDir, filePath);
	const outputPath = path.join(distDir, relativePath.replace(/\.(tsx?|mts|cts)$/, ".js"));
	await mkdir(path.dirname(outputPath), { recursive: true });

	if (!/\.(ts|tsx|mts|cts)$/.test(filePath)) {
		const content = await readFile(filePath);
		await writeFile(outputPath, content);
		return;
	}

	const source = await readFile(filePath, "utf8");
	const transformed = await transformAsync(source, {
		filename: filePath,
		sourceMaps: true,
		presets: [
			[
				solid,
				{
					moduleName: "@opentui/solid",
					generate: "universal",
				},
			],
			[
				ts,
				{
					allExtensions: true,
					isTSX: filePath.endsWith(".tsx"),
				},
			],
		],
	});

	await writeFile(outputPath, transformed?.code ?? "", "utf8");
	if (transformed?.map) {
		await writeFile(`${outputPath}.map`, JSON.stringify(transformed.map), "utf8");
	}
}

async function buildOnce() {
	await rm(distDir, { recursive: true, force: true });
	const files = await listFiles(srcDir);
	for (const file of files) {
		await buildFile(file);
	}
}

async function main() {
	await buildOnce();
	if (!watchMode) {
		return;
	}

	let timer;
	const rebuild = async () => {
		try {
			await buildOnce();
			console.log("[wepscli] rebuilt");
		} catch (error) {
			console.error(error);
		}
	};

	const watcher = watch(srcDir, { recursive: true });
	console.log("[wepscli] watching src");
	for await (const _event of watcher) {
		clearTimeout(timer);
		timer = setTimeout(() => {
			void rebuild();
		}, 100);
	}
}

await main();
