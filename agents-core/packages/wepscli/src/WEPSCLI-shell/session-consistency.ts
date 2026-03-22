import type { ToolApprovalRequest } from "./tool-approval.js";
import type { ShellFocus } from "./types.js";

export function getSessionApprovalRequest(
	requests: ToolApprovalRequest[],
	sessionId?: string,
): ToolApprovalRequest | undefined {
	if (!sessionId) {
		return undefined;
	}
	return requests.find((request) => request.sessionId === sessionId);
}

export function nextFocusRegionForSession(
	sessionId: string | undefined,
	requests: ToolApprovalRequest[],
): ShellFocus {
	return getSessionApprovalRequest(requests, sessionId) ? "overlay" : "composer";
}
