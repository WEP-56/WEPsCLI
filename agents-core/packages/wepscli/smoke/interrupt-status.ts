import assert from "node:assert/strict";
import { WepsAgentRuntime } from "../src/WEPSCLI-shell/agent-runtime.ts";
import type { RuntimeSessionState } from "../src/WEPSCLI-shell/runtime-status.ts";

const runtimeStates: RuntimeSessionState[] = [];
const systemMessages: string[] = [];
let abortCalls = 0;
let abortCompactionCalls = 0;

const runtime = new WepsAgentRuntime(
	{
		getActiveSelection: () => ({}),
		getProfile: () => undefined,
		getApiKey: () => undefined,
		listProfiles: () => [],
		setActiveSelection: () => {},
	} as any,
	{
		appendMessage: (_sessionId, message) => {
			systemMessages.push(message.content);
		},
		insertMessageBefore: () => {},
		patchMessage: () => {},
		openApproval: () => {},
		closeApproval: () => {},
		updateRuntimeState: (_sessionId, state) => {
			runtimeStates.push(state);
		},
	},
);

const sessionId = "interrupt-status-smoke";
(runtime as any).records.set(sessionId, {
	session: {
		abort: async () => {
			abortCalls += 1;
		},
		abortCompaction: () => {
			abortCompactionCalls += 1;
		},
	},
	unsubscribe: () => {},
	removeBeforeToolCallHook: () => {},
	toolMessageIds: new Map(),
	toolStates: new Map(),
	activePrompts: 1,
	runtimeState: {
		phase: "running",
		label: "Running",
		interruptible: true,
		canContinue: false,
	},
	sequence: 0,
} as any);

const aborted = await runtime.abort(sessionId);
assert.equal(aborted, true);
assert.equal(abortCalls, 1);
assert.equal(abortCompactionCalls, 1);
assert.match(systemMessages[0] ?? "", /Request interrupted/i);
assert.equal(runtimeStates.at(-1)?.phase, "interrupted");
assert.equal(runtimeStates.at(-1)?.canContinue, true);

const eventRecord = {
	toolMessageIds: new Map<string, string>(),
	toolStates: new Map(),
	activePrompts: 1,
	runtimeState: {
		phase: "running",
		label: "Running",
		interruptible: true,
		canContinue: false,
	},
	sequence: 0,
} as any;

(runtime as any).handleSessionEvent(sessionId, eventRecord, {
	type: "auto_retry_start",
	attempt: 2,
	maxAttempts: 5,
	delayMs: 2000,
	errorMessage: "rate limited",
});
assert.equal(runtimeStates.at(-1)?.phase, "retrying");

(runtime as any).handleSessionEvent(sessionId, eventRecord, {
	type: "auto_compaction_start",
	reason: "overflow",
});
assert.equal(runtimeStates.at(-1)?.phase, "compacting");

(runtime as any).handleSessionEvent(sessionId, eventRecord, {
	type: "auto_retry_end",
	success: false,
	attempt: 2,
	finalError: "Retry cancelled",
});
assert.equal(runtimeStates.at(-1)?.phase, "interrupted");

console.log("SMOKE_INTERRUPT_STATUS_OK");
