import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
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
const editPreviewPath = ".approval-edit-preview.txt";
await writeFile(editPreviewPath, "before text\n", "utf8");

const record = {
	toolMessageIds: new Map<string, string>([
		["call-1", "msg-1"],
		["call-2", "msg-2"],
		["call-3", "msg-3"],
	]),
	toolStates: new Map<string, ReturnType<typeof createToolMessageState>>([
		["call-1", createToolMessageState("call-1", "bash", { command: "git status" })],
		["call-2", createToolMessageState("call-2", "write", { path: "docs/out.md", content: "hello" })],
		[
			"call-3",
			createToolMessageState("call-3", "edit", {
				path: editPreviewPath,
				oldText: "before",
				newText: "after",
			}),
		],
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
assert.equal(requests[0]?.commandText, "git status");
assert.equal(patches[0]?.tool?.status, "awaiting_approval");

runtime.resolveApproval(requests[0]!.id, "reject");
const rejectResult = await rejectPromise;

assert.equal(rejectResult?.block, true);
assert.match(rejectResult?.reason ?? "", /rejected by the user/i);
assert.equal(patches[1]?.tool?.status, "failed");
assert.equal(closedRequestIds[0], requests[0]!.id);

const allowPromise = (runtime as any).handleApprovalRequest(
	sessionId,
	record,
	"call-2",
	"write",
	{ path: "docs/out.md", content: "hello" },
);

assert.equal(requests.length, 2);
assert.equal(requests[1]?.fileChanges[0]?.path, "docs/out.md");
assert.ok((requests[1]?.fileChanges[0]?.diffStats?.added ?? 0) > 0);
assert.equal(patches[2]?.tool?.status, "awaiting_approval");

runtime.resolveApproval(requests[1]!.id, "allow");
const allowResult = await allowPromise;

assert.equal(allowResult, undefined);
assert.equal(patches[3]?.tool?.status, "running");
assert.equal(closedRequestIds[1], requests[1]!.id);

const cancelPromise = (runtime as any).handleApprovalRequest(
	sessionId,
	record,
	"call-3",
	"edit",
	{ path: editPreviewPath, oldText: "before", newText: "after" },
);

assert.equal(requests.length, 3);
assert.equal(requests[2]?.fileChanges[0]?.path, editPreviewPath);
assert.ok((requests[2]?.fileChanges[0]?.diffStats?.added ?? 0) > 0);
assert.ok((requests[2]?.fileChanges[0]?.diffStats?.removed ?? 0) > 0);
assert.equal(patches[4]?.tool?.status, "awaiting_approval");

runtime.resolveApproval(requests[2]!.id, "cancel");
const cancelResult = await cancelPromise;
assert.equal(cancelResult?.block, true);
assert.match(cancelResult?.reason ?? "", /cancelled before execution/i);
assert.equal(patches[5]?.tool?.status, "failed");

console.log("SMOKE_APPROVAL_FLOW_OK");

await rm(editPreviewPath, { force: true });
