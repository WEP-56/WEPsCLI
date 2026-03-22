import type { ComposerInputRef } from "./chat-components.js";
import { wepscliShellTheme as theme } from "./theme.js";

export function OverlayTextInput(props: {
	title: string;
	description: string;
	label: string;
	value: string;
	placeholder: string;
	error?: string;
	hint?: string;
	inputRef?: (ref: ComposerInputRef) => void;
	onInput: (value: string) => void;
	onSubmit: (value: string) => void;
	onClose: () => void;
}) {
	return (
		<box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
			<box width="70%" maxWidth={84} backgroundColor={theme.panelAlt} border={["top", "right", "bottom", "left"]} borderColor={theme.accent} padding={1} flexDirection="column" gap={1}>
				<box flexDirection="row" justifyContent="space-between" gap={1}>
					<text fg={theme.accentStrong}>{props.title}</text>
					<text fg={theme.muted} onMouseUp={props.onClose}>esc</text>
				</box>
				<text fg={theme.muted} wrapMode="word">{props.description}</text>
				<text fg={theme.accent}>{props.label}</text>
				<box backgroundColor={theme.panel} border={["top", "right", "bottom", "left"]} borderColor={theme.border} paddingLeft={1} paddingRight={1} paddingTop={0} paddingBottom={0}>
					<input
						ref={props.inputRef}
						focused={true}
						value={props.value}
						placeholder={props.placeholder}
						backgroundColor={theme.panel}
						textColor={theme.text}
						focusedBackgroundColor={theme.panel}
						focusedTextColor={theme.text}
						cursorColor={theme.accent}
						onInput={props.onInput}
						onSubmit={props.onSubmit}
					/>
				</box>
				{props.error ? <text fg={theme.danger} wrapMode="word">{props.error}</text> : null}
				<text fg={theme.muted}>{props.hint ?? "Enter confirm | Esc back"}</text>
			</box>
		</box>
	);
}

export function OverlayNotice(props: {
	title: string;
	description: string;
	status: string;
	onClose: () => void;
}) {
	return (
		<box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
			<box width="60%" maxWidth={72} backgroundColor={theme.panelAlt} border={["top", "right", "bottom", "left"]} borderColor={theme.accent} padding={1} flexDirection="column" gap={1}>
				<box flexDirection="row" justifyContent="space-between" gap={1}>
					<text fg={theme.accentStrong}>{props.title}</text>
					<text fg={theme.muted} onMouseUp={props.onClose}>esc</text>
				</box>
				<text fg={theme.muted} wrapMode="word">{props.description}</text>
				<box backgroundColor={theme.panel} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1}>
					<text fg={theme.text} wrapMode="word">{props.status}</text>
				</box>
			</box>
		</box>
	);
}
