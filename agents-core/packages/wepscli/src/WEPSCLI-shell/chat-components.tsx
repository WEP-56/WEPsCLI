import { useKeyboard } from "@opentui/solid";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { getSlashCommands } from "./slash-commands.js";
import { wepscliShellTheme as theme } from "./theme.js";
import type { ToolMessageState } from "./tool-messages.js";
import type { OverlayOption } from "./types.js";

export type ComposerInputRef = {
	value?: string;
	plainText?: string;
	focus(): void;
	blur(): void;
	setText?(text: string): void;
};
export type ChatMessageRole = "system" | "user" | "assistant";
export type ChatMessageKind = "default" | "status" | "tool" | "reasoning";

export interface ChatMessage {
	id: string;
	role: ChatMessageRole;
	content: string;
	time: string;
	kind?: ChatMessageKind;
	collapsible?: boolean;
	expanded?: boolean;
	tool?: ToolMessageState;
}

export function ChatTopBar(props: {
	logo: string;
	sessionTitle: string;
	providerLabel: string;
	modelLabel: string;
	statusLabel: string;
	onAction: (id: string) => void;
}) {
	return (
		<box flexShrink={0} backgroundColor={theme.header} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} flexDirection="column" gap={1}>
			<box flexDirection="row" justifyContent="space-between" gap={1}>
				<box flexDirection="row" gap={1} minWidth={0} flexGrow={1}>
					<text fg={theme.accentStrong}>{props.logo}</text>
					<text fg={theme.text}>{truncateText(props.sessionTitle, 40)}</text>
				</box>
				<text fg={theme.muted}>{truncateText(props.statusLabel, 40)}</text>
			</box>
			<box flexDirection="row" gap={1}>
				<Chip label={`Provider ${truncateText(props.providerLabel, 14)}`} tone="accent" onClick={() => props.onAction("overlay:provider")} />
				<Chip label={`Model ${truncateText(props.modelLabel, 14)}`} tone="muted" onClick={() => props.onAction("overlay:model")} />
				<Chip label="New" tone="accent" onClick={() => props.onAction("session:new")} />
				<Chip label="Sessions" tone="muted" onClick={() => props.onAction("overlay:session")} />
			</box>
		</box>
	);
}

export function ChatTranscript(props: { messages: ChatMessage[]; emptyHint: string; activeModelLabel: string }) {
	return (
		<box flexGrow={1} minHeight={0} backgroundColor={theme.panel} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} flexDirection="column" gap={1}>
			<box flexDirection="row" justifyContent="space-between" gap={1}>
				<text fg={theme.accent}>Conversation</text>
				<text fg={theme.muted}>{truncateText(props.activeModelLabel, 32)}</text>
			</box>
			<scrollbox flexGrow={1} minHeight={0}>
				<box flexDirection="column" gap={1}>
					<Show
						when={props.messages.length > 0}
						fallback={
							<box backgroundColor={theme.panelAlt} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} flexDirection="column" gap={1}>
								<text fg={theme.accentStrong}>Ready for a task</text>
								<text fg={theme.text} wrapMode="word">{props.emptyHint}</text>
								<text fg={theme.muted} wrapMode="word">Enter a prompt below, or type / for commands.</text>
							</box>
						}
					>
						<For each={props.messages}>{(message) => <MessageBubble message={message} />}</For>
					</Show>
				</box>
			</scrollbox>
		</box>
	);
}

export function ChatComposer(props: {
	focused: boolean;
	value: string;
	providerLabel: string;
	modelLabel: string;
	inputRef: (ref: ComposerInputRef) => void;
	onAction: (id: string) => void;
	onFocus: () => void;
	onInput: (value: string) => void;
	onSubmit: (value: string) => void;
	onSelectSlashCommand: (id: string) => void;
}) {
	let inputRef: ComposerInputRef | undefined;
	const [draftValue, setDraftValue] = createSignal(props.value);
	const [slashIndex, setSlashIndex] = createSignal(0);
	const slashOptions = createMemo(() => getSlashCommands(draftValue()));
	const visibleSlashOptions = createMemo(() => slashOptions().slice(0, 6));

	createEffect(() => {
		const nextValue = props.value;
		setDraftValue(nextValue);
		if (!nextValue.trim().startsWith("/")) setSlashIndex(0);
	});

	useKeyboard((evt) => {
		if (!props.focused || visibleSlashOptions().length === 0 || !draftValue().trim().startsWith("/")) {
			return;
		}

		if (evt.name === "up") {
			evt.preventDefault();
			setSlashIndex((current) => (current <= 0 ? visibleSlashOptions().length - 1 : current - 1));
			return;
		}

		if (evt.name === "down") {
			evt.preventDefault();
			setSlashIndex((current) => (current + 1) % visibleSlashOptions().length);
			return;
		}

		if (evt.name === "return") {
			const command = visibleSlashOptions()[slashIndex()] ?? visibleSlashOptions()[0];
			if (!command) {
				return;
			}
			evt.preventDefault();
			props.onSelectSlashCommand(command.id);
		}
	});

	function updateValue(nextValue: string) {
		setDraftValue(nextValue);
		if (!nextValue.trim().startsWith("/")) setSlashIndex(0);
		props.onInput(nextValue);
	}

	function submitCurrentValue(value: string) {
		const matchingCommands = getSlashCommands(value).slice(0, 6);
		if (value.trim().startsWith("/") && matchingCommands.length > 0) {
			const command = matchingCommands[slashIndex()] ?? matchingCommands[0];
			if (command) {
				props.onSelectSlashCommand(command.id);
				return;
			}
		}
		props.onSubmit(value);
	}

	return (
		<box flexShrink={0} backgroundColor={theme.panelAlt} border={["top", "right", "bottom", "left"]} borderColor={props.focused ? theme.accent : theme.border} paddingLeft={1} paddingRight={1} paddingTop={0} paddingBottom={0} flexDirection="column" gap={0}>
			{visibleSlashOptions().length > 0 ? (
				<box backgroundColor={theme.panel} border={["bottom"]} borderColor={theme.border} paddingLeft={1} paddingRight={1} paddingTop={0} paddingBottom={0} flexDirection="column" gap={0}>
					<For each={visibleSlashOptions()}>
						{(option, index) => (
							<box backgroundColor={slashIndex() === index() ? theme.accent : theme.panelAlt} paddingLeft={1} paddingRight={1} flexDirection="row" onMouseUp={() => props.onSelectSlashCommand(option.id)}>
								<text fg={slashIndex() === index() ? theme.background : theme.text}>{truncateText(option.label, 24)}</text>
							</box>
						)}
					</For>
				</box>
			) : null}
			<box backgroundColor={theme.panelAlt} paddingLeft={0} paddingRight={0} paddingTop={0} paddingBottom={0} flexDirection="column" gap={0} onMouseUp={props.onFocus}>
				<input
					ref={(ref: ComposerInputRef) => {
						inputRef = ref;
						props.inputRef(ref);
					}}
					focused={props.focused}
					value={draftValue()}
					placeholder="Type / or ask"
					backgroundColor={theme.panelAlt}
					textColor={theme.text}
					focusedBackgroundColor={theme.panelAlt}
					focusedTextColor={theme.text}
					cursorColor={theme.accent}
					onMouseUp={props.onFocus}
					onInput={(value: string) => updateValue(value)}
					onSubmit={(value: string) => submitCurrentValue(value)}
				/>
			</box>
		</box>
	);
}

export function ChatSidebar(props: {
	sessionTitle: string;
	sessionSummary: string;
	providerLabel: string;
	modelLabel: string;
	recentSessions: { id: string; title: string; summary: string; state: string }[];
	onOpenSession: (id: string) => void;
	onAction: (id: string) => void;
}) {
	return (
		<box width={34} backgroundColor={theme.panelMuted} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} flexDirection="column" gap={1}>
			<text fg={theme.accent}>Context</text>
			<MetaRow label="Session" value={truncateText(props.sessionTitle, 18)} />
			<MetaRow label="Summary" value={truncateText(props.sessionSummary, 18)} />
			<MetaRow label="Provider" value={truncateText(props.providerLabel, 18)} />
			<MetaRow label="Model" value={truncateText(props.modelLabel, 18)} />
			<text fg={theme.accent}>Recent chats</text>
			<For each={props.recentSessions.slice(0, 4)}>
				{(session) => (
					<box backgroundColor={theme.panel} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} flexDirection="column" gap={1} onMouseUp={() => props.onOpenSession(session.id)}>
						<box flexDirection="row" justifyContent="space-between" gap={1}>
							<text fg={theme.text}>{truncateText(session.title, 20)}</text>
							<text fg={session.state === "active" ? theme.success : theme.muted}>{truncateText(session.state.toUpperCase(), 8)}</text>
						</box>
						<text fg={theme.muted} wrapMode="word">{truncateText(session.summary, 28)}</text>
					</box>
				)}
			</For>
			<text fg={theme.accent}>Shortcuts</text>
			<text fg={theme.muted} wrapMode="word">Tab focus | h home | p provider | m model | s sessions</text>
			<MiniChip label="Provider" tone="accent" onClick={() => props.onAction("overlay:provider")} />
			<MiniChip label="Model" tone="muted" onClick={() => props.onAction("overlay:model")} />
			<MiniChip label="New chat" tone="accent" onClick={() => props.onAction("session:new")} />
		</box>
	);
}

export function OverlayPicker(props: {
	title: string;
	description: string;
	options: OverlayOption[];
	selectedIndex: number;
	onClose: () => void;
	onSelect: (id: string, index: number) => void;
}) {
	return (
		<box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
			<box width="70%" maxWidth={80} backgroundColor={theme.panelAlt} border={["top", "right", "bottom", "left"]} borderColor={theme.accent} padding={1} flexDirection="column" gap={1}>
				<box flexDirection="row" justifyContent="space-between" gap={1}>
					<text fg={theme.accentStrong}>{truncateText(props.title, 32)}</text>
					<text fg={theme.muted} onMouseUp={props.onClose}>esc</text>
				</box>
				<text fg={theme.muted} wrapMode="word">{truncateText(props.description, 96)}</text>
				<Show when={props.options.length > 0} fallback={<text fg={theme.warning}>No options are available yet.</text>}>
					<scrollbox maxHeight={12}>
						<box flexDirection="column" gap={1}>
							<For each={props.options}>
								{(option, index) => (
									<box
										backgroundColor={props.selectedIndex === index() ? theme.accent : theme.panel}
										paddingLeft={1}
										paddingRight={1}
										paddingTop={1}
										paddingBottom={1}
										flexDirection="column"
										onMouseUp={() => props.onSelect(option.id, index())}
									>
										<box flexDirection="row" justifyContent="space-between" gap={1}>
											<text fg={props.selectedIndex === index() ? theme.background : theme.text}>{truncateText(option.label, 28)}</text>
											{option.badge ? <text fg={props.selectedIndex === index() ? theme.background : theme.success}>{truncateText(option.badge, 10)}</text> : null}
										</box>
										<text fg={props.selectedIndex === index() ? theme.background : theme.muted} wrapMode="word">{option.description}</text>
									</box>
								)}
							</For>
						</box>
					</scrollbox>
				</Show>
			</box>
		</box>
	);
}

function MessageBubble(props: { message: ChatMessage }) {
	const tone = props.message.role === "user" ? theme.accent : props.message.role === "assistant" ? theme.success : theme.muted;
	return (
		<box backgroundColor={theme.panelAlt} border={["top", "right", "bottom", "left"]} borderColor={tone} padding={1} flexDirection="column" gap={1}>
			<box flexDirection="row" justifyContent="space-between" gap={1}>
				<text fg={tone}>{props.message.role.toUpperCase()}</text>
				<text fg={theme.muted}>{truncateText(props.message.time, 12)}</text>
			</box>
			<text fg={theme.text} wrapMode="word">{props.message.content}</text>
		</box>
	);
}

function MetaRow(props: { label: string; value: string }) {
	return (
		<box flexDirection="row" justifyContent="space-between" gap={1}>
			<text fg={theme.muted}>{props.label}</text>
			<text fg={theme.text}>{truncateText(props.value, 18)}</text>
		</box>
	);
}

function Chip(props: { label: string; tone: "accent" | "muted"; onClick: () => void }) {
	const backgroundColor = props.tone === "accent" ? theme.accent : theme.panel;
	const foregroundColor = props.tone === "accent" ? theme.background : theme.text;
	return (
		<box backgroundColor={backgroundColor} paddingLeft={1} paddingRight={1} onMouseUp={props.onClick}>
			<text fg={foregroundColor}>{truncateText(props.label, 24)}</text>
		</box>
	);
}

function MiniChip(props: { label: string; tone: "accent" | "muted"; onClick: () => void }) {
	return <Chip {...props} />;
}

function truncateText(value: string, maxLength: number): string {
	return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
