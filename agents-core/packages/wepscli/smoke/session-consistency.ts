import assert from "node:assert/strict";
import { getSessionApprovalRequest, nextFocusRegionForSession } from "../src/WEPSCLI-shell/session-consistency.ts";

const requests = [
	{ id: "approval-a", sessionId: "session-a", toolCallId: "call-a", toolName: "bash", riskLabel: "SHELL COMMAND", reason: "", summary: "", argsText: "", fileChanges: [] },
	{ id: "approval-b", sessionId: "session-b", toolCallId: "call-b", toolName: "write", riskLabel: "FILE WRITE", reason: "", summary: "", argsText: "", fileChanges: [] },
] as any;

assert.equal(getSessionApprovalRequest(requests, "session-a")?.id, "approval-a");
assert.equal(getSessionApprovalRequest(requests, "session-b")?.id, "approval-b");
assert.equal(getSessionApprovalRequest(requests, "missing"), undefined);

assert.equal(nextFocusRegionForSession("session-a", requests), "overlay");
assert.equal(nextFocusRegionForSession("missing", requests), "composer");
assert.equal(nextFocusRegionForSession(undefined, requests), "composer");

console.log("SMOKE_SESSION_CONSISTENCY_OK");
