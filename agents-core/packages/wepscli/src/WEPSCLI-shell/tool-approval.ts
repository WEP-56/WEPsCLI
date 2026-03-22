import { formatToolDiffStats, toolFileChangeLocation, type ToolFileChange, extractToolFileChanges } from "./tool-file-changes.js";
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
	commandText?: string;
	fileChanges: ToolFileChange[];
}

function readRecord(args: unknown): Record<string, unknown> | undefined {
	return typeof args === "object" && args !== null ? (args as Record<string, unknown>) : undefined;
}

function readString(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
	if (!record) {
		return undefined;
	}
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return undefined;
}

function readCommand(args: unknown): string | undefined {
	return readString(readRecord(args), ["command", "cmd", "script"]);
}

function summarizeFileChange(prefix: string, change: ToolFileChange | undefined): string {
	if (!change) {
		return prefix;
	}

	const location = toolFileChangeLocation(change);
	const stats = formatToolDiffStats(change.diffStats);
	return `${prefix} ${location}${stats ? ` (${stats})` : ""}`;
}

function classifyToolRisk(
	toolName: string,
	args: unknown,
	fileChanges: ToolFileChange[],
): {
	riskLabel: string;
	reason: string;
	summary: string;
	commandText?: string;
} | undefined {
	const normalized = toolName.toLowerCase();
	const command = readCommand(args);
	const firstFileChange = fileChanges[0];

	if (normalized === "bash" || normalized === "shell_command" || normalized === "shell" || normalized === "exec") {
		return {
			riskLabel: "SHELL COMMAND",
			reason: "This command can execute arbitrary shell operations in the workspace.",
			summary: command ? "Run a shell command in the workspace." : "Run a shell command with arbitrary side effects.",
			commandText: command,
		};
	}

	if (normalized === "write" || normalized === "write_file") {
		return {
			riskLabel: "FILE WRITE",
			reason: "This tool will create or overwrite a file on disk.",
			summary: summarizeFileChange("Write", firstFileChange),
		};
	}

	if (normalized === "edit" || normalized === "edit_file" || normalized === "apply_patch" || normalized === "patch") {
		return {
			riskLabel: "FILE EDIT",
			reason: "This tool will modify existing file contents on disk.",
			summary: summarizeFileChange("Edit", firstFileChange),
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
	const fileChanges = extractToolFileChanges(toolName, args, undefined);
	const classification = classifyToolRisk(toolName, args, fileChanges);
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
		commandText: classification.commandText,
		fileChanges,
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
