import { Show } from "solid-js";
import { FileChangeCardList } from "./file-change-preview.js";
import { wepscliShellTheme as theme } from "./theme.js";
import { toolStatusLabel, toolStatusTone, type ToolMessageState } from "./tool-messages.js";

function toneColor(tone: "accent" | "success" | "warning" | "danger" | "muted"): string {
	switch (tone) {
		case "accent":
			return theme.accent;
		case "success":
			return theme.success;
		case "warning":
			return theme.warning;
		case "danger":
			return theme.danger;
		case "muted":
			return theme.muted;
	}
}

function ToolTextSection(props: { title: string; body: string }) {
	return (
		<box flexDirection="column" gap={1}>
			<text fg={theme.accent}>{props.title}</text>
			<box backgroundColor={theme.panelAlt} border={["left"]} borderColor={theme.border} paddingLeft={1}>
				<text fg={theme.text} wrapMode="word">{props.body}</text>
			</box>
		</box>
	);
}

export function ToolMessageDetail(props: { tool: ToolMessageState }) {
	const hasFileChanges = () => props.tool.fileChanges.length > 0;

	return (
		<box flexDirection="column" gap={1}>
			<box flexDirection="row" justifyContent="space-between" gap={1}>
				<text fg={theme.accent}>{props.tool.toolName}</text>
				<text fg={toneColor(toolStatusTone(props.tool.status))}>{toolStatusLabel(props.tool.status)}</text>
			</box>
			<text fg={theme.muted}>Call ID: {props.tool.toolCallId}</text>
			<Show when={props.tool.fileChanges.length > 0}>
				<FileChangeCardList changes={props.tool.fileChanges} title="File Changes" />
			</Show>
			<Show when={!hasFileChanges()}>
				<ToolTextSection title="Arguments" body={props.tool.argsText || "No arguments"} />
			</Show>
			<Show when={!hasFileChanges() && props.tool.outputText}>
				<ToolTextSection title="Output" body={props.tool.outputText} />
			</Show>
		</box>
	);
}
