import chalk from "chalk";
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { APP_NAME, ensureAgentDir, getAgentDir, getAuthPath, getProvidersPath, getSettingsPath } from "./config.js";
import { ProviderProfileService } from "./provider-profiles/index.js";
import { runOnboarding } from "./onboarding/run-onboarding.js";

function writeStartupErrorLog(label: string, error: unknown): void {
	try {
		const agentDir = ensureAgentDir();
		const details = error instanceof Error ? error.stack ?? error.message : String(error);
		appendFileSync(`${agentDir}\\startup-error.log`, `[${new Date().toISOString()}] ${label}\n${details}\n\n`, "utf8");
	} catch {}
}

function isBunRuntime(): boolean {
	return typeof process.versions.bun === "string";
}

function hasBunAvailable(): boolean {
	const result = spawnSync("bun", ["--version"], {
		stdio: "ignore",
		shell: process.platform === "win32",
	});
	return result.status === 0;
}

async function resolveBunPreloadPath(): Promise<string> {
	const resolved = await import.meta.resolve("@opentui/solid/preload");
	return resolved.startsWith("file:") ? fileURLToPath(resolved) : resolved;
}

async function relaunchInBun(): Promise<number | null> {
	const entry = process.argv[1];
	if (!entry) {
		return null;
	}

	const preloadPath = await resolveBunPreloadPath();
	const child = spawnSync("bun", ["--conditions=browser", "--preload", preloadPath, entry, ...process.argv.slice(2)], {
		stdio: "inherit",
		env: process.env,
		shell: process.platform === "win32",
	});

	if (typeof child.status === "number") {
		return child.status;
	}
	if (child.error) {
		throw child.error;
	}
	return 0;
}

function printHelp(): void {
	console.log(`${APP_NAME} - TUI-first coding agent CLI

Usage:
  ${APP_NAME}
  ${APP_NAME} --help
  ${APP_NAME} --version

Current status:
  Provider profiles and onboarding are implemented.
  The current shell direction is the OpenTUI-based WEPSCLI-shell rebuild.
  Interactive shell launch now prefers Bun automatically when it is available.
`);
}

function printVersion(): void {
	console.log("0.1.0");
}

function printBootstrapSummary(): void {
	const agentDir = ensureAgentDir();
	const providerProfiles = new ProviderProfileService();
	providerProfiles.ensureStorage();
	const profiles = providerProfiles.listProfiles();
	const activeSelection = providerProfiles.getActiveSelection();

	console.log(chalk.cyanBright("WEPSCLI bootstrap is ready."));
	console.log();
	console.log(`${chalk.bold("Agent dir:")} ${agentDir}`);
	console.log(`${chalk.bold("Settings:")}  ${getSettingsPath()}`);
	console.log(`${chalk.bold("Auth:")}      ${getAuthPath()}`);
	console.log(`${chalk.bold("Providers:")} ${getProvidersPath()}`);
	console.log(`${chalk.bold("Profiles:")}  ${profiles.length}`);
	console.log(`${chalk.bold("Active:")}    ${activeSelection.profileId ?? "none"}`);
	console.log();
	console.log(chalk.dim("Next step: use an interactive terminal to complete onboarding or launch the shell."));
}

export async function main(args: string[]): Promise<void> {
	if (args.includes("--help") || args.includes("-h")) {
		printHelp();
		return;
	}

	if (args.includes("--version") || args.includes("-v")) {
		printVersion();
		return;
	}

	const profiles = new ProviderProfileService();
	profiles.ensureStorage();

	if (profiles.listProfiles().length === 0) {
		if (!process.stdin.isTTY || !process.stdout.isTTY) {
			console.log(chalk.yellow("WEPSCLI needs an interactive terminal to complete first-run onboarding."));
			printBootstrapSummary();
			return;
		}
		const savedProfile = await runOnboarding(profiles);
		console.log(chalk.greenBright(`Saved provider profile: ${savedProfile.label}`));
	}

	if (process.stdin.isTTY && process.stdout.isTTY) {
		if (!isBunRuntime() && hasBunAvailable()) {
			const exitCode = await relaunchInBun();
			if (typeof exitCode === "number" && exitCode !== 0) {
				process.exitCode = exitCode;
			}
			return;
		}

		try {
			const { runWepscliShell } = await import("./WEPSCLI-shell/index.js");
			await runWepscliShell(profiles);
			return;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const details = error instanceof Error ? error.stack ?? error.message : String(error);
			writeStartupErrorLog("WEPSCLI-shell startup error", error);
			console.log(chalk.yellow("WEPSCLI-shell could not start. Falling back to the temporary shell."));
			console.log(chalk.dim(message));
			console.error(chalk.red("WEPSCLI-shell startup error:"));
			console.error(details);
			if (process.env.WEPSCLI_DISABLE_FALLBACK === "1") {
				throw error;
			}
			try {
				const { runWorkbench } = await import("./workbench/index.js");
				await runWorkbench(profiles);
			} catch (fallbackError) {
				writeStartupErrorLog("Fallback workbench startup error", fallbackError);
				throw fallbackError;
			}
		}
		return;
	}

	printBootstrapSummary();
}
