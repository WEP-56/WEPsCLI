import { For, Show } from "solid-js";
import type { ChatMessage } from "./chat-components.js";
import { truncate } from "./helpers.js";
import { wepscliShellTheme as theme } from "./theme.js";
import { toolFileChangeLocation } from "./tool-file-changes.js";
import { toolStatusLabel, toolStatusTone } from "./tool-messages.js";
import { ToolMessageDetail } from "./tool-message-detail.js";

const COLLAPSIBLE_MESSAGE_LINES = 3;

function isMessageOverflowing(message: ChatMessage): boolean {
	return message.content.split("\n").length > COLLAPSIBLE_MESSAGE_LINES;
}

function isInlineSummaryMessage(message: ChatMessage): boolean {
	return message.kind === "tool" || message.kind === "reasoning";
}

function getVisibleMessageContent(message: ChatMessage): string {
	if (!message.collapsible || message.expanded || !isMessageOverflowing(message)) {
		return message.content;
	}
	return [...message.content.split("\n").slice(0, COLLAPSIBLE_MESSAGE_LINES), "..."].join("\n");
}

function transcriptBorderColor(message: ChatMessage): string {
	if (message.kind === "tool") {
		return theme.border;
	}
	if (message.kind === "reasoning") {
		return theme.muted;
	}
	return message.role === "user" ? theme.accent : message.role === "assistant" ? theme.success : theme.muted;
}

function transcriptRoleColor(message: ChatMessage): string {
	if (message.kind === "tool") {
		return message.tool ? toneColor(toolStatusTone(message.tool.status)) : theme.accent;
	}
	if (message.kind === "reasoning") {
		return theme.warning;
	}
	return message.role === "user" ? theme.accent : message.role === "assistant" ? theme.success : theme.muted;
}

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

function firstNonEmptyLine(value: string): string | undefined {
	return value
		.split("\n")
		.map((line) => line.trim())
		.find(Boolean);
}

function inlinePrefix(message: ChatMessage): string {
	if (message.kind === "tool" && message.tool) {
		return `${toolStatusLabel(message.tool.status)} ${message.tool.toolName}`;
	}
	if (message.kind === "reasoning") {
		return "Thought";
	}
	return message.role;
}

function inlineSnippet(message: ChatMessage): string {
	if (message.kind === "tool" && message.tool) {
		return (
			firstNonEmptyLine(message.tool.outputText) ??
			firstNonEmptyLine(message.tool.argsText) ??
			(message.tool.status === "awaiting_approval" ? "Waiting for approval..." : "Waiting for tool output...")
		);
	}
	return firstNonEmptyLine(message.content) ?? (message.kind === "reasoning" ? "Thinking..." : message.content);
}

function inlineSummary(message: ChatMessage, width: number): string {
	const reserved = Math.max(16, Math.floor(width * 0.2));
	const maxLength = Math.max(24, width - reserved);
	return truncate(`${inlinePrefix(message)} | ${inlineSnippet(message)}`, maxLength);
}

function toolInlineLabel(message: ChatMessage, width: number): string {
	const tool = message.tool;
	if (!tool) {
		return inlineSummary(message, width);
	}

	const firstFileChange = tool.fileChanges[0];
	if (!firstFileChange) {
		return inlineSummary(message, width);
	}

	const reserved = Math.max(16, Math.floor(width * 0.22));
	const maxLength = Math.max(24, width - reserved);
	return truncate(`${tool.toolName} ${toolFileChangeLocation(firstFileChange)}`, maxLength);
}

function toolInlineDiffStats(message: ChatMessage): { added?: string; removed?: string } | undefined {
	const tool = message.tool;
	const firstFileChange = tool?.fileChanges[0];
	if (!tool || !firstFileChange) {
		return undefined;
	}

	const stats = firstFileChange.diffStats;
	return {
		added: stats?.added ? `+${stats.added}` : undefined,
		removed: stats?.removed ? `-${stats.removed}` : undefined,
	};
}

function useStructuredToolSummary(message: ChatMessage): boolean {
	return (
		message.kind === "tool" &&
		message.tool?.status === "completed" &&
		!!message.tool.fileChanges[0]
	);
}

function attachmentSummaryLabel(count: number): string {
	return `${count} image${count === 1 ? "" : "s"} attached`;
}

export function TranscriptPanel(props: {
	messages: ChatMessage[];
	activeModelLabel: string;
	width: number;
	scrollRef: (ref: { scrollTo(position: number): void; scrollHeight: number; isDestroyed?: boolean }) => void;
	onToggleMessage: (messageId: string) => void;
}) {
	return (
		<box flexGrow={1} minHeight={0} backgroundColor={theme.panel} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} flexDirection="column" gap={1}>
			<box flexDirection="row" justifyContent="space-between" gap={1}>
				<text fg={theme.accent}>Conversation</text>
				<text fg={theme.muted}>{truncate(props.activeModelLabel, 32)}</text>
			</box>
			<scrollbox ref={props.scrollRef} flexGrow={1} minHeight={0}>
				<box flexDirection="column" gap={1}>
					<Show
						when={props.messages.length > 0}
						fallback={
							<box backgroundColor={theme.panelAlt} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} flexDirection="column" gap={1}>
								<text fg={theme.accentStrong}>Ready for a task</text>
								<text fg={theme.text} wrapMode="word">Start with a prompt. This minimal shell keeps the layout compact while we bring interaction back.</text>
								<text fg={theme.muted} wrapMode="word">Enter a prompt below, or type / for commands.</text>
							</box>
						}
					>
						<For each={props.messages}>
							{(message) =>
								isInlineSummaryMessage(message) ? (
									<box
										backgroundColor={theme.panelMuted}
										border={["left"]}
										borderColor={transcriptBorderColor(message)}
										paddingLeft={1}
										paddingRight={1}
										paddingTop={0}
										paddingBottom={0}
										flexDirection="column"
										gap={message.expanded ? 1 : 0}
										onMouseUp={() => props.onToggleMessage(message.id)}
									>
										<box flexDirection="row" justifyContent="space-between" gap={1}>
											{useStructuredToolSummary(message) ? (
												<box flexDirection="row" gap={1} flexGrow={1} minWidth={0}>
													<text fg={transcriptRoleColor(message)}>{toolInlineLabel(message, props.width)}</text>
													<Show when={toolInlineDiffStats(message)?.added}>
														<text fg={theme.success}>{toolInlineDiffStats(message)!.added}</text>
													</Show>
													<Show when={toolInlineDiffStats(message)?.removed}>
														<text fg={theme.danger}>{toolInlineDiffStats(message)!.removed}</text>
													</Show>
												</box>
											) : (
												<text fg={transcriptRoleColor(message)}>{inlineSummary(message, props.width)}</text>
											)}
											<text fg={theme.muted}>{message.expanded ? "hide" : "more"} {truncate(message.time, 8)}</text>
										</box>
										<Show when={message.expanded}>
											<box paddingLeft={1} paddingBottom={1}>
												{message.kind === "tool" && message.tool ? (
													<ToolMessageDetail tool={message.tool} />
												) : (
													<text fg={theme.text} wrapMode="word">{message.content}</text>
												)}
											</box>
										</Show>
									</box>
								) : (
									<box
										backgroundColor={theme.panelAlt}
										border={["top", "right", "bottom", "left"]}
										borderColor={transcriptBorderColor(message)}
										padding={1}
										flexDirection="column"
										gap={1}
										onMouseUp={message.collapsible && isMessageOverflowing(message) ? () => props.onToggleMessage(message.id) : undefined}
									>
										<box flexDirection="row" justifyContent="space-between" gap={1}>
											<text fg={transcriptRoleColor(message)}>{message.role.toUpperCase()}</text>
											<text fg={theme.muted}>{truncate(message.time, 12)}</text>
										</box>
										<Show when={getVisibleMessageContent(message)}>
											<text fg={theme.text} wrapMode="word">{getVisibleMessageContent(message)}</text>
										</Show>
										<Show when={message.images?.length}>
											<box flexDirection="column" gap={1}>
												<text fg={theme.muted}>{attachmentSummaryLabel(message.images!.length)}</text>
												<box flexDirection="row" gap={1}>
													<For each={message.images}>
														{(attachment) => (
															<box backgroundColor={theme.panelMuted} paddingLeft={1} paddingRight={1}>
																<text fg={theme.accent}>{truncate(attachment.label, 24)}</text>
															</box>
														)}
													</For>
												</box>
											</box>
										</Show>
										<Show when={message.collapsible && isMessageOverflowing(message)}>
											<text fg={theme.muted}>{message.expanded ? "Click to collapse" : "Click to expand"}</text>
										</Show>
									</box>
								)
							}
						</For>
					</Show>
				</box>
			</scrollbox>
		</box>
	);
}
