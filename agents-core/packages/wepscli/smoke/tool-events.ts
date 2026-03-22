import assert from "node:assert/strict";
import { WepsAgentRuntime } from "../src/WEPSCLI-shell/agent-runtime.ts";
import { appendSessionMessage, insertSessionMessageBefore, patchSessionMessage } from "../src/WEPSCLI-shell/transcript-state.ts";
import { toolCardPreview } from "../src/WEPSCLI-shell/tool-messages.ts";

const sessionId = "smoke-tool-session";

type MessageMap = Record<string, Array<{ id: string; content: string; kind?: string; tool?: { status: string; outputText: string; argsText: string; toolName: string } }>>;

let messagesBySession: MessageMap = {};

const runtime = new WepsAgentRuntime(
	{
		getActiveSelection: () => ({}),
		getProfile: () => undefined,
		getApiKey: () => undefined,
		listProfiles: () => [],
		setActiveSelection: () => {},
	} as any,
	{
		appendMessage: (targetSessionId, message) => {
			messagesBySession = appendSessionMessage(messagesBySession, targetSessionId, message) as MessageMap;
		},
		insertMessageBefore: (targetSessionId, beforeMessageId, message) => {
			messagesBySession = insertSessionMessageBefore(messagesBySession, targetSessionId, beforeMessageId, message) as MessageMap;
		},
		patchMessage: (targetSessionId, messageId, patch) => {
			messagesBySession = patchSessionMessage(messagesBySession, targetSessionId, messageId, patch).messagesBySession as MessageMap;
		},
		openApproval: () => {},
		closeApproval: () => {},
		updateRuntimeState: () => {},
	},
	{
		cwd: process.cwd(),
		agentDir: process.cwd(),
	},
);

const record = {
	sequence: 0,
	toolMessageIds: new Map<string, string>(),
	toolStates: new Map<string, unknown>(),
	activePrompts: 0,
	runtimeState: { phase: "idle", label: "Ready", interruptible: false, canContinue: true },
} as any;

function emit(event: Record<string, unknown>): void {
	(runtime as any).handleSessionEvent(sessionId, record, event);
}

function getToolMessage(index: number) {
	const message = messagesBySession[sessionId]?.[index];
	assert.ok(message, `expected tool message at index ${index}`);
	return message;
}

emit({
	type: "tool_execution_start",
	toolCallId: "call-1",
	toolName: "read_file",
	args: { path: "D:/repo/TODO.md" },
});

let firstMessage = getToolMessage(0);
assert.equal(firstMessage.kind, "tool");
assert.equal(firstMessage.tool?.status, "running");
assert.match(firstMessage.content, /Status: Running/);
assert.match(firstMessage.content, /TODO\.md/);
assert.match(toolCardPreview(firstMessage.tool as any), /Running: read_file/);
assert.match(toolCardPreview(firstMessage.tool as any), /Args: \{/);

emit({
	type: "tool_execution_update",
	toolCallId: "call-1",
	toolName: "read_file",
	args: { path: "D:/repo/TODO.md" },
	partialResult: {
		content: [{ type: "text", text: "Partial file preview" }],
	},
});

firstMessage = getToolMessage(0);
assert.equal(firstMessage.tool?.status, "running");
assert.equal(firstMessage.tool?.outputText, "Partial file preview");
assert.match(firstMessage.content, /Output:\nPartial file preview/);

emit({
	type: "tool_execution_end",
	toolCallId: "call-1",
	toolName: "read_file",
	result: {
		content: [{ type: "text", text: "Full file contents" }],
	},
	isError: false,
});

firstMessage = getToolMessage(0);
assert.equal(firstMessage.tool?.status, "completed");
assert.equal(firstMessage.tool?.outputText, "Full file contents");
assert.match(firstMessage.content, /Status: Done/);
assert.match(toolCardPreview(firstMessage.tool as any), /Done: read_file/);

emit({
	type: "tool_execution_start",
	toolCallId: "call-2",
	toolName: "write_file",
	args: { path: "D:/repo/docs/out.md" },
});

emit({
	type: "tool_execution_end",
	toolCallId: "call-2",
	toolName: "write_file",
	result: {
		content: [{ type: "text", text: "Permission denied" }],
	},
	isError: true,
});

const secondMessage = getToolMessage(1);
assert.equal(secondMessage.tool?.status, "failed");
assert.equal(secondMessage.tool?.outputText, "Permission denied");
assert.match(secondMessage.content, /Status: Failed/);
assert.match(toolCardPreview(secondMessage.tool as any), /Failed: write_file/);

assert.equal(record.toolMessageIds.size, 0);
assert.equal(record.toolStates.size, 0);

console.log("SMOKE_TOOL_EVENTS_OK");
