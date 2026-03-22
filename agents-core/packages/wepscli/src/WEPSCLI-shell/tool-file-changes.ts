import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { generateDiffString } from "./tool-diff.js";

type ContentBlock = {
	type?: string;
	text?: string;
	thinking?: string;
	[key: string]: unknown;
};

export type ToolFileChangeKind = "edit" | "write";
export type ToolDiffLineKind = "added" | "removed" | "context" | "meta";

export interface ToolDiffLine {
	kind: ToolDiffLineKind;
	lineNumber?: string;
	content: string;
	rawText: string;
}

export interface ToolDiffStats {
	added: number;
	removed: number;
	context: number;
	meta: number;
}

export interface ToolFileChange {
	kind: ToolFileChangeKind;
	path: string;
	summary: string;
	firstChangedLine?: number;
	diffText?: string;
	diffLines?: ToolDiffLine[];
	diffStats?: ToolDiffStats;
	previewText?: string;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function readString(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
	if (!record) {
		return undefined;
	}
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) {
			return value;
		}
	}
	return undefined;
}

function normalizeDisplayText(value: string): string {
	return value.replace(/\r/g, "").trim();
}

function normalizePreviewText(value: string): string {
	return value.replace(/\r/g, "").trimEnd();
}

function extractContentBlocks(content: ContentBlock[]): string {
	return content
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
		.join("\n\n");
}

function extractContentText(value: unknown): string {
	if (typeof value === "string") {
		return normalizeDisplayText(value);
	}

	const record = readRecord(value);
	if (!record) {
		return "";
	}

	if (Array.isArray(record.content)) {
		return normalizeDisplayText(extractContentBlocks(record.content as ContentBlock[]));
	}

	return "";
}

function readPath(args: unknown): string | undefined {
	return readString(readRecord(args), ["path", "file_path", "filePath", "target", "destination"]);
}

function readDiffText(result: unknown): string | undefined {
	const record = readRecord(result);
	if (!record) {
		return undefined;
	}
	if (typeof record.diff === "string" && record.diff.trim()) {
		return record.diff;
	}
	const details = readRecord(record.details);
	return typeof details?.diff === "string" && details.diff.trim() ? details.diff : undefined;
}

function readFirstChangedLine(result: unknown): number | undefined {
	const record = readRecord(result);
	if (!record) {
		return undefined;
	}
	const details = readRecord(record.details);
	const value = details?.firstChangedLine ?? record.firstChangedLine;
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseDiffLine(line: string): ToolDiffLine {
	const match = line.match(/^([+-\s])(\s*\d*)\s(.*)$/);
	if (!match) {
		return {
			kind: "meta",
			content: line,
			rawText: line,
		};
	}

	const prefix = match[1];
	return {
		kind: prefix === "+" ? "added" : prefix === "-" ? "removed" : "context",
		lineNumber: match[2].trim() || undefined,
		content: match[3],
		rawText: line,
	};
}

export function parseToolDiff(diffText: string): { lines: ToolDiffLine[]; stats: ToolDiffStats } {
	const lines = diffText.replace(/\r/g, "").split("\n").map(parseDiffLine);
	const stats: ToolDiffStats = {
		added: 0,
		removed: 0,
		context: 0,
		meta: 0,
	};

	for (const line of lines) {
		switch (line.kind) {
			case "added":
				stats.added += 1;
				break;
			case "removed":
				stats.removed += 1;
				break;
			case "context":
				stats.context += 1;
				break;
			case "meta":
				stats.meta += 1;
				break;
		}
	}

	return { lines, stats };
}

function firstNonEmptyLine(value: string): string | undefined {
	return value
		.split("\n")
		.map((line) => line.trim())
		.find(Boolean);
}

function summarizeWritePreview(content: string): string {
	const lines = normalizePreviewText(content).split("\n");
	if (lines.length <= 1) {
		return `Prepared ${content.length} characters`;
	}
	return `Prepared ${lines.length} lines`;
}

function resolveWorkspacePath(path: string): string {
	return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

function computeWritePreviewDiff(
	path: string,
	previewText: string,
): Pick<ToolFileChange, "diffText" | "diffLines" | "diffStats" | "firstChangedLine"> | undefined {
	try {
		const absolutePath = resolveWorkspacePath(path);
		const existingContent = existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
		const diffResult = generateDiffString(existingContent, previewText);
		if (!diffResult.diff) {
			return undefined;
		}

		const parsedDiff = parseToolDiff(diffResult.diff);
		return {
			diffText: diffResult.diff,
			diffLines: parsedDiff.lines,
			diffStats: parsedDiff.stats,
			firstChangedLine: diffResult.firstChangedLine,
		};
	} catch {
		return undefined;
	}
}

function computeEditPreviewDiff(
	path: string,
	args: unknown,
): Pick<ToolFileChange, "diffText" | "diffLines" | "diffStats" | "firstChangedLine"> | undefined {
	try {
		const record = readRecord(args);
		const oldText = readString(record, ["oldText", "old_text"]);
		const newText = readString(record, ["newText", "new_text"]);
		if (oldText === undefined || newText === undefined) {
			return undefined;
		}

		const absolutePath = resolveWorkspacePath(path);
		const existingContent = existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
		const newContent = existingContent.includes(oldText)
			? existingContent.replace(oldText, newText)
			: newText;
		const baseContent = existingContent.includes(oldText) ? existingContent : oldText;
		const diffResult = generateDiffString(baseContent, newContent);
		if (!diffResult.diff) {
			return undefined;
		}

		const parsedDiff = parseToolDiff(diffResult.diff);
		return {
			diffText: diffResult.diff,
			diffLines: parsedDiff.lines,
			diffStats: parsedDiff.stats,
			firstChangedLine: diffResult.firstChangedLine,
		};
	} catch {
		return undefined;
	}
}

function buildEditChange(path: string, args: unknown, result: unknown): ToolFileChange {
	const diffText = readDiffText(result);
	const parsedDiff = diffText ? parseToolDiff(diffText) : undefined;
	const outputText = extractContentText(result);
	const previewDiff = !result ? computeEditPreviewDiff(path, args) : undefined;

	return {
		kind: "edit",
		path,
		summary: outputText || (diffText || previewDiff ? `Updated ${path}` : `Editing ${path}`),
		firstChangedLine: readFirstChangedLine(result) ?? previewDiff?.firstChangedLine,
		diffText: diffText ?? previewDiff?.diffText,
		diffLines: parsedDiff?.lines ?? previewDiff?.diffLines,
		diffStats: parsedDiff?.stats ?? previewDiff?.diffStats,
	};
}

function buildWriteChange(path: string, args: unknown, result: unknown): ToolFileChange {
	const previewText = readString(readRecord(args), ["content"]);
	const outputText = extractContentText(result);
	const previewDiff = !result && previewText ? computeWritePreviewDiff(path, previewText) : undefined;

	return {
		kind: "write",
		path,
		summary: outputText || (previewText ? summarizeWritePreview(previewText) : `Writing ${path}`),
		previewText: previewText ? normalizePreviewText(previewText) : undefined,
		diffText: previewDiff?.diffText,
		diffLines: previewDiff?.diffLines,
		diffStats: previewDiff?.diffStats,
		firstChangedLine: previewDiff?.firstChangedLine,
	};
}

export function extractToolFileChanges(toolName: string, args: unknown, result: unknown): ToolFileChange[] {
	const normalized = toolName.toLowerCase();
	const path = readPath(args);
	if (!path) {
		return [];
	}

	if (normalized === "edit" || normalized === "edit_file" || normalized === "apply_patch" || normalized === "patch") {
		return [buildEditChange(path, args, result)];
	}

	if (normalized === "write" || normalized === "write_file") {
		return [buildWriteChange(path, args, result)];
	}

	return [];
}

export function toolFileChangeLocation(change: ToolFileChange): string {
	return change.firstChangedLine ? `${change.path}:${change.firstChangedLine}` : change.path;
}

export function formatToolDiffStats(stats: ToolDiffStats | undefined): string | undefined {
	if (!stats) {
		return undefined;
	}

	const parts: string[] = [];
	if (stats.added > 0) {
		parts.push(`+${stats.added}`);
	}
	if (stats.removed > 0) {
		parts.push(`-${stats.removed}`);
	}
	if (stats.context > 0) {
		parts.push(`${stats.context} ctx`);
	}
	return parts.join(" ");
}

export function formatToolDiffDeltaStats(stats: ToolDiffStats | undefined): string | undefined {
	if (!stats) {
		return undefined;
	}

	const parts: string[] = [];
	if (stats.added > 0) {
		parts.push(`+${stats.added}`);
	}
	if (stats.removed > 0) {
		parts.push(`-${stats.removed}`);
	}
	return parts.join(" ");
}

export function toolFileChangeInlineSummary(change: ToolFileChange): string {
	const location = toolFileChangeLocation(change);
	if (change.kind === "edit") {
		return `${location}${formatToolDiffDeltaStats(change.diffStats) ? ` | ${formatToolDiffDeltaStats(change.diffStats)}` : ""}`;
	}
	if (change.previewText) {
		return `${location} | ${firstNonEmptyLine(change.previewText) ?? change.summary}`;
	}
	return `${location} | ${change.summary}`;
}
