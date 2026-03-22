import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import type { AssistantMessage, UserMessage } from "@mariozechner/pi-ai";
import {
	createCompactingRuntimeState,
	createErrorRuntimeState,
	createInterruptedRuntimeState,
	createRetryingRuntimeState,
	createRunningRuntimeState,
	type RuntimeSessionState,
} from "./runtime-status.js";
import { getRuntimeRecoveryHint } from "./runtime-recovery.js";
import type { RuntimeCallbacks, RuntimeSessionRecord } from "./agent-runtime-types.js";
import {
	createMessageId,
	extractAssistantReasoning,
	extractAssistantVisibleText,
	extractUserText,
	formatTime,
} from "./agent-runtime-helpers.js";
import { createToolMessageState, updateToolMessageState, type ToolMessageState } from "./tool-messages.js";

export interface AgentRuntimeEventHandlerContext {
	sessionId: string;
	record: RuntimeSessionRecord;
	callbacks: RuntimeCallbacks;
	appendToolMessage: (tool: ToolMessageState) => string;
	appendReasoningMessage: (content: string) => void;
	insertReasoningMessageBefore: (beforeMessageId: string, content: string) => string;
	appendSystemMessage: (content: string) => void;
	applyRecoveryState: (message: string, fallbackLabel: string) => void;
	setRuntimeState: (state: RuntimeSessionState) => void;
}

export function handleAgentSessionEvent(
	event: AgentSessionEvent,
	context: AgentRuntimeEventHandlerContext,
): void {
	const { sessionId, record, callbacks } = context;

	switch (event.type) {
		case "message_start":
			if (event.message.role === "user") {
				const text = extractUserText(event.message as UserMessage);
				if (text) {
					callbacks.appendMessage(sessionId, {
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
						? context.insertReasoningMessageBefore(
								record.streamingAssistantMessageId,
								event.assistantMessageEvent.delta,
							)
						: (() => {
								const id = createMessageId(record, "assistant");
								callbacks.appendMessage(sessionId, {
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
				callbacks.patchMessage(sessionId, record.streamingReasoningMessageId, {
					appendContent: event.assistantMessageEvent.delta,
				});
				return;
			}

			if (event.assistantMessageEvent.type === "text_delta" && record.streamingAssistantMessageId) {
				callbacks.patchMessage(sessionId, record.streamingAssistantMessageId, {
					appendContent: event.assistantMessageEvent.delta,
				});
				return;
			}
			if (event.assistantMessageEvent.type === "text_delta") {
				const messageId = createMessageId(record, "assistant");
				record.streamingAssistantMessageId = messageId;
				callbacks.appendMessage(sessionId, {
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
					callbacks.patchMessage(sessionId, messageId, {
						content,
						time: formatTime(finalMessage.timestamp),
					});
				} else if (content) {
					callbacks.appendMessage(sessionId, {
						id: createMessageId(record, "assistant"),
						role: "assistant",
						content,
						time: formatTime(finalMessage.timestamp),
					});
				}
				if (reasoning) {
					if (reasoningMessageId) {
						callbacks.patchMessage(sessionId, reasoningMessageId, {
							content: reasoning,
							time: formatTime(finalMessage.timestamp),
						});
					} else if (messageId) {
						context.insertReasoningMessageBefore(messageId, reasoning);
					} else {
						context.appendReasoningMessage(reasoning);
					}
				}
				if (finalMessage.stopReason === "aborted") {
					context.setRuntimeState(
						createInterruptedRuntimeState("Interrupted - ready", "The current request was cancelled."),
					);
				} else if (finalMessage.stopReason === "error" && finalMessage.errorMessage) {
					context.applyRecoveryState(finalMessage.errorMessage, "Request failed - ready");
				}
			}
			return;

		case "tool_execution_start": {
			const tool = createToolMessageState(event.toolCallId, event.toolName, event.args);
			const messageId = context.appendToolMessage(tool);
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
			callbacks.patchMessage(sessionId, messageId, {
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
				callbacks.patchMessage(sessionId, messageId, {
					tool: nextTool,
					time: formatTime(),
				});
				return;
			}
			context.appendToolMessage(nextTool);
			return;
		}

		case "auto_compaction_start":
			context.setRuntimeState(
				createCompactingRuntimeState(
					event.reason === "overflow" ? "Compacting after overflow" : "Compacting context",
				),
			);
			context.appendSystemMessage("Compacting context...");
			return;

		case "auto_compaction_end":
			if (event.errorMessage) {
				context.applyRecoveryState(event.errorMessage, "Compaction failed - ready");
			} else if (event.aborted) {
				context.setRuntimeState(
					createInterruptedRuntimeState("Compaction cancelled - ready", "You can continue with a new prompt."),
				);
			} else if (event.willRetry) {
				context.setRuntimeState(createRetryingRuntimeState("Retrying after compaction"));
			} else if (record.activePrompts > 0) {
				context.setRuntimeState(createRunningRuntimeState());
			}
			context.appendSystemMessage(
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
			context.setRuntimeState(
				createRetryingRuntimeState(
					`Retrying (${event.attempt}/${event.maxAttempts})`,
					event.errorMessage,
				),
			);
			context.appendSystemMessage(
				`Retrying request (${event.attempt}/${event.maxAttempts}) after error: ${event.errorMessage}`,
			);
			return;

		case "auto_retry_end":
			if (!event.success) {
				const finalError = event.finalError ?? "Retry cancelled";
				context.setRuntimeState(
					finalError.toLowerCase().includes("cancel")
						? createInterruptedRuntimeState("Retry cancelled - ready", finalError)
						: createErrorRuntimeState("Retry failed - ready", finalError),
				);
				context.appendSystemMessage(`Retry failed: ${finalError}`);
				if (!finalError.toLowerCase().includes("cancel")) {
					const hint = getRuntimeRecoveryHint(finalError);
					if (hint?.nextStep) {
						context.appendSystemMessage(hint.nextStep);
					}
				}
			} else if (record.activePrompts > 0) {
				context.setRuntimeState(createRunningRuntimeState());
			}
			return;

		default:
			return;
	}
}
