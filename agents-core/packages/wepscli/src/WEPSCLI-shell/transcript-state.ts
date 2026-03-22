import type { ChatMessage } from "./chat-components.js";
import { toolDetailText, type ToolMessageState } from "./tool-messages.js";

export interface TranscriptMessagePatch {
	content?: string;
	appendContent?: string;
	time?: string;
	tool?: ToolMessageState;
}

function withToolContent(message: ChatMessage): ChatMessage {
	if (message.tool) {
		return {
			...message,
			content: toolDetailText(message.tool),
		};
	}
	return message;
}

export function appendSessionMessage(
	current: Record<string, ChatMessage[]>,
	sessionId: string,
	message: ChatMessage,
): Record<string, ChatMessage[]> {
	const list = current[sessionId] ?? [];
	return {
		...current,
		[sessionId]: [...list, withToolContent(message)].slice(-200),
	};
}

export function insertSessionMessageBefore(
	current: Record<string, ChatMessage[]>,
	sessionId: string,
	beforeMessageId: string,
	message: ChatMessage,
): Record<string, ChatMessage[]> {
	const list = current[sessionId] ?? [];
	const index = list.findIndex((item) => item.id === beforeMessageId);
	if (index === -1) {
		return appendSessionMessage(current, sessionId, message);
	}
	return {
		...current,
		[sessionId]: [...list.slice(0, index), withToolContent(message), ...list.slice(index)].slice(-200),
	};
}

export function patchSessionMessage(
	current: Record<string, ChatMessage[]>,
	sessionId: string,
	messageId: string,
	patch: TranscriptMessagePatch,
): { messagesBySession: Record<string, ChatMessage[]>; patchedMessage?: ChatMessage } {
	const list = current[sessionId] ?? [];
	let patchedMessage: ChatMessage | undefined;

	const next = list.map((message) => {
		if (message.id !== messageId) {
			return message;
		}
		const updated = withToolContent({
			...message,
			content: patch.appendContent ? `${message.content}${patch.appendContent}` : patch.content ?? message.content,
			time: patch.time ?? message.time,
			tool: patch.tool ?? message.tool,
		});
		patchedMessage = updated;
		return updated;
	});

	return {
		messagesBySession: {
			...current,
			[sessionId]: next,
		},
		patchedMessage,
	};
}

export function toggleSessionMessage(
	current: Record<string, ChatMessage[]>,
	sessionId: string,
	messageId: string,
): Record<string, ChatMessage[]> {
	const list = current[sessionId] ?? [];
	return {
		...current,
		[sessionId]: list.map((message) =>
			message.id === messageId && message.collapsible
				? {
						...message,
						expanded: !message.expanded,
					}
				: message,
		),
	};
}
