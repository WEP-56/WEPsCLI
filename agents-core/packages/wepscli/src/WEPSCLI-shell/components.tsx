import { useKeyboard } from "@opentui/solid";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { getSlashCommands } from "./slash-commands.js";
import { wepscliShellTheme as theme } from "./theme.js";
import type { CardTag, MainCard, MainHero, OverlayOption, ShellView, TagTone } from "./types.js";

export type ComposerInputRef = { value: string; focus(): void; blur(): void };

export function HeaderBar(props: {
	providerLabel: string;
	modelLabel: string;
	activeView: ShellView;
	onAction: (id: string) => void;
	onNavigate: (view: ShellView) => void;
}) {
	return (
		<box flexShrink={0} backgroundColor={theme.header} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} flexDirection="column" gap={1}>
			<box flexDirection="row" justifyContent="space-between">
				<text fg={theme.accentStrong}>WEPSCLI-SHELL</text>
				<text fg={theme.muted}>Tab focus | h home | p providers | m models | s sessions</text>
			</box>
			<box flexDirection="row" gap={1}>
				<HeaderChip label="Home" tone={props.activeView === "home" ? "accent" : "muted"} onClick={() => props.onNavigate("home")} />
				<HeaderChip label="Providers" tone={props.activeView === "providers" ? "accent" : "muted"} onClick={() => props.onNavigate("providers")} />
				<HeaderChip label="History" tone={props.activeView === "history" ? "accent" : "muted"} onClick={() => props.onNavigate("history")} />
				<HeaderSpacer />
				<HeaderChip label="New Session" tone="accent" onClick={() => props.onAction("session:new")} />
				<HeaderChip label={`Provider ${props.providerLabel}`} tone="accent" onClick={() => props.onAction("overlay:provider")} />
				<HeaderChip label={`Model ${props.modelLabel}`} tone="muted" onClick={() => props.onAction("overlay:model")} />
				<HeaderChip label="Sessions" tone="muted" onClick={() => props.onAction("overlay:session")} />
			</box>
		</box>
	);
}

export function MainPanel(props: {
	viewLabel: string;
	focused: boolean;
	cards: MainCard[];
	selectedIndex: number;
	timeline: string[];
	hero?: MainHero;
	sectionLabel?: string;
	onSelect: (id: string, index: number) => void;
}) {
	return (
		<box flexGrow={1} minWidth={0} backgroundColor={theme.panel} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} flexDirection="column" gap={1}>
			<text fg={theme.accent}>Workspace [{props.viewLabel}]</text>
			<text fg={theme.muted}>{props.sectionLabel ?? "Primary actions and timeline live here."}</text>
			<scrollbox flexGrow={1} minHeight={0} scrollbarOptions={{ visible: false }}>
				<box flexDirection="column" gap={1}>
					{props.hero ? (
							<box backgroundColor={theme.panelAlt} border={["top", "right", "bottom", "left"]} borderColor={theme.accent} padding={1} flexDirection="column" gap={1}>
								<text fg={theme.accentStrong}>{props.hero.title}</text>
								<text fg={theme.muted}>{props.hero.subtitle}</text>
								<box flexDirection="row" gap={1}>
									<For each={props.hero.tags}>
										{(tag) => <TagPill tag={tag} />}
									</For>
								</box>
								<For each={props.hero.lines}>
									{(line, index) => <text fg={index() === 0 ? theme.text : theme.muted}>{line}</text>}
								</For>
							</box>
					) : null}
					<For each={props.cards}>
						{(card, index) => (
							<CardButton
								card={card}
								selected={props.focused && props.selectedIndex === index()}
								onClick={() => props.onSelect(card.id, index())}
							/>
						)}
					</For>
					<box backgroundColor={theme.panelAlt} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} flexDirection="column" gap={1}>
						<text fg={theme.accent}>Conversation / Activity</text>
						<For each={props.timeline}>
							{(line) => <text fg={theme.text}>{line}</text>}
						</For>
					</box>
				</box>
			</scrollbox>
		</box>
	);
}

export function InspectorPanel(props: {
	profilesCount: number;
	activeProvider?: string;
	activeModel?: string;
	onboardingComplete: boolean;
	focusLabel: string;
	detailTitle: string;
	detailLines: string[];
	todoLines: string[];
}) {
	return (
		<box width={34} backgroundColor={theme.panelMuted} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} flexDirection="column" gap={1}>
			<text fg={theme.accent}>Inspector</text>
			<InspectorLine label="Onboarding" value={props.onboardingComplete ? "Complete" : "Pending"} />
			<InspectorLine label="Profiles" value={String(props.profilesCount)} />
			<InspectorLine label="Provider" value={props.activeProvider ?? "none"} />
			<InspectorLine label="Model" value={props.activeModel ?? "none"} />
			<InspectorLine label="Focus" value={props.focusLabel} />
			<text fg={theme.accent}>{props.detailTitle}</text>
			<For each={props.detailLines}>
				{(line, index) => <text fg={index() === 0 ? theme.text : theme.muted}>{line}</text>}
			</For>
			<text fg={theme.accent}>Todo</text>
			<For each={props.todoLines}>
				{(line) => <text fg={theme.muted}>{line}</text>}
			</For>
		</box>
	);
}

export function DockPanel(props: {
	activeProvider: string;
	activeModel: string;
	focused: boolean;
	value: string;
	onAction: (id: string) => void;
	inputRef: (ref: ComposerInputRef) => void;
	onFocusComposer: () => void;
	onInput: (value: string) => void;
	onSubmit: (value: string) => void;
	onSelectSlashCommand: (id: string) => void;
}) {
	const [draftValue, setDraftValue] = createSignal(props.value);
	const [slashIndex, setSlashIndex] = createSignal(0);
	const slashOptions = createMemo(() => getSlashCommands(draftValue()));

	createEffect(() => {
		setDraftValue(props.value);
		if (!props.value.trim().startsWith("/")) {
			setSlashIndex(0);
		}
	});

	useKeyboard((evt) => {
		if (!props.focused || slashOptions().length === 0) {
			return;
		}

		if (evt.name === "up") {
			evt.preventDefault();
			setSlashIndex((current) => (current <= 0 ? slashOptions().length - 1 : current - 1));
			return;
		}

		if (evt.name === "down") {
			evt.preventDefault();
			setSlashIndex((current) => (current + 1) % slashOptions().length);
			return;
		}

		if (evt.name === "return" && draftValue().trim().startsWith("/")) {
			const command = slashOptions()[slashIndex()] ?? slashOptions()[0];
			if (!command) {
				return;
			}
			evt.preventDefault();
			props.onSelectSlashCommand(command.id);
		}
	});

	return (
		<box flexShrink={0} backgroundColor={theme.panelAlt} border={["top", "right", "bottom", "left"]} borderColor={theme.border} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} flexDirection="column" gap={1} marginLeft={1} marginRight={1}>
			<box flexDirection="row" gap={1}>
				<HeaderChip label={`Provider ${props.activeProvider}`} tone="accent" onClick={() => props.onAction("overlay:provider")} />
				<HeaderChip label={`Model ${props.activeModel}`} tone="muted" onClick={() => props.onAction("overlay:model")} />
				<HeaderChip label="Sessions" tone="muted" onClick={() => props.onAction("overlay:session")} />
				<HeaderChip label="Commands" tone="muted" onClick={() => props.onAction("command-menu")} />
			</box>
			<box flexDirection="column" gap={1}>
				{slashOptions().length > 0 ? (
					<box backgroundColor={theme.panel} border={["top", "right", "bottom", "left"]} borderColor={theme.accent} padding={1} flexDirection="column" gap={1}>
						<text fg={theme.accent}>Slash Commands</text>
						<For each={slashOptions()}>
							{(option, index) => (
								<box
									backgroundColor={slashIndex() === index() ? theme.accent : theme.panelMuted}
									paddingLeft={1}
									paddingRight={1}
									paddingTop={1}
									paddingBottom={1}
									flexDirection="column"
									onMouseUp={() => props.onSelectSlashCommand(option.id)}
								>
									<box flexDirection="row" justifyContent="space-between">
										<text fg={slashIndex() === index() ? theme.background : theme.text}>{option.label}</text>
										{option.keyHint ? <text fg={slashIndex() === index() ? theme.background : theme.muted}>{option.keyHint}</text> : null}
									</box>
									<text fg={slashIndex() === index() ? theme.background : theme.muted}>{option.description}</text>
								</box>
							)}
						</For>
					</box>
				) : null}
				<box backgroundColor={theme.panel} border={["top", "right", "bottom", "left"]} borderColor={props.focused ? theme.accent : theme.border} paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1} flexDirection="column" gap={1} onMouseUp={props.onFocusComposer}>
					<input
						ref={(ref: ComposerInputRef) => props.inputRef(ref)}
						focused={props.focused}
						value={draftValue()}
						placeholder="Ask, edit, review, or type / for commands"
						backgroundColor={theme.panel}
						textColor={theme.text}
						focusedBackgroundColor={theme.panel}
						focusedTextColor={theme.text}
						cursorColor={theme.accent}
						onMouseUp={props.onFocusComposer}
						onInput={(value: string) => {
							setDraftValue(value);
							if (!value.trim().startsWith("/")) {
								setSlashIndex(0);
							}
							props.onInput(value);
						}}
						onSubmit={(value: string) => {
							const matchingCommands = getSlashCommands(value);
							if (value.trim().startsWith("/") && matchingCommands.length > 0) {
								const command = matchingCommands[slashIndex()] ?? matchingCommands[0];
								if (command) {
									props.onSelectSlashCommand(command.id);
									return;
								}
							}
							props.onSubmit(value);
						}}
					/>
					<text fg={props.focused ? theme.accentStrong : theme.muted}>
						{props.focused ? "Enter submit | Up/Down command menu | Esc exit when empty" : "Press Tab to focus composer"}
					</text>
				</box>
			</box>
		</box>
	);
}

export function PickerOverlay(props: {
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
				<box flexDirection="row" justifyContent="space-between">
					<text fg={theme.accentStrong}>{props.title}</text>
					<text fg={theme.muted} onMouseUp={props.onClose}>
						esc
					</text>
				</box>
				<text fg={theme.muted}>{props.description}</text>
				<Show
					when={props.options.length > 0}
					fallback={<text fg={theme.warning}>No options are available for this picker yet.</text>}
				>
					<scrollbox maxHeight={12} scrollbarOptions={{ visible: false }}>
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
										<box flexDirection="row" justifyContent="space-between">
											<text fg={props.selectedIndex === index() ? theme.background : theme.text}>{option.label}</text>
											{option.badge ? <text fg={props.selectedIndex === index() ? theme.background : theme.success}>{option.badge}</text> : null}
										</box>
										<text fg={props.selectedIndex === index() ? theme.background : theme.muted}>{option.description}</text>
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

function HeaderChip(props: { label: string; tone: "accent" | "muted"; onClick: () => void }) {
	const backgroundColor = props.tone === "accent" ? theme.accent : theme.panel;
	const foregroundColor = props.tone === "accent" ? theme.background : theme.text;
	return (
		<box backgroundColor={backgroundColor} paddingLeft={1} paddingRight={1} onMouseUp={props.onClick}>
			<text fg={foregroundColor}>{props.label}</text>
		</box>
	);
}

function HeaderSpacer() {
	return <box flexGrow={1} />;
}

function ChipButton(props: { label: string; active: boolean; selected: boolean }) {
	const backgroundColor = props.active ? theme.accent : props.selected ? theme.panelAlt : theme.panel;
	const foregroundColor = props.active ? theme.background : theme.text;
	return (
		<box backgroundColor={backgroundColor} paddingLeft={1} paddingRight={1}>
			<text fg={foregroundColor}>{props.label}</text>
		</box>
	);
}

function CardButton(props: { card: MainCard; selected: boolean; onClick: () => void }) {
	const accentColor = props.card.tone === "success" ? theme.success : props.card.tone === "muted" ? theme.muted : theme.accent;
	return (
		<box
			backgroundColor={props.selected ? theme.panelAlt : theme.panelMuted}
			border={["top", "right", "bottom", "left"]}
			borderColor={props.selected ? accentColor : theme.border}
			padding={1}
			flexDirection="column"
			gap={1}
			onMouseUp={props.onClick}
		>
			<text fg={theme.text}>{props.card.title}</text>
			{props.card.tags?.length ? (
				<box flexDirection="row" gap={1}>
					<For each={props.card.tags}>
						{(tag) => <TagPill tag={tag} compact={true} />}
					</For>
				</box>
			) : null}
			<For each={props.card.lines}>
				{(line, index) => <text fg={index() === 0 ? theme.text : theme.muted}>{line}</text>}
			</For>
			<text fg={accentColor}>{props.card.actionLabel}</text>
		</box>
	);
}

function TagPill(props: { tag: CardTag; compact?: boolean }) {
	const backgroundColor = props.tag.color ?? toneColor(props.tag.tone);
	const foregroundColor = props.tag.tone === "muted" ? theme.text : theme.background;
	return (
		<box backgroundColor={backgroundColor} paddingLeft={1} paddingRight={1}>
			<text fg={foregroundColor}>{props.tag.label}</text>
		</box>
	);
}

function InspectorLine(props: { label: string; value: string }) {
	return (
		<box flexDirection="row" justifyContent="space-between">
			<text fg={theme.muted}>{props.label}</text>
			<text fg={theme.text}>{props.value}</text>
		</box>
	);
}

function toneColor(tone: TagTone): string {
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
			return theme.border;
	}
}
