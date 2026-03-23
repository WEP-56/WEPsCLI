import { join } from "node:path";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import type { AssistantMessage, UserMessage } from "@mariozechner/pi-ai";
import type { DiscoveredModel } from "../provider-profiles/index.js";
import type { ChatImageAttachment } from "./image-attachments.js";
import { imageAttachmentsFromMessageContent } from "./image-attachments.js";
import type {
	BeforeToolCallHandler,
	CodingAgentRuntime,
	ProviderModelDefinition,
	RuntimeSessionRecord,
} from "./agent-runtime-types.js";
import type { ChatMessage } from "./chat-components.js";

let codingAgentRuntimePromise: Promise<CodingAgentRuntime> | undefined;

export async function loadCodingAgentRuntime(): Promise<CodingAgentRuntime> {
	if (!codingAgentRuntimePromise) {
		codingAgentRuntimePromise = import("@mariozechner/pi-coding-agent").then((module) => module as CodingAgentRuntime);
	}
	return codingAgentRuntimePromise;
}

export function formatTime(timestamp?: number): string {
	return new Date(timestamp ?? Date.now()).toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function createMessageId(record: RuntimeSessionRecord, role: ChatMessage["role"]): string {
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

function extractTextBlocks(
	content: Array<{ type: string; [key: string]: unknown }>,
	options: {
		includeImages?: boolean;
	} = {},
): string {
	const includeImages = options.includeImages ?? true;

	return content
		.map((item) => {
			if (item.type === "text" && typeof item.text === "string") {
				return item.text;
			}
			if (includeImages && item.type === "image") {
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

function summarizeSkillBlock(text: string): string | undefined {
	const match = text.match(/^<skill name="([^"]+)" location="([^"]+)">\n[\s\S]*?\n<\/skill>(?:\n\n([\s\S]+))?$/);
	if (!match) {
		return undefined;
	}

	const skillName = match[1];
	const userMessage = match[3]?.trim();
	return userMessage ? `/skill:${skillName}\n${userMessage}` : `/skill:${skillName}`;
}

export function extractUserText(message: UserMessage): string {
	const content =
		typeof message.content === "string"
			? message.content
			: extractTextBlocks(
					message.content as unknown as Array<{ type: string; [key: string]: unknown }>,
					{ includeImages: false },
				);
	return summarizeSkillBlock(content) ?? content;
}

export function extractUserImages(message: UserMessage): ChatImageAttachment[] {
	if (typeof message.content === "string") {
		return [];
	}

	return imageAttachmentsFromMessageContent(
		message.content as unknown as Array<{ type?: string; mimeType?: string }>,
	);
}

export function extractAssistantVisibleText(message: AssistantMessage): string {
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

export function extractAssistantReasoning(message: AssistantMessage): string {
	return extractTextBlocks(
		message.content
			.filter((item): item is Extract<AssistantMessage["content"][number], { type: "thinking" }> => item.type === "thinking")
			.map((item) => ({ type: item.type, thinking: item.thinking })),
	);
}

export function formatRuntimeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function formatCompactionResultMessage(result: { tokensBefore?: number }): string {
	if (typeof result.tokensBefore === "number" && Number.isFinite(result.tokensBefore)) {
		return `Context compacted from ${result.tokensBefore.toLocaleString("en-US")} tokens.`;
	}
	return "Context compacted.";
}

export function cancellationToolOutput(reason: string): { content: Array<{ type: "text"; text: string }> } {
	return {
		content: [{ type: "text", text: reason }],
	};
}

export function toModelDefinition(model: DiscoveredModel): ProviderModelDefinition {
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

export function getRuntimeSessionDir(cwd: string, agentDir: string): string {
	const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
	return join(agentDir, "sessions", safePath);
}

export function installBeforeToolCallHook(session: AgentSession, handler: BeforeToolCallHandler): () => void {
	if (typeof session.addBeforeToolCall === "function") {
		return session.addBeforeToolCall(handler);
	}

	if (typeof session.agent?.setBeforeToolCall === "function") {
		session.agent.setBeforeToolCall(handler);
		return () => {
			session.agent.setBeforeToolCall?.(undefined);
		};
	}

	throw new Error("The installed pi-coding-agent runtime does not expose a before-tool-call hook API.");
}
