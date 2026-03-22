import { For, Show } from "solid-js";
import { formatToolDiffStats, toolFileChangeLocation, type ToolDiffLine, type ToolFileChange } from "./tool-file-changes.js";
import { wepscliShellTheme as theme } from "./theme.js";

const MAX_DIFF_LINES = 48;
const MAX_PREVIEW_LINES = 16;

function diffLineColor(line: ToolDiffLine): string {
	switch (line.kind) {
		case "added":
			return theme.success;
		case "removed":
			return theme.danger;
		case "context":
			return theme.text;
		case "meta":
			return theme.muted;
	}
}

function formatDiffLine(line: ToolDiffLine): string {
	if (line.kind === "meta") {
		return line.rawText;
	}
	const prefix = line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " ";
	const lineNumber = line.lineNumber?.padStart(4, " ") ?? "    ";
	return `${prefix}${lineNumber} ${line.content}`;
}

function sliceMultiline(text: string, maxLines: number): { visibleLines: string[]; hiddenLineCount: number } {
	const lines = text.replace(/\r/g, "").split("\n");
	return {
		visibleLines: lines.slice(0, maxLines),
		hiddenLineCount: Math.max(0, lines.length - maxLines),
	};
}

function previewLabel(change: ToolFileChange): string {
	return change.kind === "edit" ? "Diff" : "Preview";
}

function changeTone(change: ToolFileChange): string {
	return change.kind === "edit" ? theme.warning : theme.accent;
}

function DiffPreview(props: { lines: ToolDiffLine[] }) {
	const visibleLines = () => props.lines.slice(0, MAX_DIFF_LINES);
	const hiddenLineCount = () => Math.max(0, props.lines.length - MAX_DIFF_LINES);

	return (
		<box backgroundColor={theme.panelMuted} border={["left"]} borderColor={theme.border} paddingLeft={1} flexDirection="column" gap={0}>
			<For each={visibleLines()}>{(line) => <text fg={diffLineColor(line)}>{formatDiffLine(line)}</text>}</For>
			<Show when={hiddenLineCount() > 0}>
				<text fg={theme.muted}>... {hiddenLineCount()} more diff lines</text>
			</Show>
		</box>
	);
}

function WritePreview(props: { previewText: string }) {
	const preview = () => sliceMultiline(props.previewText, MAX_PREVIEW_LINES);

	return (
		<box backgroundColor={theme.panelMuted} border={["left"]} borderColor={theme.border} paddingLeft={1} flexDirection="column" gap={0}>
			<For each={preview().visibleLines}>{(line) => <text fg={theme.text}>{line || " "}</text>}</For>
			<Show when={preview().hiddenLineCount > 0}>
				<text fg={theme.muted}>... {preview().hiddenLineCount} more preview lines</text>
			</Show>
		</box>
	);
}

export function FileChangeCard(props: { change: ToolFileChange }) {
	return (
		<box
			backgroundColor={theme.panelAlt}
			border={["top", "right", "bottom", "left"]}
			borderColor={changeTone(props.change)}
			padding={1}
			flexDirection="column"
			gap={1}
		>
			<box flexDirection="row" justifyContent="space-between" gap={1}>
				<text fg={theme.accentStrong}>{toolFileChangeLocation(props.change)}</text>
				<text fg={changeTone(props.change)}>{props.change.kind.toUpperCase()}</text>
			</box>
			<text fg={theme.muted} wrapMode="word">{props.change.summary}</text>
			<Show when={props.change.diffLines?.length}>
				<box flexDirection="row" justifyContent="space-between" gap={1}>
					<text fg={theme.accent}>{previewLabel(props.change)}</text>
					<text fg={theme.muted}>{formatToolDiffStats(props.change.diffStats) ?? ""}</text>
				</box>
				<DiffPreview lines={props.change.diffLines!} />
			</Show>
			<Show when={!props.change.diffLines?.length && props.change.previewText}>
				<text fg={theme.accent}>{previewLabel(props.change)}</text>
				<WritePreview previewText={props.change.previewText!} />
			</Show>
		</box>
	);
}

export function FileChangeCardList(props: { changes: ToolFileChange[]; title?: string }) {
	return (
		<box flexDirection="column" gap={1}>
			{props.title ? <text fg={theme.accent}>{props.title}</text> : null}
			<For each={props.changes}>{(change) => <FileChangeCard change={change} />}</For>
		</box>
	);
}
