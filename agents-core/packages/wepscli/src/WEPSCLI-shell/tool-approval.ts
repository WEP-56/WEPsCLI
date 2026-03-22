import { formatToolArgs } from "./tool-messages.js";

export type ToolApprovalDecision = "allow" | "reject" | "cancel";

export interface ToolApprovalRequest {
	id: string;
	sessionId: string;
	toolCallId: string;
	toolName: string;
	riskLabel: string;
	reason: string;
	summary: string;
	argsText: string;
}

function readPath(args: unknown): string | undefined {
	if (typeof args !== "object" || args === null) {
		return undefined;
	}
	const record = args as Record<string, unknown>;
	const candidate = record.path ?? record.file_path ?? record.filePath ?? record.target ?? record.destination;
	return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function readCommand(args: unknown): string | undefined {
	if (typeof args !== "object" || args === null) {
		return undefined;
	}
	const record = args as Record<string, unknown>;
	const candidate = record.command ?? record.cmd ?? record.script;
	return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function classifyToolRisk(
	toolName: string,
	args: unknown,
): {
	riskLabel: string;
	reason: string;
	summary: string;
} | undefined {
	const normalized = toolName.toLowerCase();
	const path = readPath(args);
	const command = readCommand(args);

	if (normalized === "bash" || normalized === "shell_command" || normalized === "shell" || normalized === "exec") {
		return {
			riskLabel: "HIGH RISK",
			reason: "This command can execute arbitrary shell operations in the workspace.",
			summary: command ? `Run shell command:\n${command}` : "Run a shell command with arbitrary side effects.",
		};
	}

	if (normalized === "write" || normalized === "write_file") {
		return {
			riskLabel: "FILE WRITE",
			reason: "This tool will create or overwrite a file.",
			summary: path ? `Write file:\n${path}` : "Write file contents to disk.",
		};
	}

	if (normalized === "edit" || normalized === "edit_file" || normalized === "apply_patch" || normalized === "patch") {
		return {
			riskLabel: "FILE EDIT",
			reason: "This tool will modify existing file contents.",
			summary: path ? `Edit file:\n${path}` : "Apply an in-place file edit or patch.",
		};
	}

	return undefined;
}

export function createToolApprovalRequest(
	id: string,
	sessionId: string,
	toolCallId: string,
	toolName: string,
	args: unknown,
): ToolApprovalRequest | undefined {
	const classification = classifyToolRisk(toolName, args);
	if (!classification) {
		return undefined;
	}

	return {
		id,
		sessionId,
		toolCallId,
		toolName,
		riskLabel: classification.riskLabel,
		reason: classification.reason,
		summary: classification.summary,
		argsText: formatToolArgs(args),
	};
}

export function toolApprovalDecisionReason(decision: ToolApprovalDecision, request: ToolApprovalRequest): string {
	switch (decision) {
		case "allow":
			return "";
		case "reject":
			return `${request.toolName} was rejected by the user before execution.`;
		case "cancel":
			return `${request.toolName} approval was cancelled before execution.`;
	}
}
