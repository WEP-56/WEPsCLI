import { appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { ENV_SHELL_DEBUG_LOG, getAgentDir } from "../config.js";

function getDebugLogPath(): string {
	return join(getAgentDir(), "shell-debug.log");
}

export function writeShellDebugLog(message: string): void {
	const filePath = getDebugLogPath();
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	appendFileSync(filePath, `${new Date().toISOString()} ${message}\n`, "utf8");
}
