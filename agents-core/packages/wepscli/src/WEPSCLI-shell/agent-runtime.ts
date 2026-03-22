import { join } from "node:path";
import type {
	AuthStorage,
	AgentSession,
	AgentSessionEvent,
	ModelRegistry,
	SessionManager,
	SettingsManager,
} from "@mariozechner/pi-coding-agent";
import type { AssistantMessage, Model, UserMessage } from "@mariozechner/pi-ai";
import { getAgentDir } from "../config.js";
import type { DiscoveredModel, ProviderProfile, ProviderProfileService } from "../provider-profiles/index.js";
import type { ChatMessage } from "./chat-components.js";
import {
	createCompactingRuntimeState,
	createErrorRuntimeState,
	createIdleRuntimeState,
	createInterruptedRuntimeState,
	createRetryingRuntimeState,
	createRunningRuntimeState,
	type RuntimeSessionState,
} from "./runtime-status.js";
import type { TranscriptMessagePatch } from "./transcript-state.js";
import {
	createToolApprovalRequest,
	toolApprovalDecisionReason,
	type ToolApprovalDecision,
	type ToolApprovalRequest,
} from "./tool-approval.js";
import { createToolMessageState, updateToolMessageState, type ToolMessageState } from "./tool-messages.js";

export interface RuntimeSelection {
	profileId?: string;
	modelId?: string;
}

interface RuntimeCallbacks {
	appendMessage(sessionId: string, message: ChatMessage): void;
	insertMessageBefore(sessionId: string, beforeMessageId: string, message: ChatMessage): void;
	replaceMessages(sessionId: string, messages: ChatMessage[]): void;
	patchMessage(sessionId: string, messageId: string, patch: TranscriptMessagePatch): void;
	openApproval(sessionId: string, request: ToolApprovalRequest): void;
	closeApproval(sessionId: string, requestId: string): void;
	updateRuntimeState(sessionId: string, state: RuntimeSessionState): void;
	updateSessionBinding(sessionId: string, binding: { runtimeSessionFile?: string }): void;
}

interface RuntimeSessionRecord {
	session: AgentSession;
	unsubscribe: () => void;
	removeBeforeToolCallHook: () => void;
	modelRegistry: ModelRegistry;
	authStorage: AuthStorage;
	activeProfileId?: string;
	activeModelId?: string;
	streamingAssistantMessageId?: string;
	streamingReasoningMessageId?: string;
	toolMessageIds: Map<string, string>;
	toolStates: Map<string, ToolMessageState>;
	activePrompts: number;
	runtimeState: RuntimeSessionState;
	sequence: number;
}

interface PendingApprovalRecord {
	sessionId: string;
	resolve: (decision: ToolApprovalDecision) => void;
}

interface RuntimeSessionBinding {
	runtimeSessionFile?: string;
}

type ProviderRegistrationConfig = Parameters<ModelRegistry["registerProvider"]>[1];
type ProviderModelDefinition = NonNullable<ProviderRegistrationConfig["models"]>[number];
type CodingAgentRuntime = {
	AuthStorage: typeof import("@mariozechner/pi-coding-agent").AuthStorage;
	createAgentSession: typeof import("@mariozechner/pi-coding-agent").createAgentSession;
	ModelRegistry: typeof import("@mariozechner/pi-coding-agent").ModelRegistry;
	SessionManager: typeof import("@mariozechner/pi-coding-agent").SessionManager;
	SettingsManager: typeof import("@mariozechner/pi-coding-agent").SettingsManager;
};

let codingAgentRuntimePromise: Promise<CodingAgentRuntime> | undefined;

async function loadCodingAgentRuntime(): Promise<CodingAgentRuntime> {
	if (!codingAgentRuntimePromise) {
		codingAgentRuntimePromise = import("@mariozechner/pi-coding-agent")
			.then((module) => module as CodingAgentRuntime)
			.catch(async () => (await import(new URL("../../../coding-agent/dist/index.js", import.meta.url).href)) as CodingAgentRuntime);
	}
	return codingAgentRuntimePromise;
}

function formatTime(timestamp?: number): string {
	return new Date(timestamp ?? Date.now()).toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function createMessageId(record: RuntimeSessionRecord, role: ChatMessage["role"]): string {
	record.sequence += 1;
	return `runtime:${role}:${record.sequence}`;
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

function extractTextBlocks(content: Array<{ type: string; [key: string]: unknown }>): string {
	return content
		.map((item) => {
			if (item.type === "text" && typeof item.text === "string") {
				return item.text;
			}
			if (item.type === "image") {
				return "[image]";
			}
			if (item.type === "thinking" && typeof item.thinking === "string") {
				return item.thinking;
			}
			return "";
		})
		.filter(Boolean)
		.join("\n\n");
}

function extractUserText(message: UserMessage): string {
	if (typeof message.content === "string") {
		return message.content;
	}
	return extractTextBlocks(message.content as unknown as Array<{ type: string; [key: string]: unknown }>);
}

function extractAssistantVisibleText(message: AssistantMessage): string {
	const text = extractTextBlocks(
		message.content
			.filter((item): item is Extract<AssistantMessage["content"][number], { type: "text" }> => item.type === "text")
			.map((item) => ({ type: item.type, text: item.text })),
	);
	if (text) {
		return text;
	}
	if (message.errorMessage) {
		return message.errorMessage;
	}
	return "";
}

function extractAssistantReasoning(message: AssistantMessage): string {
	return extractTextBlocks(
		message.content
			.filter((item): item is Extract<AssistantMessage["content"][number], { type: "thinking" }> => item.type === "thinking")
			.map((item) => ({ type: item.type, thinking: item.thinking })),
	);
}

function formatRuntimeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function toModelDefinition(model: DiscoveredModel): ProviderModelDefinition {
	return {
		id: model.id,
		name: model.name,
		reasoning: guessReasoningSupport(model.id),
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 16_384,
	};
}

function getRuntimeSessionDir(cwd: string, agentDir: string): string {
	const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
	return join(agentDir, "sessions", safePath);
}

export class WepsAgentRuntime {
	private readonly records = new Map<string, RuntimeSessionRecord>();
	private readonly pending = new Map<string, Promise<RuntimeSessionRecord>>();
	private readonly pendingApprovals = new Map<string, PendingApprovalRecord>();
	private readonly cwd: string;
	private readonly agentDir: string;
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
		binding: RuntimeSessionBinding = {},
	): Promise<void> {
		const record = await this.ensureSession(sessionId, selection, binding);
		record.activePrompts += 1;
		this.setRuntimeState(sessionId, record, createRunningRuntimeState());
		try {
			await this.applySelection(record, selection);
			await record.session.prompt(text, record.session.isStreaming ? { streamingBehavior: "steer" } : undefined);
		} catch (error) {
			if (!this.isAbortLikeError(error)) {
				const message = formatRuntimeError(error);
				this.appendSystemMessage(sessionId, record, message);
				this.setRuntimeState(sessionId, record, createErrorRuntimeState("Request failed · ready", message));
			}
		} finally {
			record.activePrompts = Math.max(0, record.activePrompts - 1);
			this.resetRuntimeStateAfterActivity(sessionId, record);
		}
	}

	async loadSession(sessionId: string, selection: RuntimeSelection, binding: RuntimeSessionBinding = {}): Promise<void> {
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
		this.appendSystemMessage(sessionId, record, "Request interrupted. You can continue with a new prompt.");
		this.setRuntimeState(
			sessionId,
			record,
			createInterruptedRuntimeState("Interrupted · ready", "The current request was cancelled."),
		);
		record.activePrompts = 0;
		return true;
	}

	async syncSelection(sessionId: string, selection: RuntimeSelection): Promise<void> {
		const record = this.records.get(sessionId);
		if (!record) {
			return;
		}
		try {
			await this.applySelection(record, selection);
		} catch (error) {
			this.appendSystemMessage(sessionId, record, formatRuntimeError(error));
		}
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
				reload: async () => {},
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

		record.removeBeforeToolCallHook = session.addBeforeToolCall(async ({ toolCall, args }, signal) =>
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
				if (!text) continue;
				restored.push({
					id: createMessageId(record, "user"),
					role: "user",
					content: text,
					time: formatTime(message.timestamp),
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
		if (record.runtimeState.phase === "running" || record.runtimeState.phase === "retrying" || record.runtimeState.phase === "compacting") {
			this.setRuntimeState(sessionId, record, createIdleRuntimeState());
		}
	}

	private resolveSelection(selection: RuntimeSelection): { profile: ProviderProfile; modelId: string; apiKey: string } {
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

		this.registerProfileProvider(record.modelRegistry, record.authStorage, resolved.profile, resolved.modelId, resolved.apiKey);
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
		const currentTool = record.toolStates.get(toolCallId) ?? createToolMessageState(toolCallId, toolName, update.args);
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

		this.patchToolState(sessionId, record, toolCallId, toolName, {
			status: "awaiting_approval",
			args,
		});
		this.setRuntimeState(
			sessionId,
			record,
			createRunningRuntimeState(`Awaiting approval for ${toolName}`),
		);
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

		return {
			block: true,
			reason: toolApprovalDecisionReason(decision, request),
		};
	}

	private handleSessionEvent(sessionId: string, record: RuntimeSessionRecord, event: AgentSessionEvent): void {
		switch (event.type) {
			case "message_start":
				if (event.message.role === "user") {
					const text = extractUserText(event.message as UserMessage);
					if (text) {
						this.callbacks.appendMessage(sessionId, {
							id: createMessageId(record, "user"),
							role: "user",
							content: text,
							time: formatTime((event.message as UserMessage).timestamp),
						});
					}
					return;
				}

				if (event.message.role === "assistant") {
					record.streamingAssistantMessageId = undefined;
					record.streamingReasoningMessageId = undefined;
				}
				return;

			case "message_update":
				if (event.assistantMessageEvent.type === "thinking_delta") {
					if (!record.streamingReasoningMessageId) {
						record.streamingReasoningMessageId = record.streamingAssistantMessageId
							? this.insertReasoningMessageBefore(
									sessionId,
									record,
									record.streamingAssistantMessageId,
									event.assistantMessageEvent.delta,
								)
							: (() => {
									const id = createMessageId(record, "assistant");
									this.callbacks.appendMessage(sessionId, {
										id,
										role: "assistant",
										content: event.assistantMessageEvent.delta,
										time: formatTime(),
										kind: "reasoning",
										collapsible: true,
										expanded: false,
									});
									return id;
								})();
						return;
					}
					this.callbacks.patchMessage(sessionId, record.streamingReasoningMessageId, {
						appendContent: event.assistantMessageEvent.delta,
					});
					return;
				}

				if (event.assistantMessageEvent.type === "text_delta" && record.streamingAssistantMessageId) {
					this.callbacks.patchMessage(sessionId, record.streamingAssistantMessageId, {
						appendContent: event.assistantMessageEvent.delta,
					});
					return;
				}
				if (event.assistantMessageEvent.type === "text_delta") {
					const messageId = createMessageId(record, "assistant");
					record.streamingAssistantMessageId = messageId;
					this.callbacks.appendMessage(sessionId, {
						id: messageId,
						role: "assistant",
						content: event.assistantMessageEvent.delta,
						time: formatTime(),
					});
				}
				return;

			case "message_end":
				if (event.message.role === "assistant") {
					const finalMessage = event.message as AssistantMessage;
					const content = extractAssistantVisibleText(finalMessage);
					const reasoning = extractAssistantReasoning(finalMessage);
					const messageId = record.streamingAssistantMessageId;
					const reasoningMessageId = record.streamingReasoningMessageId;
					record.streamingAssistantMessageId = undefined;
					record.streamingReasoningMessageId = undefined;
					if (messageId) {
						this.callbacks.patchMessage(sessionId, messageId, {
							content,
							time: formatTime(finalMessage.timestamp),
						});
					} else if (content) {
						this.callbacks.appendMessage(sessionId, {
							id: createMessageId(record, "assistant"),
							role: "assistant",
							content,
							time: formatTime(finalMessage.timestamp),
						});
					}
					if (reasoning) {
						if (reasoningMessageId) {
							this.callbacks.patchMessage(sessionId, reasoningMessageId, {
								content: reasoning,
								time: formatTime(finalMessage.timestamp),
							});
						} else if (messageId) {
							this.insertReasoningMessageBefore(sessionId, record, messageId, reasoning);
						} else {
							this.appendReasoningMessage(sessionId, record, reasoning);
						}
					}
					if (finalMessage.stopReason === "aborted") {
						this.setRuntimeState(
							sessionId,
							record,
							createInterruptedRuntimeState("Interrupted · ready", "The current request was cancelled."),
						);
					} else if (finalMessage.stopReason === "error" && finalMessage.errorMessage) {
						this.setRuntimeState(
							sessionId,
							record,
							createErrorRuntimeState("Request failed · ready", finalMessage.errorMessage),
						);
					}
				}
				return;

			case "tool_execution_start": {
				const tool = createToolMessageState(event.toolCallId, event.toolName, event.args);
				const messageId = this.appendToolMessage(sessionId, record, tool);
				record.toolMessageIds.set(event.toolCallId, messageId);
				record.toolStates.set(event.toolCallId, tool);
				return;
			}

			case "tool_execution_update": {
				const messageId = record.toolMessageIds.get(event.toolCallId);
				const tool = record.toolStates.get(event.toolCallId);
				if (!messageId || !tool) {
					return;
				}
				const nextTool = updateToolMessageState(tool, {
					args: event.args,
					output: event.partialResult,
				});
				record.toolStates.set(event.toolCallId, nextTool);
				this.callbacks.patchMessage(sessionId, messageId, {
					tool: nextTool,
				});
				return;
			}

			case "tool_execution_end": {
				const messageId = record.toolMessageIds.get(event.toolCallId);
				const tool = record.toolStates.get(event.toolCallId);
				record.toolMessageIds.delete(event.toolCallId);
				record.toolStates.delete(event.toolCallId);
				const nextTool = updateToolMessageState(
					tool ?? createToolMessageState(event.toolCallId, event.toolName, undefined),
					{
						status: event.isError ? "failed" : "completed",
						output: event.result,
					},
				);
				if (messageId) {
					this.callbacks.patchMessage(sessionId, messageId, {
						tool: nextTool,
						time: formatTime(),
					});
					return;
				}
				this.appendToolMessage(sessionId, record, nextTool);
				return;
			}

			case "auto_compaction_start":
				this.setRuntimeState(
					sessionId,
					record,
					createCompactingRuntimeState(
						event.reason === "overflow" ? "Compacting after overflow" : "Compacting context",
					),
				);
				this.appendSystemMessage(sessionId, record, "Compacting context...");
				return;

			case "auto_compaction_end":
				if (event.errorMessage) {
					this.setRuntimeState(
						sessionId,
						record,
						createErrorRuntimeState("Compaction failed · ready", event.errorMessage),
					);
				} else if (event.aborted) {
					this.setRuntimeState(
						sessionId,
						record,
						createInterruptedRuntimeState("Compaction cancelled · ready", "You can continue with a new prompt."),
					);
				} else if (event.willRetry) {
					this.setRuntimeState(
						sessionId,
						record,
						createRetryingRuntimeState("Retrying after compaction"),
					);
				} else if (record.activePrompts > 0) {
					this.setRuntimeState(sessionId, record, createRunningRuntimeState());
				}
				this.appendSystemMessage(
					sessionId,
					record,
					event.errorMessage
						? `Compaction failed: ${event.errorMessage}`
						: event.aborted
							? "Compaction aborted."
							: event.result
								? "Context compacted."
								: "Compaction skipped.",
				);
				return;

			case "auto_retry_start":
				this.setRuntimeState(
					sessionId,
					record,
					createRetryingRuntimeState(
						`Retrying (${event.attempt}/${event.maxAttempts})`,
						event.errorMessage,
					),
				);
				this.appendSystemMessage(
					sessionId,
					record,
					`Retrying request (${event.attempt}/${event.maxAttempts}) after error: ${event.errorMessage}`,
				);
				return;

			case "auto_retry_end":
				if (!event.success) {
					const finalError = event.finalError ?? "Retry cancelled";
					this.setRuntimeState(
						sessionId,
						record,
						finalError.toLowerCase().includes("cancel")
							? createInterruptedRuntimeState("Retry cancelled · ready", finalError)
							: createErrorRuntimeState("Retry failed · ready", finalError),
					);
					this.appendSystemMessage(sessionId, record, `Retry failed: ${finalError}`);
				} else if (record.activePrompts > 0) {
					this.setRuntimeState(sessionId, record, createRunningRuntimeState());
				}
				return;

			default:
				return;
		}
	}
}
