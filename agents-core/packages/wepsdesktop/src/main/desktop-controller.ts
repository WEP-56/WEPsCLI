import { basename, join } from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent, Model } from "@mariozechner/pi-ai";
import {
	AuthStorage,
	createAgentSession,
	type AgentSession,
	type AgentSessionEvent,
	ModelRegistry,
	SessionManager,
	SettingsManager,
} from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "../../../wepscli/src/config.js";
import { ProviderProfileService } from "../../../wepscli/src/provider-profiles/provider-profile-service.js";
import type {
	CreateProviderProfileInput,
	DiscoveredModel,
	ProviderProfile,
} from "../../../wepscli/src/provider-profiles/types.js";
import { SessionHistoryService, type ShellSessionRecord } from "../../../wepscli/src/session-history/session-history-service.js";
import type {
	CreateDesktopProviderProfileInput,
	DesktopAppContext,
	DesktopChatMessage,
	DesktopRuntimeState,
	DesktopSelection,
	DesktopSessionRecord,
	DesktopSessionSnapshot,
	DesktopSnapshot,
	DesktopToolApprovalDecision,
} from "../shared/bridge.js";
import { WorkspaceStore } from "./workspace-store.js";

type EmitSnapshot = (snapshot: DesktopSnapshot) => void;

type RuntimeClient = {
	sessionId: string;
	session: AgentSession;
	modelRegistry: ModelRegistry;
	authStorage: AuthStorage;
	activeProfileId: string;
	activeModelId: string;
	unsubscribe: () => void;
};

function truncate(value: string, maxLength: number): string {
	const normalized = value.trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}
	return `${normalized.slice(0, maxLength - 1)}…`;
}

function formatTime(timestamp?: number): string {
	return new Date(timestamp ?? Date.now()).toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function guessReasoningSupport(modelId: string): boolean {
	const value = modelId.toLowerCase();
	return [
		"gpt-5",
		"gpt-4.1",
		"o1",
		"o3",
		"o4",
		"claude-3-7",
		"claude-sonnet-4",
		"claude-opus-4",
		"gemini-2.5",
		"reasoner",
		"thinking",
	].some((token) => value.includes(token));
}

function getRuntimeSessionDir(cwd: string, agentDir: string): string {
	const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
	return join(agentDir, "sessions", safePath);
}

function toModelDefinition(model: DiscoveredModel) {
	return {
		id: model.id,
		name: model.name,
		reasoning: guessReasoningSupport(model.id),
		input: ["text", "image"] as ("text" | "image")[],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 16_384,
	};
}

function extractTextBlocks(content: Array<{ type?: string; text?: string; thinking?: string }>, mode: "visible" | "thinking") {
	return content
		.map((block) => {
			if (mode === "visible" && block.type === "text" && typeof block.text === "string") {
				return block.text;
			}
			if (mode === "thinking" && block.type === "thinking" && typeof block.thinking === "string") {
				return block.thinking;
			}
			if (mode === "visible" && block.type === "image") {
				return "[image]";
			}
			return "";
		})
		.filter(Boolean)
		.join("\n\n")
		.trim();
}

function extractUserText(message: AgentMessage): string {
	if (!("content" in message)) {
		return "";
	}

	if (typeof message.content === "string") {
		return message.content.trim();
	}

	if (Array.isArray(message.content)) {
		return message.content
			.filter(
				(block): block is { type: "text"; text: string } =>
					typeof block === "object" && block !== null && "type" in block && block.type === "text" && "text" in block,
			)
			.map((block) => block.text)
			.join("\n\n")
			.trim();
	}

	return "";
}

function extractAssistantReasoning(message: AgentMessage): string {
	if (message.role !== "assistant" || !Array.isArray(message.content)) {
		return "";
	}
	return extractTextBlocks(message.content, "thinking");
}

function extractAssistantVisibleText(message: AgentMessage): string {
	if (message.role !== "assistant" || !Array.isArray(message.content)) {
		return "";
	}
	return extractTextBlocks(message.content, "visible");
}

function extractToolResultText(message: AgentMessage): string {
	if (message.role !== "toolResult" || !Array.isArray(message.content)) {
		return "";
	}

	return message.content
		.map((block) => {
			if (block.type === "text" && typeof block.text === "string") {
				return block.text;
			}
			if (block.type === "image") {
				return "[image tool result]";
			}
			return "";
		})
		.filter(Boolean)
		.join("\n\n")
		.trim();
}

function deriveSessionTitle(messages: DesktopChatMessage[], currentTitle?: string): string {
	const firstUserMessage = messages.find((message) => message.role === "user" && message.content.trim().length > 0);
	if (!firstUserMessage) {
		return currentTitle && currentTitle !== "New session" ? currentTitle : "New session";
	}

	const sentenceEnd = firstUserMessage.content.search(/[.!?]/);
	if (sentenceEnd > 0 && sentenceEnd <= 56) {
		return truncate(firstUserMessage.content.slice(0, sentenceEnd + 1), 60);
	}
	return truncate(firstUserMessage.content, 60);
}

function deriveSessionSummary(messages: DesktopChatMessage[]): string {
	const latestAssistantMessage = [...messages]
		.reverse()
		.find((message) => message.role === "assistant" && message.content.trim().length > 0);
	if (latestAssistantMessage) {
		return truncate(latestAssistantMessage.content.replace(/\s+/g, " "), 120);
	}

	const latestUserMessage = [...messages]
		.reverse()
		.find((message) => message.role === "user" && message.content.trim().length > 0);
	if (latestUserMessage) {
		return truncate(latestUserMessage.content.replace(/\s+/g, " "), 120);
	}

	return "Ready for a task.";
}

function latestPrompt(messages: DesktopChatMessage[]): string | undefined {
	return [...messages]
		.reverse()
		.find((message) => message.role === "user" && message.content.trim().length > 0)
		?.content.trim();
}

function toDesktopSessionRecord(record: ShellSessionRecord): DesktopSessionRecord {
	return {
		id: record.id,
		title: record.title,
		summary: record.summary,
		state: record.state,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		workspacePath: record.workspacePath,
		providerProfileId: record.providerProfileId,
		providerLabel: record.providerLabel,
		modelId: record.modelId,
		lastPrompt: record.lastPrompt,
		runtimeSessionFile: record.runtimeSessionFile,
	};
}

function toIdleRuntimeState(label = "Ready"): DesktopRuntimeState {
	return {
		phase: "idle",
		label,
		interruptible: false,
		canContinue: true,
	};
}

function toRunningRuntimeState(label = "Running"): DesktopRuntimeState {
	return {
		phase: "running",
		label,
		interruptible: true,
		canContinue: false,
	};
}

function toErrorRuntimeState(detail: string): DesktopRuntimeState {
	return {
		phase: "error",
		label: "Runtime unavailable",
		detail,
		interruptible: false,
		canContinue: true,
	};
}

function toSelection(profile?: ProviderProfile, modelId?: string): DesktopSelection {
	return {
		profileId: profile?.id,
		modelId,
	};
}

export class DesktopController {
	private readonly agentDir = getAgentDir();
	private readonly profileService = new ProviderProfileService();
	private readonly sessionService = new SessionHistoryService();
	private readonly workspaceStore: WorkspaceStore;
	private currentWorkspacePath?: string;
	private activeSessionId?: string;
	private runtimeClient?: RuntimeClient;
	private runtimeState: DesktopRuntimeState = toIdleRuntimeState("Choose a workspace");
	private messages: DesktopChatMessage[] = [];

	constructor(
		private readonly appContext: DesktopAppContext,
		workspaceStorePath: string,
		private readonly emitSnapshot: EmitSnapshot,
	) {
		this.workspaceStore = new WorkspaceStore(workspaceStorePath);
		this.profileService.ensureStorage();
		const state = this.workspaceStore.load();
		this.currentWorkspacePath = state.currentWorkspacePath;
		this.runtimeState = this.currentWorkspacePath
			? this.computeUnavailableRuntimeState()
			: toIdleRuntimeState("Choose a workspace");
	}

	getSnapshot(): DesktopSnapshot {
		return this.buildSnapshot();
	}

	async activateWorkspace(workspacePath: string): Promise<DesktopSnapshot> {
		this.workspaceStore.rememberWorkspace(workspacePath);
		this.currentWorkspacePath = workspacePath;
		this.activeSessionId = undefined;
		this.messages = [];
		this.disposeRuntimeClient();
		this.runtimeState = this.computeUnavailableRuntimeState();

		const sessions = this.sessionService.listSessions(workspacePath);
		const preferredSession = sessions.find((session) => session.state === "active") ?? sessions[0];
		if (preferredSession) {
			await this.openSession(preferredSession.id);
		}

		return this.broadcastSnapshot();
	}

	async createProviderProfile(input: CreateDesktopProviderProfileInput): Promise<DesktopSnapshot> {
		const created = this.profileService.createProfile(input as CreateProviderProfileInput);
		let selectedModelId: string | undefined;

		try {
			const refreshed = await this.profileService.refreshModels(created.id);
			if ("models" in refreshed) {
				selectedModelId = refreshed.models[0]?.id;
			}
		} catch {
			// Keep the profile even if discovery fails.
		}

		this.profileService.setActiveSelection(created.id, selectedModelId);
		await this.syncRuntimeSelection();
		return this.broadcastSnapshot();
	}

	async refreshProviderModels(profileId: string): Promise<DesktopSnapshot> {
		const result = await this.profileService.refreshModels(profileId);
		if ("models" in result && result.models.length > 0) {
			const selection = this.profileService.getActiveSelection();
			if (selection.profileId === profileId && !selection.modelId) {
				this.profileService.setActiveSelection(profileId, result.models[0].id);
			}
		}

		await this.syncRuntimeSelection();
		return this.broadcastSnapshot();
	}

	async setActiveSelection(profileId: string, modelId?: string): Promise<DesktopSnapshot> {
		const profile = this.profileService.getProfile(profileId);
		if (!profile) {
			throw new Error(`Unknown provider profile: ${profileId}`);
		}

		const resolvedModelId = modelId ?? profile.models[0]?.id;
		this.profileService.setActiveSelection(profileId, resolvedModelId);
		await this.syncRuntimeSelection();
		return this.broadcastSnapshot();
	}

	async createSession(): Promise<DesktopSnapshot> {
		const workspacePath = this.requireWorkspacePath();
		const selection = this.resolveSelection();
		const profile = selection.profileId ? this.profileService.getProfile(selection.profileId) : undefined;

		const record = this.sessionService.createSession({
			title: "New session",
			summary: `Workspace ${basename(workspacePath)} is ready.`,
			state: "ready",
			workspacePath,
			providerProfileId: selection.profileId,
			providerLabel: profile?.label,
			modelId: selection.modelId,
		});

		await this.openSession(record.id);
		return this.buildSnapshot();
	}

	async openSession(sessionId: string): Promise<DesktopSnapshot> {
		const record = this.sessionService.getSession(sessionId);
		if (!record) {
			throw new Error(`Unknown session: ${sessionId}`);
		}

		if (record.workspacePath && record.workspacePath !== this.currentWorkspacePath) {
			this.currentWorkspacePath = record.workspacePath;
			this.workspaceStore.rememberWorkspace(record.workspacePath);
			this.disposeRuntimeClient();
		}

		this.activeSessionId = sessionId;
		this.sessionService.markActive(sessionId);
		await this.ensureRuntimeClient(record);
		this.syncSessionMetadata();
		return this.broadcastSnapshot();
	}

	async sendPrompt(sessionId: string, text: string): Promise<void> {
		const normalized = text.trim();
		if (!normalized) {
			return;
		}

		const record = this.sessionService.getSession(sessionId);
		if (!record) {
			throw new Error(`Unknown session: ${sessionId}`);
		}

		const client = await this.ensureRuntimeClient(record);
		this.sessionService.updateSession(sessionId, {
			lastPrompt: normalized,
			workspacePath: this.currentWorkspacePath,
			providerProfileId: client.activeProfileId,
			providerLabel: this.profileService.getProfile(client.activeProfileId)?.label,
			modelId: client.activeModelId,
		});

		this.runtimeState = toRunningRuntimeState("Running");
		this.broadcastSnapshot();
		await client.session.prompt(normalized);
	}

	async abortSession(sessionId: string): Promise<DesktopSnapshot> {
		if (this.runtimeClient?.sessionId === sessionId) {
			await this.runtimeClient.session.abort();
			this.runtimeState = toIdleRuntimeState("Interrupted");
		}
		return this.broadcastSnapshot();
	}

	async resolveApproval(_requestId: string, _decision: DesktopToolApprovalDecision): Promise<DesktopSnapshot> {
		return this.buildSnapshot();
	}

	dispose(): void {
		this.disposeRuntimeClient();
	}

	private buildSnapshot(): DesktopSnapshot {
		const workspaceState = this.workspaceStore.load();
		return {
			appContext: this.appContext,
			agentDir: this.agentDir,
			currentWorkspacePath: this.currentWorkspacePath,
			recentWorkspaces: workspaceState.recentWorkspaces,
			providerProfiles: this.profileService.listProfiles(),
			activeSelection: this.resolveSelection(),
			sessions: this.currentWorkspacePath
				? this.sessionService.listSessions(this.currentWorkspacePath).map(toDesktopSessionRecord)
				: [],
			activeSession: this.buildActiveSessionSnapshot(),
		};
	}

	private buildActiveSessionSnapshot(): DesktopSessionSnapshot | undefined {
		if (!this.activeSessionId) {
			return undefined;
		}

		const record = this.sessionService.getSession(this.activeSessionId);
		if (!record) {
			return undefined;
		}

		return {
			record: toDesktopSessionRecord(record),
			messages: this.messages,
			runtimeState: this.runtimeState,
			selection: {
				profileId: record.providerProfileId ?? this.resolveSelection().profileId,
				modelId: record.modelId ?? this.resolveSelection().modelId,
			},
		};
	}

	private broadcastSnapshot(): DesktopSnapshot {
		const snapshot = this.buildSnapshot();
		this.emitSnapshot(snapshot);
		return snapshot;
	}

	private resolveSelection(): DesktopSelection {
		const selection = this.profileService.getActiveSelection();
		if (selection.profileId) {
			return selection;
		}

		const firstProfile = this.profileService.listProfiles()[0];
		return {
			profileId: firstProfile?.id,
			modelId: firstProfile?.models[0]?.id,
		};
	}

	private requireWorkspacePath(): string {
		if (!this.currentWorkspacePath) {
			throw new Error("No workspace is selected.");
		}
		return this.currentWorkspacePath;
	}

	private requireResolvedSelection(): { profile: ProviderProfile; modelId: string; apiKey: string } {
		const selection = this.resolveSelection();
		if (!selection.profileId) {
			throw new Error("No provider profile selected.");
		}

		const profile = this.profileService.getProfile(selection.profileId);
		if (!profile) {
			throw new Error(`Unknown provider profile: ${selection.profileId}`);
		}

		const modelId = selection.modelId ?? profile.models[0]?.id;
		if (!modelId) {
			throw new Error(`No model configured for ${profile.label}`);
		}

		const apiKey = this.profileService.getApiKey(profile.id);
		if (!apiKey) {
			throw new Error(`No API key configured for ${profile.label}`);
		}

		return { profile, modelId, apiKey };
	}

	private async ensureRuntimeClient(record: ShellSessionRecord): Promise<RuntimeClient> {
		const selection = this.requireResolvedSelection();

		if (
			this.runtimeClient &&
			this.runtimeClient.sessionId === record.id &&
			this.runtimeClient.activeProfileId === selection.profile.id &&
			this.runtimeClient.activeModelId === selection.modelId
		) {
			return this.runtimeClient;
		}

		this.disposeRuntimeClient();

		const authStorage = AuthStorage.inMemory();
		const modelRegistry = new ModelRegistry(authStorage, join(this.agentDir, "runtime-models.json"));
		const settingsManager = SettingsManager.inMemory();
		const sessionDir = getRuntimeSessionDir(this.requireWorkspacePath(), this.agentDir);
		const sessionManager = record.runtimeSessionFile
			? SessionManager.open(record.runtimeSessionFile, sessionDir)
			: SessionManager.create(this.requireWorkspacePath(), sessionDir);

		this.registerProvider(modelRegistry, authStorage, selection.profile, selection.modelId, selection.apiKey);

		const model = modelRegistry.find(selection.profile.id, selection.modelId);
		if (!model) {
			throw new Error(`Model ${selection.modelId} is unavailable for ${selection.profile.label}`);
		}

		const { session } = await createAgentSession({
			cwd: this.requireWorkspacePath(),
			agentDir: this.agentDir,
			authStorage,
			modelRegistry,
			settingsManager,
			sessionManager,
			model: model as Model<any>,
		});

		const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
			this.handleRuntimeEvent(event, record.id, session);
		});

		const runtimeSessionFile = session.sessionManager.getSessionFile();
		if (runtimeSessionFile && runtimeSessionFile !== record.runtimeSessionFile) {
			this.sessionService.updateSession(record.id, {
				runtimeSessionFile,
				workspacePath: this.currentWorkspacePath,
			});
		}

		this.runtimeClient = {
			sessionId: record.id,
			session,
			modelRegistry,
			authStorage,
			activeProfileId: selection.profile.id,
			activeModelId: selection.modelId,
			unsubscribe,
		};

		this.messages = this.buildTranscript(session.state.messages, session.state.streamMessage);
		this.runtimeState = this.deriveRuntimeState(session);
		return this.runtimeClient;
	}

	private disposeRuntimeClient(): void {
		if (!this.runtimeClient) {
			return;
		}

		this.runtimeClient.unsubscribe();
		void this.runtimeClient.session.abort().catch(() => {});
		this.runtimeClient.session.dispose();
		this.runtimeClient = undefined;
		this.messages = [];
	}

	private registerProvider(
		modelRegistry: ModelRegistry,
		authStorage: AuthStorage,
		profile: ProviderProfile,
		modelId: string,
		apiKey: string,
	): void {
		authStorage.setRuntimeApiKey(profile.id, apiKey);

		const models = [...profile.models];
		if (!models.some((model) => model.id === modelId)) {
			models.push({
				id: modelId,
				name: modelId,
				family: profile.family,
			});
		}

		modelRegistry.registerProvider(profile.id, {
			baseUrl: profile.baseUrl,
			apiKey,
			api: profile.apiDialect,
			models: models.map((model) => toModelDefinition(model)),
		});
	}

	private async syncRuntimeSelection(): Promise<void> {
		if (!this.runtimeClient || !this.activeSessionId) {
			this.runtimeState = this.computeUnavailableRuntimeState();
			return;
		}

		const selection = this.requireResolvedSelection();
		this.registerProvider(
			this.runtimeClient.modelRegistry,
			this.runtimeClient.authStorage,
			selection.profile,
			selection.modelId,
			selection.apiKey,
		);

		const model = this.runtimeClient.modelRegistry.find(selection.profile.id, selection.modelId);
		if (!model) {
			throw new Error(`Model ${selection.modelId} is unavailable for ${selection.profile.label}`);
		}

		await this.runtimeClient.session.setModel(model as Model<any>);
		this.runtimeClient.activeProfileId = selection.profile.id;
		this.runtimeClient.activeModelId = selection.modelId;
		this.syncSessionMetadata();
	}

	private computeUnavailableRuntimeState(): DesktopRuntimeState {
		if (!this.currentWorkspacePath) {
			return toIdleRuntimeState("Choose a workspace");
		}

		try {
			this.requireResolvedSelection();
			return toIdleRuntimeState("Ready");
		} catch (error) {
			return toErrorRuntimeState(error instanceof Error ? error.message : String(error));
		}
	}

	private handleRuntimeEvent(_event: AgentSessionEvent, sessionId: string, session: AgentSession): void {
		if (this.activeSessionId !== sessionId) {
			return;
		}

		this.messages = this.buildTranscript(session.state.messages, session.state.streamMessage);
		this.runtimeState = this.deriveRuntimeState(session);
		this.syncSessionMetadata();
		this.broadcastSnapshot();
	}

	private deriveRuntimeState(session: AgentSession): DesktopRuntimeState {
		if (session.state.error) {
			return toErrorRuntimeState(session.state.error);
		}
		if (session.state.isStreaming || session.state.pendingToolCalls.size > 0) {
			return toRunningRuntimeState("Running");
		}
		return toIdleRuntimeState("Ready");
	}

	private buildTranscript(messages: AgentMessage[], streamMessage: AgentMessage | null): DesktopChatMessage[] {
		const result: DesktopChatMessage[] = [];
		let sequence = 0;
		const pushMessage = (
			role: DesktopChatMessage["role"],
			content: string,
			kind: DesktopChatMessage["kind"],
			timestamp?: number,
		) => {
			if (!content.trim()) {
				return;
			}
			sequence += 1;
			result.push({
				id: `desktop:${sequence}`,
				role,
				content,
				time: formatTime(timestamp),
				kind,
			});
		};

		for (const message of messages) {
			if (message.role === "user") {
				pushMessage("user", extractUserText(message), "default", message.timestamp);
				continue;
			}

			if (message.role === "assistant") {
				pushMessage("assistant", extractAssistantReasoning(message), "reasoning", message.timestamp);
				pushMessage("assistant", extractAssistantVisibleText(message), "default", message.timestamp);
				continue;
			}

			if (message.role === "toolResult") {
				const body = extractToolResultText(message);
				pushMessage(
					"system",
					[`Tool ${message.toolName}`, body || "No output."].filter(Boolean).join("\n\n"),
					"tool",
					message.timestamp,
				);
			}
		}

		if (streamMessage?.role === "assistant") {
			pushMessage("assistant", extractAssistantVisibleText(streamMessage), "default", streamMessage.timestamp);
		}

		return result.slice(-200);
	}

	private syncSessionMetadata(): void {
		if (!this.activeSessionId) {
			return;
		}

		const record = this.sessionService.getSession(this.activeSessionId);
		if (!record) {
			return;
		}

		const selection = this.resolveSelection();
		const profile = selection.profileId ? this.profileService.getProfile(selection.profileId) : undefined;
		this.sessionService.updateSession(this.activeSessionId, {
			title: deriveSessionTitle(this.messages, record.title),
			summary: deriveSessionSummary(this.messages),
			workspacePath: this.currentWorkspacePath,
			providerProfileId: selection.profileId,
			providerLabel: profile?.label,
			modelId: selection.modelId,
			lastPrompt: latestPrompt(this.messages),
			runtimeSessionFile: this.runtimeClient?.session.sessionManager.getSessionFile() ?? record.runtimeSessionFile,
		});
	}
}
