import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const APP_NAME = "wepscli";
export const CONFIG_DIR_NAME = ".wepscli";
export const ENV_AGENT_DIR = "WEPSCLI_AGENT_DIR";
export const ENV_SHELL_DEBUG_LOG = "WEPSCLI_SHELL_DEBUG_LOG";

function expandHome(pathValue: string): string {
	if (pathValue === "~") return homedir();
	if (pathValue.startsWith("~/")) return join(homedir(), pathValue.slice(2));
	return pathValue;
}

export function getAgentDir(): string {
	const envDir = process.env[ENV_AGENT_DIR];
	if (envDir) {
		return expandHome(envDir);
	}
	return join(homedir(), CONFIG_DIR_NAME, "agent");
}

export function getSettingsPath(): string {
	return join(getAgentDir(), "settings.json");
}

export function getAuthPath(): string {
	return join(getAgentDir(), "auth.json");
}

export function getProvidersPath(): string {
	return join(getAgentDir(), "providers.json");
}

export function getSessionsPath(): string {
	return join(getAgentDir(), "sessions.json");
}

export function ensureAgentDir(): string {
	const agentDir = getAgentDir();
	if (!existsSync(agentDir)) {
		mkdirSync(agentDir, { recursive: true });
	}
	return agentDir;
}
