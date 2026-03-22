export type ToolMessageStatus = "awaiting_approval" | "running" | "completed" | "failed";

export interface ToolMessageState {
	toolCallId: string;
	toolName: string;
	status: ToolMessageStatus;
	argsText: string;
	outputText: string;
}

type ContentBlock = {
	type?: string;
	text?: string;
	thinking?: string;
	mimeType?: string;
	data?: string;
	[key: string]: unknown;
};

function normalizeDisplayText(value: string): string {
	return value.replace(/\r/g, "").trim();
}

function formatUnknownValue(value: unknown): string {
	if (typeof value === "string") {
		return normalizeDisplayText(value);
	}
	if (value == null) {
		return "";
	}
	try {
		return normalizeDisplayText(JSON.stringify(value, null, 2));
	} catch {
		return normalizeDisplayText(String(value));
	}
}

function extractContentBlocks(value: ContentBlock[]): string {
	return value
		.map((block) => {
			if (block.type === "text" && typeof block.text === "string") {
				return block.text;
			}
			if (block.type === "thinking" && typeof block.thinking === "string") {
				return block.thinking;
			}
			if (block.type === "image") {
				return "[image]";
			}
			if (block.type === "audio") {
				return "[audio]";
			}
			return "";
		})
		.filter(Boolean)
		.join("\n\n")
		.trim();
}

function extractContentValue(value: unknown): string {
	if (
		typeof value === "object" &&
		value !== null &&
		"content" in value &&
		Array.isArray((value as { content?: unknown }).content)
	) {
		const extracted = extractContentBlocks((value as { content: ContentBlock[] }).content);
		if (extracted) {
			return extracted;
		}
	}
	return formatUnknownValue(value);
}

function firstNonEmptyLine(value: string): string | undefined {
	return value
		.split("\n")
		.map((line) => line.trim())
		.find(Boolean);
}

export function formatToolArgs(args: unknown): string {
	return extractContentValue(args) || "No arguments";
}

export function formatToolOutput(result: unknown): string {
	return extractContentValue(result);
}

export function createToolMessageState(toolCallId: string, toolName: string, args: unknown): ToolMessageState {
	return {
		toolCallId,
		toolName,
		status: "running",
		argsText: formatToolArgs(args),
		outputText: "",
	};
}

export function updateToolMessageState(
	tool: ToolMessageState,
	update: {
		status?: ToolMessageStatus;
		args?: unknown;
		output?: unknown;
	},
): ToolMessageState {
	const nextArgsText = update.args === undefined ? tool.argsText : formatToolArgs(update.args);
	const nextOutputText = update.output === undefined ? tool.outputText : formatToolOutput(update.output);

	return {
		...tool,
		status: update.status ?? tool.status,
		argsText: nextArgsText || tool.argsText,
		outputText: nextOutputText || tool.outputText,
	};
}

export function toolStatusLabel(status: ToolMessageStatus): string {
	switch (status) {
		case "awaiting_approval":
			return "Needs Approval";
		case "running":
			return "Running";
		case "completed":
			return "Done";
		case "failed":
			return "Failed";
	}
}

export function toolStatusTone(status: ToolMessageStatus): "accent" | "success" | "danger" | "warning" {
	switch (status) {
		case "awaiting_approval":
			return "warning";
		case "running":
			return "accent";
		case "completed":
			return "success";
		case "failed":
			return "danger";
	}
}

export function toolCardPreview(tool: ToolMessageState): string {
	const lines: string[] = [`${toolStatusLabel(tool.status)}: ${tool.toolName}`];
	const outputLine = firstNonEmptyLine(tool.outputText);
	const argsLine = firstNonEmptyLine(tool.argsText);

	if (outputLine) {
		lines.push(outputLine);
	} else if (tool.status === "awaiting_approval") {
		lines.push("Waiting for approval...");
	} else if (tool.status === "running") {
		lines.push("Waiting for tool output...");
	}

	if (argsLine) {
		lines.push(`Args: ${argsLine}`);
	}

	return lines.join("\n");
}

export function toolDetailText(tool: ToolMessageState): string {
	return [
		`Tool: ${tool.toolName}`,
		`Status: ${toolStatusLabel(tool.status)}`,
		`Call ID: ${tool.toolCallId}`,
		"",
		"Arguments:",
		tool.argsText || "No arguments",
		"",
		"Output:",
		tool.outputText ||
			(tool.status === "awaiting_approval"
				? "Waiting for user approval before execution."
				: tool.status === "running"
					? "Waiting for tool output..."
					: "No tool output."),
	].join("\n");
}
