import type { ChatMessage } from "./chat-components.js";
import type { RuntimeSelection } from "./agent-runtime.js";
import type { ComposerImageAttachment } from "./image-attachments.js";
import { executeSlashCommand, shouldHandleSlashCommandLocally } from "./slash-commands.js";
import { applyShellModePrompt, type ShellModeId } from "./shell-modes.js";
import type { SlashCommandItem } from "./types.js";

export interface ShellPromptSession {
	id: string;
	title: string;
	lastPrompt?: string;
	runtimeSessionFile?: string;
}

interface ShellPromptControllerOptions<TSession extends ShellPromptSession> {
	currentSession: () => TSession | undefined;
	startNewSession: () => TSession;
	createdTransientSessionId: () => string;
	selectionForSession: (session: TSession) => RuntimeSelection;
	ensureSessionTranscript: (sessionId: string) => void;
	updatePromptSession: (session: TSession, trimmed: string, selection: RuntimeSelection) => void;
	pushChatMessage: (sessionId: string, message: ChatMessage) => void;
	setComposerValue: (value: string) => void;
	setComposerText: (value: string) => void;
	getComposerImages: () => ComposerImageAttachment[];
	clearComposerImages: () => void;
	focusComposer: () => void;
	setFocusRegionComposer: () => void;
	requestRender: () => void;
	runtimePrompt: (
		sessionId: string,
		text: string,
		selection: RuntimeSelection,
		images: ComposerImageAttachment[],
		runtimeSessionFile?: string,
	) => void;
	reloadCurrentSessionResources: () => Promise<void> | void;
	openSkillAdd: () => void;
	openOverlay: (kind: "provider" | "model" | "session") => void;
	openProviderAdd: () => void;
	addImageFromPath: (path: string) => Promise<void> | void;
	pasteComposerImage: () => Promise<void> | void;
	describeComposerImages: () => string;
	compactCurrentSession: () => Promise<void> | void;
	abortActiveRequest: () => void;
	applyShellMode: (modeId: ShellModeId) => void;
	getCurrentMode: () => ShellModeId;
	getStatusSummary: () => string;
	showSkillsSummary: () => Promise<void> | void;
	getAdditionalSlashCommands?: () => SlashCommandItem[];
}

export function createShellPromptController<TSession extends ShellPromptSession>(
	options: ShellPromptControllerOptions<TSession>,
) {
	function pushSystemMessage(sessionId: string, content: string, kind: ChatMessage["kind"] = "status"): void {
		options.pushChatMessage(sessionId, {
			id: `${sessionId}:system:${Date.now()}`,
			role: "system",
			content,
			time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
			kind,
		});
	}

	function submitPrompt(session: TSession, trimmed: string): void {
		options.ensureSessionTranscript(session.id);
		const selection = options.selectionForSession(session);
		options.updatePromptSession(session, trimmed, selection);
		const composerImages = options.getComposerImages();
		options.setComposerValue("");
		options.setComposerText("");
		options.clearComposerImages();
		options.focusComposer();
		const promptText = trimmed.startsWith("/skill:") ? trimmed : applyShellModePrompt(options.getCurrentMode(), trimmed);
		options.runtimePrompt(session.id, promptText, selection, composerImages, session.runtimeSessionFile);
		options.requestRender();
	}

	function retryLastPrompt(): void {
		const session = options.currentSession() ?? options.startNewSession();
		const lastPrompt = session?.lastPrompt?.trim();
		if (!session || !lastPrompt) {
			pushSystemMessage(options.createdTransientSessionId(), "No previous prompt is available to retry in this session.");
			return;
		}
		submitPrompt(session, lastPrompt);
	}

	function handleComposerSubmit(value: string): void {
		const trimmed = value.trim();
		if (!trimmed && options.getComposerImages().length === 0) {
			return;
		}

		const session = options.currentSession() ?? options.startNewSession();
		if (!session) {
			return;
		}

		if (trimmed.startsWith("/") && shouldHandleSlashCommandLocally(trimmed)) {
			runSlashCommand(trimmed);
			return;
		}

		submitPrompt(session, trimmed);
	}

	function runSlashCommand(commandId: string): void {
		if (!shouldHandleSlashCommandLocally(commandId)) {
			const session = options.currentSession() ?? options.startNewSession();
			submitPrompt(session, commandId);
			return;
		}
		options.setComposerValue("");
		options.setComposerText("");
		executeSlashCommand(commandId, {
			startNewSession: options.startNewSession,
			retryLastPrompt,
			openSkillAdd: options.openSkillAdd,
			openOverlay: options.openOverlay,
			openProviderAdd: options.openProviderAdd,
			compactCurrentSession: options.compactCurrentSession,
			reloadCurrentSessionResources: options.reloadCurrentSessionResources,
			abortActiveRequest: options.abortActiveRequest,
			addImageFromPath: options.addImageFromPath,
			pasteComposerImage: options.pasteComposerImage,
			clearComposerImages: options.clearComposerImages,
			describeComposerImages: options.describeComposerImages,
			setMode: options.applyShellMode,
			getCurrentMode: options.getCurrentMode,
			getStatusSummary: options.getStatusSummary,
			showSkillsSummary: options.showSkillsSummary,
			queuePromptTemplate: (title, prompt, summary) => {
				const session = options.currentSession() ?? options.startNewSession();
				pushSystemMessage(session.id, `${title}: ${summary}`);
				options.setComposerValue(prompt);
				options.setComposerText(prompt);
				options.focusComposer();
				options.setFocusRegionComposer();
			},
			pushTimeline: (message) => {
				const session = options.currentSession() ?? options.startNewSession();
				pushSystemMessage(session.id, message);
			},
		}, options.getAdditionalSlashCommands?.() ?? []);
	}

	return {
		handleComposerSubmit,
		pushSystemMessage,
		retryLastPrompt,
		runSlashCommand,
		submitPrompt,
	};
}
