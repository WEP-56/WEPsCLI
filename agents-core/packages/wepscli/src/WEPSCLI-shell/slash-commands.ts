import type { SlashCommandItem } from "./types.js";
import { buildShellModeSlashCommands, findShellModeByCommand, shellModeHelpMessage, type ShellModeId } from "./shell-modes.js";

const ALL_SLASH_COMMANDS: SlashCommandItem[] = [
	{ id: "/new", label: "/new", description: "Stage a new shell session", keyHint: "n" },
	{ id: "/clear", label: "/clear", description: "Start a fresh session immediately", keyHint: "l" },
	{ id: "/retry", label: "/retry", description: "Resend the last prompt in the current session", keyHint: "y" },
	{ id: "/skills", label: "/skills", description: "List installed skills and validation diagnostics" },
	{ id: "/skills reload", label: "/skills reload", description: "Reload skills, prompts, and extensions for the current session" },
	{ id: "/skill add", label: "/skill add", description: "Install a skill into WEPSCLI from a local path" },
	{ id: "/provider", label: "/provider", description: "Open the provider picker" },
	{ id: "/providers", label: "/providers", description: "Open the provider picker", keyHint: "p" },
	{ id: "/provider add", label: "/provider add", description: "Open the guided provider setup flow", keyHint: "a" },
	{ id: "/model", label: "/model", description: "Open the model picker" },
	{ id: "/models", label: "/models", description: "Open the model picker", keyHint: "m" },
	{ id: "/session", label: "/session", description: "Open the session picker" },
	{ id: "/sessions", label: "/sessions", description: "Open the session picker", keyHint: "s" },
	{ id: "/resume", label: "/resume", description: "Open the session picker to resume another chat", keyHint: "r" },
	{ id: "/compact", label: "/compact", description: "Manually compact the current session context", keyHint: "c" },
	{ id: "/stop", label: "/stop", description: "Interrupt the current request", keyHint: "." },
	{ id: "/status", label: "/status", description: "Show the current shell/provider/runtime status", keyHint: "t" },
	{ id: "/help", label: "/help", description: "Show a compact overview of available slash commands", keyHint: "h" },
	{ id: "/review", label: "/review", description: "Queue a review-first prompt template" },
	{ id: "/debug", label: "/debug", description: "Queue a debugging prompt template" },
	{ id: "/provider-check", label: "/provider-check", description: "Queue a provider verification task" },
	{ id: "/image", label: "/image", description: "Show pending image attachments and image input help" },
	{ id: "/image add", label: "/image add", description: "Attach an image file with /image add <path>" },
	{ id: "/image paste", label: "/image paste", description: "Paste an image from the clipboard into the composer" },
	{ id: "/image clear", label: "/image clear", description: "Clear all pending image attachments from the composer" },
	...buildShellModeSlashCommands(),
];

interface SlashHandlers {
	startNewSession: () => void;
	retryLastPrompt: () => void;
	openSkillAdd: () => void;
	openOverlay: (kind: "provider" | "model" | "session") => void;
	openProviderAdd: () => void;
	compactCurrentSession: () => Promise<void> | void;
	reloadCurrentSessionResources: () => Promise<void> | void;
	abortActiveRequest: () => void;
	addImageFromPath: (path: string) => Promise<void> | void;
	pasteComposerImage: () => Promise<void> | void;
	clearComposerImages: () => void;
	describeComposerImages: () => string;
	setMode: (modeId: ShellModeId) => void;
	getCurrentMode: () => ShellModeId;
	getStatusSummary: () => string;
	showSkillsSummary: () => Promise<void> | void;
	queuePromptTemplate: (title: string, prompt: string, summary: string) => void;
	pushTimeline: (message: string) => void;
}

function mergeSlashCommands(additionalCommands: SlashCommandItem[] = []): SlashCommandItem[] {
	const merged = [...ALL_SLASH_COMMANDS];
	for (const command of additionalCommands) {
		if (!merged.some((item) => item.id === command.id)) {
			merged.push(command);
		}
	}
	return merged;
}

function helpSummary(additionalCommands: SlashCommandItem[] = []): string {
	const commands = mergeSlashCommands(additionalCommands);
	const lines = [
		"Available slash commands:",
		...commands.map((command) => `${command.id} - ${command.description}`),
		"",
		"Type / to browse the full command list from the composer.",
	];
	return lines.join("\n");
}

export function getSlashCommands(query: string, additionalCommands: SlashCommandItem[] = []): SlashCommandItem[] {
	const commands = mergeSlashCommands(additionalCommands);
	const trimmed = query.trim().toLowerCase();
	if (!trimmed.startsWith("/")) {
		return [];
	}
	if (trimmed === "/") {
		return commands;
	}
	return commands.filter((command) => command.id.startsWith(trimmed));
}

export function shouldHandleSlashCommandLocally(commandId: string): boolean {
	return !commandId.startsWith("/skill:");
}

export function shouldInsertSlashCommand(commandId: string): boolean {
	return commandId.startsWith("/skill:");
}

export function executeSlashCommand(commandId: string, handlers: SlashHandlers, additionalCommands: SlashCommandItem[] = []): void {
	const trimmed = commandId.trim();
	if (trimmed === "/image") {
		handlers.pushTimeline(handlers.describeComposerImages());
		return;
	}
	if (trimmed === "/image add") {
		handlers.pushTimeline("Usage: /image add <path-to-image>");
		return;
	}
	if (trimmed.startsWith("/image add ")) {
		const imagePath = trimmed.slice("/image add ".length).trim();
		if (!imagePath) {
			handlers.pushTimeline("Usage: /image add <path-to-image>");
			return;
		}
		void handlers.addImageFromPath(imagePath);
		return;
	}
	if (trimmed === "/image paste") {
		void handlers.pasteComposerImage();
		return;
	}
	if (trimmed === "/image clear") {
		handlers.clearComposerImages();
		return;
	}

	switch (trimmed) {
		case "/new":
		case "/clear":
			handlers.startNewSession();
			return;
		case "/retry":
			handlers.retryLastPrompt();
			return;
		case "/skills":
			void handlers.showSkillsSummary();
			return;
		case "/skills reload":
			void handlers.reloadCurrentSessionResources();
			return;
		case "/skill add":
			handlers.openSkillAdd();
			return;
		case "/provider":
		case "/providers":
			handlers.openOverlay("provider");
			return;
		case "/provider add":
			handlers.openProviderAdd();
			return;
		case "/model":
		case "/models":
			handlers.openOverlay("model");
			return;
		case "/session":
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
			handlers.pushTimeline(helpSummary(additionalCommands));
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
