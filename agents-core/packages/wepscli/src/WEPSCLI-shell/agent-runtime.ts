import { join } from "node:path";
import type { ImageContent, Model } from "@mariozechner/pi-ai";
import type { AgentSession, AgentSessionEvent, AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "../config.js";
import type { DiscoveredModel, ProviderProfile, ProviderProfileService } from "../provider-profiles/index.js";
import { handleAgentSessionEvent } from "./agent-runtime-events.js";
import {
	cancellationToolOutput,
	createMessageId,
	extractAssistantReasoning,
	extractAssistantVisibleText,
	extractUserImages,
	extractUserText,
	formatCompactionResultMessage,
	formatRuntimeError,
	formatTime,
	getRuntimeSessionDir,
	installBeforeToolCallHook,
	loadCodingAgentRuntime,
	toModelDefinition,
} from "./agent-runtime-helpers.js";
import type {
	PendingApprovalRecord,
	RuntimeCallbacks,
	RuntimeSelection,
	RuntimeSessionBinding,
	RuntimeSessionRecord,
} from "./agent-runtime-types.js";
import type { ChatMessage } from "./chat-components.js";
import { getRuntimeRecoveryHint } from "./runtime-recovery.js";
import {
	createCompactingRuntimeState,
	createErrorRuntimeState,
	createIdleRuntimeState,
	createInterruptedRuntimeState,
	createRunningRuntimeState,
	type RuntimeSessionState,
} from "./runtime-status.js";
import type { ShellModeId } from "./shell-modes.js";
import { createToolApprovalRequest, type ToolApprovalDecision, toolApprovalDecisionReason } from "./tool-approval.js";
import { createToolMessageState, type ToolMessageState, updateToolMessageState } from "./tool-messages.js";

export type { RuntimeSelection } from "./agent-runtime-types.js";

export class WepsAgentRuntime {
	private readonly records = new Map<string, RuntimeSessionRecord>();
	private readonly pending = new Map<string, Promise<RuntimeSessionRecord>>();
	private readonly pendingApprovals = new Map<string, PendingApprovalRecord>();
	private readonly cwd: string;
	private readonly agentDir: string;
	private currentMode: ShellModeId = "agent";
	private approvalSequence = 0;

	constructor(
		private readonly profileService: ProviderProfileService,
		private readonly callbacks: RuntimeCallbacks,
		options: {
			cwd?: string;
			agentDir?: string;
		} = {},
	) {
		this.cwd = options.cwd ?? process.cwd();
		this.agentDir = options.agentDir ?? getAgentDir();
	}

	async prompt(
		sessionId: string,
		text: string,
		selection: RuntimeSelection,
		images: ImageContent[] = [],
		binding: RuntimeSessionBinding = {},
	): Promise<void> {
		const record = await this.ensureSession(sessionId, selection, binding);
		record.activePrompts += 1;
		this.setRuntimeState(sessionId, record, createRunningRuntimeState());
		try {
			await this.applySelection(record, selection);
			const promptOptions = record.session.isStreaming
				? {
						streamingBehavior: "steer" as const,
						...(images.length > 0 ? { images } : {}),
					}
				: images.length > 0
					? { images }
					: undefined;
			await record.session.prompt(text, promptOptions);
		} catch (error) {
			if (!this.isAbortLikeError(error)) {
				const message = formatRuntimeError(error);
				this.appendSystemMessage(sessionId, record, message);
				this.applyRecoveryState(sessionId, record, message, "Request failed - ready");
			}
		} finally {
			record.activePrompts = Math.max(0, record.activePrompts - 1);
			this.resetRuntimeStateAfterActivity(sessionId, record);
		}
	}

	async loadSession(
		sessionId: string,
		selection: RuntimeSelection,
		binding: RuntimeSessionBinding = {},
	): Promise<void> {
		await this.ensureSession(sessionId, selection, binding);
	}

	async abort(sessionId: string): Promise<boolean> {
		const record = this.records.get(sessionId);
		if (!record) {
			return false;
		}
		const hasPendingApproval = [...this.pendingApprovals.values()].some((pending) => pending.sessionId === sessionId);
		if (!hasPendingApproval && record.activePrompts === 0) {
			return false;
		}
		record.session.abortCompaction?.();
		await record.session.abort().catch(() => {});
		this.cleanupAfterInterruption(sessionId, record, "Cancelled before completion.");
		this.appendSystemMessage(sessionId, record, "Request interrupted. You can continue with a new prompt.");
		this.setRuntimeState(
			sessionId,
			record,
			createInterruptedRuntimeState("Interrupted - ready", "The current request was cancelled."),
		);
		record.activePrompts = 0;
		return true;
	}

	async compact(
		sessionId: string,
		selection: RuntimeSelection,
		binding: RuntimeSessionBinding = {},
		customInstructions?: string,
	): Promise<boolean> {
		const record = await this.ensureSession(sessionId, selection, binding);
		const compactSession = record.session as AgentSession & {
			compact?: (customInstructions?: string) => Promise<{ tokensBefore?: number }>;
		};

		if (typeof compactSession.compact !== "function") {
			this.appendSystemMessage(sessionId, record, "Manual compaction is not available in the current runtime.");
			this.setRuntimeState(sessionId, record, createErrorRuntimeState("Compaction unavailable - ready"));
			return false;
		}

		record.activePrompts += 1;
		this.setRuntimeState(sessionId, record, createCompactingRuntimeState("Compacting context"));
		try {
			await this.applySelection(record, selection);
			const result = await compactSession.compact(customInstructions);
			this.appendSystemMessage(sessionId, record, formatCompactionResultMessage(result ?? {}));
			this.setRuntimeState(sessionId, record, createIdleRuntimeState());
			return true;
		} catch (error) {
			if (this.isAbortLikeError(error)) {
				this.appendSystemMessage(sessionId, record, "Compaction cancelled.");
				this.setRuntimeState(
					sessionId,
					record,
					createInterruptedRuntimeState("Compaction cancelled - ready", "You can continue with a new prompt."),
				);
				return false;
			}

			const message = formatRuntimeError(error);
			this.appendSystemMessage(sessionId, record, `Compaction failed: ${message}`);
			this.applyRecoveryState(sessionId, record, message, "Compaction failed - ready");
			return false;
		} finally {
			record.activePrompts = Math.max(0, record.activePrompts - 1);
			this.resetRuntimeStateAfterActivity(sessionId, record);
		}
	}

	async syncSelection(sessionId: string, selection: RuntimeSelection): Promise<void> {
		const record = this.records.get(sessionId);
		if (!record) {
			return;
		}
		try {
			await this.applySelection(record, selection);
		} catch (error) {
			const message = formatRuntimeError(error);
			this.appendSystemMessage(sessionId, record, message);
			this.applyRecoveryState(sessionId, record, message, "Selection failed - ready");
		}
	}

	async reload(sessionId: string, selection: RuntimeSelection, binding: RuntimeSessionBinding = {}): Promise<boolean> {
		const record = await this.ensureSession(sessionId, selection, binding);
		const reloadableSession = record.session as AgentSession & { reload?: () => Promise<void> };
		if (typeof reloadableSession.reload !== "function") {
			this.appendSystemMessage(sessionId, record, "Resource reload is not available in the current runtime.");
			this.setRuntimeState(sessionId, record, createErrorRuntimeState("Reload unavailable - ready"));
			return false;
		}

		record.activePrompts += 1;
		this.setRuntimeState(sessionId, record, createRunningRuntimeState("Reloading resources"));
		try {
			await this.applySelection(record, selection);
			await reloadableSession.reload();
			this.setRuntimeState(sessionId, record, createIdleRuntimeState());
			return true;
		} catch (error) {
			const message = formatRuntimeError(error);
			this.appendSystemMessage(sessionId, record, `Reload failed: ${message}`);
			this.applyRecoveryState(sessionId, record, message, "Reload failed - ready");
			return false;
		} finally {
			record.activePrompts = Math.max(0, record.activePrompts - 1);
			this.resetRuntimeStateAfterActivity(sessionId, record);
		}
	}

	setMode(mode: ShellModeId): void {
		this.currentMode = mode;
	}

	dispose(): void {
		for (const [requestId, pendingApproval] of this.pendingApprovals.entries()) {
			pendingApproval.resolve("cancel");
			this.callbacks.closeApproval(pendingApproval.sessionId, requestId);
			this.pendingApprovals.delete(requestId);
		}
		for (const [sessionId, record] of this.records.entries()) {
			record.unsubscribe();
			record.removeBeforeToolCallHook();
			void record.session.abort().catch(() => {});
			record.session.dispose();
			this.records.delete(sessionId);
		}
	}

	private async ensureSession(
		sessionId: string,
		selection: RuntimeSelection,
		binding: RuntimeSessionBinding = {},
	): Promise<RuntimeSessionRecord> {
		const existing = this.records.get(sessionId);
		if (existing) {
			return existing;
		}

		const pending = this.pending.get(sessionId);
		if (pending) {
			return pending;
		}

		const promise = this.createSessionRecord(sessionId, selection, binding)
			.then((record) => {
				this.records.set(sessionId, record);
				return record;
			})
			.finally(() => {
				this.pending.delete(sessionId);
			});

		this.pending.set(sessionId, promise);
		return promise;
	}

	private async createSessionRecord(
		sessionId: string,
		selection: RuntimeSelection,
		binding: RuntimeSessionBinding,
	): Promise<RuntimeSessionRecord> {
		const codingAgent = await loadCodingAgentRuntime();
		const resolved = this.resolveSelection(selection);
		const authStorage = codingAgent.AuthStorage.inMemory();
		const modelRegistry = new codingAgent.ModelRegistry(authStorage, join(this.agentDir, "runtime-models.json"));
		const settingsManager = codingAgent.SettingsManager.inMemory();
		const sessionDir = getRuntimeSessionDir(this.cwd, this.agentDir);
		const sessionManager = binding.runtimeSessionFile
			? codingAgent.SessionManager.open(binding.runtimeSessionFile, sessionDir)
			: codingAgent.SessionManager.create(this.cwd, sessionDir);

		this.registerProfileProvider(modelRegistry, authStorage, resolved.profile, resolved.modelId, resolved.apiKey);

		const model = modelRegistry.find(resolved.profile.id, resolved.modelId);
		if (!model) {
			throw new Error(`Unable to register model ${resolved.modelId} for ${resolved.profile.label}`);
		}

		const { session, modelFallbackMessage } = await codingAgent.createAgentSession({
			cwd: this.cwd,
			agentDir: this.agentDir,
			authStorage,
			modelRegistry,
			settingsManager,
			sessionManager,
			model,
		});

		await session.bindExtensions({
			commandContextActions: {
				waitForIdle: () => session.agent.waitForIdle(),
				newSession: async () => ({ cancelled: true }),
				fork: async () => ({ cancelled: true }),
				navigateTree: async () => ({ cancelled: true }),
				switchSession: async () => ({ cancelled: true }),
				reload: async () => {
					await (session as AgentSession & { reload?: () => Promise<void> }).reload?.();
				},
			},
			onError: (error) => {
				const record = this.records.get(sessionId);
				if (record) {
					this.appendSystemMessage(sessionId, record, `Extension error (${error.extensionPath}): ${error.error}`);
				}
			},
		});

		const record: RuntimeSessionRecord = {
			session,
			unsubscribe: () => {},
			removeBeforeToolCallHook: () => {},
			modelRegistry,
			authStorage,
			activeProfileId: resolved.profile.id,
			activeModelId: resolved.modelId,
			streamingAssistantMessageId: undefined,
			streamingReasoningMessageId: undefined,
			toolMessageIds: new Map(),
			toolStates: new Map(),
			activePrompts: 0,
			runtimeState: createIdleRuntimeState(),
			sequence: 0,
		};

		record.removeBeforeToolCallHook = installBeforeToolCallHook(session, async ({ toolCall, args }, signal) =>
			this.handleApprovalRequest(sessionId, record, toolCall.id, toolCall.name, args, signal),
		);
		record.unsubscribe = session.subscribe((event) => {
			this.handleSessionEvent(sessionId, record, event);
		});

		const runtimeSessionFile = session.sessionManager.getSessionFile();
		if (runtimeSessionFile && runtimeSessionFile !== binding.runtimeSessionFile) {
			this.callbacks.updateSessionBinding(sessionId, { runtimeSessionFile });
		}

		const restoredMessages = this.rehydrateTranscript(record);
		if (restoredMessages.length > 0) {
			this.callbacks.replaceMessages(sessionId, restoredMessages);
		}

		if (modelFallbackMessage) {
			this.appendSystemMessage(sessionId, record, modelFallbackMessage);
		}
		this.callbacks.updateRuntimeState(sessionId, record.runtimeState);

		return record;
	}

	private rehydrateTranscript(record: RuntimeSessionRecord): ChatMessage[] {
		const restored: ChatMessage[] = [];

		for (const message of record.session.state.messages) {
			if (message.role === "user") {
				const text = extractUserText(message);
				const images = extractUserImages(message);
				if (!text && images.length === 0) continue;
				restored.push({
					id: createMessageId(record, "user"),
					role: "user",
					content: text,
					time: formatTime(message.timestamp),
					images,
				});
				continue;
			}

			if (message.role === "assistant") {
				const reasoning = extractAssistantReasoning(message);
				if (reasoning) {
					restored.push({
						id: createMessageId(record, "assistant"),
						role: "assistant",
						content: reasoning,
						time: formatTime(message.timestamp),
						kind: "reasoning",
						collapsible: true,
						expanded: false,
					});
				}

				const content = extractAssistantVisibleText(message);
				if (content) {
					restored.push({
						id: createMessageId(record, "assistant"),
						role: "assistant",
						content,
						time: formatTime(message.timestamp),
					});
				}
				continue;
			}

			if (message.role === "toolResult") {
				const tool = updateToolMessageState(
					createToolMessageState(message.toolCallId, message.toolName, undefined),
					{
						status: message.isError ? "failed" : "completed",
						output: message,
					},
				);
				restored.push({
					id: createMessageId(record, "system"),
					role: "system",
					content: "",
					time: formatTime(message.timestamp),
					kind: "tool",
					collapsible: true,
					expanded: false,
					tool,
				});
			}
		}

		return restored;
	}

	private isAbortLikeError(error: unknown): boolean {
		const message = formatRuntimeError(error).toLowerCase();
		return message.includes("aborted") || message.includes("cancelled") || message.includes("canceled");
	}

	private setRuntimeState(sessionId: string, record: RuntimeSessionRecord, state: RuntimeSessionState): void {
		record.runtimeState = state;
		this.callbacks.updateRuntimeState(sessionId, state);
	}

	private resetRuntimeStateAfterActivity(sessionId: string, record: RuntimeSessionRecord): void {
		if (record.activePrompts > 0) {
			return;
		}
		if (
			record.runtimeState.phase === "running" ||
			record.runtimeState.phase === "retrying" ||
			record.runtimeState.phase === "compacting"
		) {
			this.setRuntimeState(sessionId, record, createIdleRuntimeState());
		}
	}

	private cleanupAfterInterruption(sessionId: string, record: RuntimeSessionRecord, reason: string): void {
		for (const [requestId, pendingApproval] of [...this.pendingApprovals.entries()]) {
			if (pendingApproval.sessionId !== sessionId) {
				continue;
			}
			this.resolveApproval(requestId, "cancel");
		}

		for (const [toolCallId, tool] of record.toolStates.entries()) {
			if (tool.status === "completed" || tool.status === "failed") {
				continue;
			}

			const nextTool = updateToolMessageState(tool, {
				status: "failed",
				output: cancellationToolOutput(reason),
			});
			record.toolStates.set(toolCallId, nextTool);
			const messageId = record.toolMessageIds.get(toolCallId);
			if (messageId) {
				this.callbacks.patchMessage(sessionId, messageId, {
					tool: nextTool,
					time: formatTime(),
				});
			}
		}

		record.toolMessageIds.clear();
		record.toolStates.clear();
		record.streamingAssistantMessageId = undefined;
		record.streamingReasoningMessageId = undefined;
	}

	private resolveSelection(selection: RuntimeSelection): {
		profile: ProviderProfile;
		modelId: string;
		apiKey: string;
	} {
		const profileId = selection.profileId ?? this.profileService.getActiveSelection().profileId;
		if (!profileId) {
			throw new Error("No provider profile selected");
		}

		const profile = this.profileService.getProfile(profileId);
		if (!profile) {
			throw new Error(`Unknown provider profile: ${profileId}`);
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

	private registerProfileProvider(
		modelRegistry: ModelRegistry,
		authStorage: AuthStorage,
		profile: ProviderProfile,
		selectedModelId: string,
		apiKey: string,
	): void {
		authStorage.setRuntimeApiKey(profile.id, apiKey);

		const models = [...profile.models];
		if (!models.some((model) => model.id === selectedModelId)) {
			models.push({
				id: selectedModelId,
				name: selectedModelId,
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

	private async applySelection(record: RuntimeSessionRecord, selection: RuntimeSelection): Promise<void> {
		const resolved = this.resolveSelection(selection);
		if (record.activeProfileId === resolved.profile.id && record.activeModelId === resolved.modelId) {
			return;
		}

		this.registerProfileProvider(
			record.modelRegistry,
			record.authStorage,
			resolved.profile,
			resolved.modelId,
			resolved.apiKey,
		);
		const model = record.modelRegistry.find(resolved.profile.id, resolved.modelId);
		if (!model) {
			throw new Error(`Model ${resolved.modelId} is unavailable for ${resolved.profile.label}`);
		}

		await record.session.setModel(model as Model<any>);
		record.activeProfileId = resolved.profile.id;
		record.activeModelId = resolved.modelId;
	}

	private appendSystemMessage(sessionId: string, record: RuntimeSessionRecord, content: string): void {
		this.callbacks.appendMessage(sessionId, {
			id: createMessageId(record, "system"),
			role: "system",
			content,
			time: formatTime(),
			kind: "status",
		});
	}

	private applyRecoveryState(
		sessionId: string,
		record: RuntimeSessionRecord,
		message: string,
		fallbackLabel: string,
	): void {
		const hint = getRuntimeRecoveryHint(message);
		this.setRuntimeState(sessionId, record, createErrorRuntimeState(hint?.label ?? fallbackLabel, message));
		if (hint?.nextStep) {
			this.appendSystemMessage(sessionId, record, hint.nextStep);
		}
	}

	private appendToolMessage(sessionId: string, record: RuntimeSessionRecord, tool: ToolMessageState): string {
		const id = createMessageId(record, "system");
		this.callbacks.appendMessage(sessionId, {
			id,
			role: "system",
			content: "",
			time: formatTime(),
			kind: "tool",
			collapsible: true,
			expanded: false,
			tool,
		});
		return id;
	}

	private appendReasoningMessage(sessionId: string, record: RuntimeSessionRecord, content: string): void {
		this.callbacks.appendMessage(sessionId, {
			id: createMessageId(record, "assistant"),
			role: "assistant",
			content,
			time: formatTime(),
			kind: "reasoning",
			collapsible: true,
			expanded: false,
		});
	}

	private insertReasoningMessageBefore(
		sessionId: string,
		record: RuntimeSessionRecord,
		beforeMessageId: string,
		content: string,
	): string {
		const id = createMessageId(record, "assistant");
		this.callbacks.insertMessageBefore(sessionId, beforeMessageId, {
			id,
			role: "assistant",
			content,
			time: formatTime(),
			kind: "reasoning",
			collapsible: true,
			expanded: false,
		});
		return id;
	}

	resolveApproval(requestId: string, decision: ToolApprovalDecision): void {
		const pendingApproval = this.pendingApprovals.get(requestId);
		if (!pendingApproval) {
			return;
		}
		this.pendingApprovals.delete(requestId);
		this.callbacks.closeApproval(pendingApproval.sessionId, requestId);
		pendingApproval.resolve(decision);
	}

	private createApprovalId(): string {
		this.approvalSequence += 1;
		return `approval:${this.approvalSequence}`;
	}

	private patchToolState(
		sessionId: string,
		record: RuntimeSessionRecord,
		toolCallId: string,
		toolName: string,
		update: {
			status?: ToolMessageState["status"];
			args?: unknown;
			output?: unknown;
		},
	): void {
		const messageId = record.toolMessageIds.get(toolCallId);
		const currentTool =
			record.toolStates.get(toolCallId) ?? createToolMessageState(toolCallId, toolName, update.args);
		const nextTool = updateToolMessageState(currentTool, update);
		record.toolStates.set(toolCallId, nextTool);
		if (messageId) {
			this.callbacks.patchMessage(sessionId, messageId, {
				tool: nextTool,
			});
		}
	}

	private async handleApprovalRequest(
		sessionId: string,
		record: RuntimeSessionRecord,
		toolCallId: string,
		toolName: string,
		args: unknown,
		signal?: AbortSignal,
	): Promise<{ block?: boolean; reason?: string } | undefined> {
		const request = createToolApprovalRequest(this.createApprovalId(), sessionId, toolCallId, toolName, args);
		if (!request) {
			return undefined;
		}

		if (this.currentMode === "read-only") {
			const reason = `${toolName} was blocked because read-only mode is active.`;
			this.appendSystemMessage(sessionId, record, reason);
			this.patchToolState(sessionId, record, toolCallId, toolName, {
				status: "failed",
				args,
				output: cancellationToolOutput(reason),
			});
			return {
				block: true,
				reason,
			};
		}

		if (this.currentMode === "auto-approve") {
			this.appendSystemMessage(sessionId, record, `Auto-approved ${toolName} in auto-approve mode.`);
			return undefined;
		}

		this.patchToolState(sessionId, record, toolCallId, toolName, {
			status: "awaiting_approval",
			args,
		});
		this.setRuntimeState(sessionId, record, createRunningRuntimeState(`Awaiting approval for ${toolName}`));
		this.callbacks.openApproval(sessionId, request);

		const decision = await new Promise<ToolApprovalDecision>((resolve) => {
			this.pendingApprovals.set(request.id, {
				sessionId,
				resolve,
			});

			if (!signal) {
				return;
			}

			const onAbort = () => {
				if (!this.pendingApprovals.has(request.id)) {
					return;
				}
				this.pendingApprovals.delete(request.id);
				this.callbacks.closeApproval(sessionId, request.id);
				resolve("cancel");
			};

			if (signal.aborted) {
				onAbort();
				return;
			}

			signal.addEventListener("abort", onAbort, { once: true });
		});

		if (decision === "allow") {
			this.patchToolState(sessionId, record, toolCallId, toolName, {
				status: "running",
				args,
			});
			this.setRuntimeState(sessionId, record, createRunningRuntimeState());
			return undefined;
		}

		this.patchToolState(sessionId, record, toolCallId, toolName, {
			status: "failed",
			args,
			output: cancellationToolOutput(toolApprovalDecisionReason(decision, request)),
		});

		return {
			block: true,
			reason: toolApprovalDecisionReason(decision, request),
		};
	}

	private handleSessionEvent(sessionId: string, record: RuntimeSessionRecord, event: AgentSessionEvent): void {
		handleAgentSessionEvent(event, {
			sessionId,
			record,
			callbacks: this.callbacks,
			appendToolMessage: (tool) => this.appendToolMessage(sessionId, record, tool),
			appendReasoningMessage: (content) => this.appendReasoningMessage(sessionId, record, content),
			insertReasoningMessageBefore: (beforeMessageId, content) =>
				this.insertReasoningMessageBefore(sessionId, record, beforeMessageId, content),
			appendSystemMessage: (content) => this.appendSystemMessage(sessionId, record, content),
			applyRecoveryState: (message, fallbackLabel) =>
				this.applyRecoveryState(sessionId, record, message, fallbackLabel),
			setRuntimeState: (state) => this.setRuntimeState(sessionId, record, state),
		});
	}
}
