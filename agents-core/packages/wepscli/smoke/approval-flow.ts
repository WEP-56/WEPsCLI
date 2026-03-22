import assert from "node:assert/strict";
import { WepsAgentRuntime } from "../src/WEPSCLI-shell/agent-runtime.ts";
import { createToolMessageState } from "../src/WEPSCLI-shell/tool-messages.ts";
import type { ToolApprovalRequest } from "../src/WEPSCLI-shell/tool-approval.ts";

const runtime = new WepsAgentRuntime(
	{
		getActiveSelection: () => ({}),
		getProfile: () => undefined,
		getApiKey: () => undefined,
		listProfiles: () => [],
		setActiveSelection: () => {},
	} as any,
	{
		appendMessage: () => {},
		insertMessageBefore: () => {},
		patchMessage: (_sessionId, _messageId, patch) => {
			patches.push(patch);
		},
		openApproval: (_sessionId, request) => {
			requests.push(request);
		},
		closeApproval: (_sessionId, requestId) => {
			closedRequestIds.push(requestId);
		},
		updateRuntimeState: () => {},
	},
);

const sessionId = "approval-smoke";
const record = {
	toolMessageIds: new Map<string, string>([["call-1", "msg-1"], ["call-2", "msg-2"]]),
	toolStates: new Map<string, ReturnType<typeof createToolMessageState>>([
		["call-1", createToolMessageState("call-1", "bash", { command: "git status" })],
		["call-2", createToolMessageState("call-2", "write", { path: "docs/out.md", content: "hello" })],
	]),
	activePrompts: 1,
	runtimeState: { phase: "running", label: "Running", interruptible: true, canContinue: false },
} as any;

const patches: Array<{ tool?: { status: string } }> = [];
const requests: ToolApprovalRequest[] = [];
const closedRequestIds: string[] = [];

const rejectPromise = (runtime as any).handleApprovalRequest(
	sessionId,
	record,
	"call-1",
	"bash",
	{ command: "git status" },
);

assert.equal(requests.length, 1);
assert.equal(requests[0]?.toolName, "bash");
assert.equal(patches[0]?.tool?.status, "awaiting_approval");

runtime.resolveApproval(requests[0]!.id, "reject");
const rejectResult = await rejectPromise;

assert.equal(rejectResult?.block, true);
assert.match(rejectResult?.reason ?? "", /rejected by the user/i);
assert.equal(closedRequestIds[0], requests[0]!.id);

const allowPromise = (runtime as any).handleApprovalRequest(
	sessionId,
	record,
	"call-2",
	"write",
	{ path: "docs/out.md", content: "hello" },
);

assert.equal(requests.length, 2);
assert.equal(patches[1]?.tool?.status, "awaiting_approval");

runtime.resolveApproval(requests[1]!.id, "allow");
const allowResult = await allowPromise;

assert.equal(allowResult, undefined);
assert.equal(patches[2]?.tool?.status, "running");
assert.equal(closedRequestIds[1], requests[1]!.id);

console.log("SMOKE_APPROVAL_FLOW_OK");
