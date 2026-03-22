declare module "@mariozechner/pi-ai" {
	export type Api = string;

	export interface TextContent {
		type: "text";
		text: string;
	}

	export interface ThinkingContent {
		type: "thinking";
		thinking: string;
		thinkingSignature?: string;
		redacted?: boolean;
	}

	export interface ImageContent {
		type: "image";
		data: string;
		mimeType: string;
	}

	export interface ToolCall {
		type: "toolCall";
		id: string;
		name: string;
		arguments: Record<string, any>;
		thoughtSignature?: string;
	}

	export interface Usage {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		totalTokens: number;
		cost: {
			input: number;
			output: number;
			cacheRead: number;
			cacheWrite: number;
			total: number;
		};
	}

	export interface UserMessage {
		role: "user";
		content: string | (TextContent | ImageContent)[];
		timestamp: number;
	}

	export interface AssistantMessage {
		role: "assistant";
		content: (TextContent | ThinkingContent | ToolCall)[];
		api: Api;
		provider: string;
		model: string;
		usage: Usage;
		stopReason: "stop" | "length" | "toolUse" | "error" | "aborted";
		errorMessage?: string;
		timestamp: number;
	}

	export interface ToolResultMessage<TDetails = any> {
		role: "toolResult";
		toolCallId: string;
		toolName: string;
		content: (TextContent | ImageContent)[];
		details?: TDetails;
		isError: boolean;
		timestamp: number;
	}

	export interface Model<TApi extends Api = Api> {
		id: string;
		name: string;
		api: TApi;
		provider: string;
		baseUrl: string;
		reasoning: boolean;
		input: ("text" | "image")[];
		cost: {
			input: number;
			output: number;
			cacheRead: number;
			cacheWrite: number;
		};
		contextWindow: number;
		maxTokens: number;
		headers?: Record<string, string>;
		compat?: unknown;
	}

	export type AssistantMessageEvent =
		| { type: "start"; partial: AssistantMessage }
		| { type: "text_start"; contentIndex: number; partial: AssistantMessage }
		| { type: "text_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
		| { type: "text_end"; contentIndex: number; content: string; partial: AssistantMessage }
		| { type: "thinking_start"; contentIndex: number; partial: AssistantMessage }
		| { type: "thinking_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
		| { type: "thinking_end"; contentIndex: number; content: string; partial: AssistantMessage }
		| { type: "toolcall_start"; contentIndex: number; partial: AssistantMessage }
		| { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
		| { type: "toolcall_end"; contentIndex: number; toolCall: ToolCall; partial: AssistantMessage }
		| { type: "done"; reason: "stop" | "length" | "toolUse"; message: AssistantMessage }
		| { type: "error"; reason: "aborted" | "error"; error: AssistantMessage };
}

declare module "@mariozechner/pi-coding-agent" {
	import type { AssistantMessage, AssistantMessageEvent, Model, ToolResultMessage, UserMessage } from "@mariozechner/pi-ai";

	export interface ExtensionError {
		extensionPath: string;
		error: string;
	}

	export interface PromptOptions {
		expandPromptTemplates?: boolean;
		images?: unknown[];
		streamingBehavior?: "steer" | "followUp";
		source?: "interactive" | "rpc" | "extension";
	}

	export type AgentSessionEvent =
		| { type: "message_start"; message: UserMessage | AssistantMessage | ToolResultMessage }
		| { type: "message_update"; message: AssistantMessage; assistantMessageEvent: AssistantMessageEvent }
		| { type: "message_end"; message: UserMessage | AssistantMessage | ToolResultMessage }
		| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
		| { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
		| { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean }
		| { type: "auto_compaction_start"; reason: "threshold" | "overflow" }
		| {
				type: "auto_compaction_end";
				result: unknown;
				aborted: boolean;
				willRetry: boolean;
				errorMessage?: string;
		  }
		| { type: "auto_retry_start"; attempt: number; maxAttempts: number; delayMs: number; errorMessage: string }
		| { type: "auto_retry_end"; success: boolean; attempt: number; finalError?: string }
		| { type: "agent_start" }
		| { type: "agent_end"; messages: Array<UserMessage | AssistantMessage | ToolResultMessage> }
		| { type: "turn_start" }
		| { type: "turn_end"; message: UserMessage | AssistantMessage | ToolResultMessage; toolResults: ToolResultMessage[] };

	export interface AgentSession {
		readonly agent: {
			waitForIdle(): Promise<void>;
		};
		readonly sessionManager: {
			getSessionFile(): string | undefined;
			getSessionId(): string;
		};
		readonly state: {
			messages: Array<UserMessage | AssistantMessage | ToolResultMessage>;
		};
		readonly isStreaming: boolean;
		addBeforeToolCall(
			handler: (
				context: {
					toolCall: { id: string; name: string; arguments: unknown };
					args: unknown;
				},
				signal?: AbortSignal,
			) => Promise<{ block?: boolean; reason?: string } | undefined>,
		): () => void;
		prompt(text: string, options?: PromptOptions): Promise<void>;
		setModel(model: Model<any>): Promise<void>;
		bindExtensions(bindings: {
			commandContextActions: {
				waitForIdle: () => Promise<void>;
				newSession: (
					options?: {
						parentSession?: string;
						setup?: (sessionManager: SessionManager) => Promise<void>;
					},
				) => Promise<{ cancelled: boolean }>;
				fork: (entryId: string) => Promise<{ cancelled: boolean }>;
				navigateTree: (
					targetId: string,
					options?: {
						summarize?: boolean;
						customInstructions?: string;
						replaceInstructions?: boolean;
						label?: string;
					},
				) => Promise<{ cancelled: boolean }>;
				switchSession: (sessionPath: string) => Promise<{ cancelled: boolean }>;
				reload: () => Promise<void>;
			};
			onError?: (error: ExtensionError) => void;
		}): Promise<void>;
		subscribe(listener: (event: AgentSessionEvent) => void): () => void;
		abort(): Promise<void>;
		abortCompaction?(): void;
		dispose(): void;
	}

	export class AuthStorage {
		static inMemory(data?: Record<string, unknown>): AuthStorage;
		setRuntimeApiKey(provider: string, apiKey: string): void;
	}

	export class ModelRegistry {
		constructor(authStorage: AuthStorage, modelsJsonPath?: string);
		find(provider: string, modelId: string): Model<any> | undefined;
		registerProvider(
			name: string,
			config: {
				baseUrl?: string;
				apiKey?: string;
				api?: string;
				headers?: Record<string, string>;
				authHeader?: boolean;
				models?: Array<{
					id: string;
					name: string;
					reasoning: boolean;
					input: ("text" | "image")[];
					cost: {
						input: number;
						output: number;
						cacheRead: number;
						cacheWrite: number;
					};
					contextWindow: number;
					maxTokens: number;
					headers?: Record<string, string>;
					compat?: unknown;
				}>;
			},
		): void;
	}

	export class SessionManager {
		static create(cwd: string, sessionDir?: string): SessionManager;
		static open(path: string, sessionDir?: string): SessionManager;
		static inMemory(cwd?: string): SessionManager;
	}

	export class SettingsManager {
		static inMemory(settings?: Record<string, unknown>): SettingsManager;
	}

	export function createAgentSession(options?: {
		cwd?: string;
		agentDir?: string;
		authStorage?: AuthStorage;
		modelRegistry?: ModelRegistry;
		model?: Model<any>;
		settingsManager?: SettingsManager;
		sessionManager?: SessionManager;
	}): Promise<{
		session: AgentSession;
		modelFallbackMessage?: string;
	}>;
}
