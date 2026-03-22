import type { SlashCommandItem } from "./types.js";

export type ShellModeId = "agent" | "plan" | "read-only" | "auto-approve";
export type ShellModeTone = "accent" | "warning" | "muted" | "danger";

export interface ShellModeDefinition {
	id: ShellModeId;
	label: string;
	composerLabel: string;
	description: string;
	tone: ShellModeTone;
	commandId: string;
	shortcutHint: string;
	promptPrefix?: string;
}

const SHELL_MODES: ShellModeDefinition[] = [
	{
		id: "agent",
		label: "Agent",
		composerLabel: "AGENT",
		description: "Normal coding mode. The agent can inspect, edit, and use tools with approval as needed.",
		tone: "accent",
		commandId: "/mode agent",
		shortcutHint: "Alt+1",
	},
	{
		id: "plan",
		label: "Plan",
		composerLabel: "PLAN",
		description: "Analysis-first mode. The agent should reason, propose steps, and avoid making changes unless asked.",
		tone: "warning",
		commandId: "/mode plan",
		shortcutHint: "Alt+2",
		promptPrefix:
			"Plan mode is active. Analyze the task first, explain the intended implementation, and avoid making code changes or running mutating tools unless the user explicitly asks for execution.",
	},
	{
		id: "read-only",
		label: "Read Only",
		composerLabel: "READ ONLY",
		description: "Inspection mode. The agent should read, explain, review, and avoid changing files or running risky commands.",
		tone: "muted",
		commandId: "/mode read-only",
		shortcutHint: "Alt+3",
		promptPrefix:
			"Read-only mode is active. Do not modify files, execute risky shell commands, or take side-effecting actions. Limit the work to inspection, diagnosis, explanation, and review.",
	},
	{
		id: "auto-approve",
		label: "Auto Approve",
		composerLabel: "AUTO",
		description: "Fast execution mode. Risky tool approvals are automatically allowed when possible.",
		tone: "danger",
		commandId: "/mode auto-approve",
		shortcutHint: "Alt+4",
	},
];

export function listShellModes(): ShellModeDefinition[] {
	return SHELL_MODES;
}

export function getShellMode(modeId: ShellModeId): ShellModeDefinition {
	return SHELL_MODES.find((mode) => mode.id === modeId) ?? SHELL_MODES[0]!;
}

export function nextShellMode(currentMode: ShellModeId): ShellModeId {
	const index = SHELL_MODES.findIndex((mode) => mode.id === currentMode);
	return SHELL_MODES[(index + 1 + SHELL_MODES.length) % SHELL_MODES.length]?.id ?? "agent";
}

export function findShellModeByCommand(commandId: string): ShellModeDefinition | undefined {
	return SHELL_MODES.find((mode) => mode.commandId === commandId);
}

export function applyShellModePrompt(modeId: ShellModeId, prompt: string): string {
	const mode = getShellMode(modeId);
	if (!mode.promptPrefix) {
		return prompt;
	}

	return `${mode.promptPrefix}\n\nUser request:\n${prompt}`;
}

export function shellModeSwitchMessage(modeId: ShellModeId): string {
	const mode = getShellMode(modeId);
	return `Mode switched to ${mode.label}. ${mode.description}`;
}

export function shellModeHelpMessage(currentMode: ShellModeId): string {
	const current = getShellMode(currentMode);
	const options = SHELL_MODES.map((mode) => `${mode.commandId} (${mode.shortcutHint})`).join(" | ");
	return `Current mode: ${current.label}. Available modes: ${options}`;
}

export function buildShellModeSlashCommands(): SlashCommandItem[] {
	return [
		{
			id: "/mode",
			label: "/mode",
			description: "Show the current mode and available mode switches",
			keyHint: "m",
		},
		...SHELL_MODES.map((mode) => ({
			id: mode.commandId,
			label: mode.commandId,
			description: `Switch to ${mode.label} mode`,
			keyHint: mode.shortcutHint.replace("Alt+", "A"),
		})),
	];
}
