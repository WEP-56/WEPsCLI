import type { AgentSession, AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { ChatMessage } from "./chat-components.js";
import type { RuntimeSessionState } from "./runtime-status.js";
import type { ToolApprovalDecision, ToolApprovalRequest } from "./tool-approval.js";
import type { ToolMessageState } from "./tool-messages.js";
import type { TranscriptMessagePatch } from "./transcript-state.js";

export interface RuntimeSelection {
	profileId?: string;
	modelId?: string;
}

export interface RuntimeCallbacks {
	appendMessage(sessionId: string, message: ChatMessage): void;
	insertMessageBefore(sessionId: string, beforeMessageId: string, message: ChatMessage): void;
	replaceMessages(sessionId: string, messages: ChatMessage[]): void;
	patchMessage(sessionId: string, messageId: string, patch: TranscriptMessagePatch): void;
	openApproval(sessionId: string, request: ToolApprovalRequest): void;
	closeApproval(sessionId: string, requestId: string): void;
	updateRuntimeState(sessionId: string, state: RuntimeSessionState): void;
	updateSessionBinding(sessionId: string, binding: { runtimeSessionFile?: string }): void;
}

export interface RuntimeSessionRecord {
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

export interface PendingApprovalRecord {
	sessionId: string;
	resolve: (decision: ToolApprovalDecision) => void;
}

export interface RuntimeSessionBinding {
	runtimeSessionFile?: string;
}

export type BeforeToolCallHandler = (
	context: {
		toolCall: { id: string; name: string; arguments: unknown };
		args: unknown;
	},
	signal?: AbortSignal,
) => Promise<{ block?: boolean; reason?: string } | undefined>;

export type ProviderRegistrationConfig = Parameters<ModelRegistry["registerProvider"]>[1];
export type ProviderModelDefinition = NonNullable<ProviderRegistrationConfig["models"]>[number];

export type CodingAgentRuntime = {
	AuthStorage: typeof import("@mariozechner/pi-coding-agent").AuthStorage;
	createAgentSession: typeof import("@mariozechner/pi-coding-agent").createAgentSession;
	ModelRegistry: typeof import("@mariozechner/pi-coding-agent").ModelRegistry;
	SessionManager: typeof import("@mariozechner/pi-coding-agent").SessionManager;
	SettingsManager: typeof import("@mariozechner/pi-coding-agent").SettingsManager;
};
