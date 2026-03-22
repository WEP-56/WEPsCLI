import type { SlashCommandItem } from "./types.js";
import { buildShellModeSlashCommands, findShellModeByCommand, shellModeHelpMessage, type ShellModeId } from "./shell-modes.js";

const ALL_SLASH_COMMANDS: SlashCommandItem[] = [
	{ id: "/new", label: "/new", description: "Stage a new shell session", keyHint: "n" },
	{ id: "/clear", label: "/clear", description: "Start a fresh session immediately", keyHint: "l" },
	{ id: "/providers", label: "/providers", description: "Open the provider picker", keyHint: "p" },
	{ id: "/provider add", label: "/provider add", description: "Open the guided provider setup flow", keyHint: "a" },
	{ id: "/models", label: "/models", description: "Open the model picker", keyHint: "m" },
	{ id: "/sessions", label: "/sessions", description: "Open the session picker", keyHint: "s" },
	{ id: "/resume", label: "/resume", description: "Open the session picker to resume another chat", keyHint: "r" },
	{ id: "/compact", label: "/compact", description: "Manually compact the current session context", keyHint: "c" },
	{ id: "/stop", label: "/stop", description: "Interrupt the current request", keyHint: "." },
	{ id: "/status", label: "/status", description: "Show the current shell/provider/runtime status", keyHint: "t" },
	{ id: "/help", label: "/help", description: "Show a compact overview of available slash commands", keyHint: "h" },
	{ id: "/review", label: "/review", description: "Queue a review-first prompt template" },
	{ id: "/debug", label: "/debug", description: "Queue a debugging prompt template" },
	{ id: "/provider-check", label: "/provider-check", description: "Queue a provider verification task" },
	...buildShellModeSlashCommands(),
];

interface SlashHandlers {
	startNewSession: () => void;
	openOverlay: (kind: "provider" | "model" | "session") => void;
	openProviderAdd: () => void;
	compactCurrentSession: () => Promise<void> | void;
	abortActiveRequest: () => void;
	setMode: (modeId: ShellModeId) => void;
	getCurrentMode: () => ShellModeId;
	getStatusSummary: () => string;
	queuePromptTemplate: (title: string, prompt: string, summary: string) => void;
	pushTimeline: (message: string) => void;
}

function helpSummary(): string {
	const lines = [
		"Available slash commands:",
		...ALL_SLASH_COMMANDS.map((command) => `${command.id} - ${command.description}`),
		"",
		"Type / to browse the full command list from the composer.",
	];
	return lines.join("\n");
}

export function getSlashCommands(query: string): SlashCommandItem[] {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed.startsWith("/")) {
		return [];
	}
	if (trimmed === "/") {
		return ALL_SLASH_COMMANDS;
	}
	return ALL_SLASH_COMMANDS.filter((command) => command.id.startsWith(trimmed));
}

export function executeSlashCommand(commandId: string, handlers: SlashHandlers): void {
	switch (commandId) {
		case "/new":
		case "/clear":
			handlers.startNewSession();
			return;
		case "/providers":
			handlers.openOverlay("provider");
			return;
		case "/provider add":
			handlers.openProviderAdd();
			return;
		case "/models":
			handlers.openOverlay("model");
			return;
		case "/sessions":
		case "/resume":
			handlers.openOverlay("session");
			return;
		case "/compact":
			void handlers.compactCurrentSession();
			return;
		case "/mode":
			handlers.pushTimeline(shellModeHelpMessage(handlers.getCurrentMode()));
			return;
		case "/stop":
			handlers.abortActiveRequest();
			return;
		case "/status":
			handlers.pushTimeline(handlers.getStatusSummary());
			return;
		case "/help":
			handlers.pushTimeline(helpSummary());
			return;
		case "/review":
			handlers.queuePromptTemplate(
				"Review current change",
				"Review the current implementation for bugs, regressions, and missing tests. Focus findings first, then summarize the change surface.",
				"Queued a review-first task from the slash menu.",
			);
			return;
		case "/debug":
			handlers.queuePromptTemplate(
				"Debug current issue",
				"Investigate the current failure, identify the root cause, implement the minimal correct fix, and verify the result.",
				"Queued a debug-oriented task from the slash menu.",
			);
			return;
		case "/provider-check":
			handlers.queuePromptTemplate(
				"Check provider configuration",
				"Inspect the current provider and model configuration, confirm the active selection, and note any validation or cache issues that still need work.",
				"Queued a provider-state inspection task from the slash menu.",
			);
			return;
		default:
			const mode = findShellModeByCommand(commandId);
			if (mode) {
				handlers.setMode(mode.id);
				return;
			}
			handlers.pushTimeline(`Unknown slash command: ${commandId}`);
	}
}
