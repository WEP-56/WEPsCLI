import { type Component, type Focusable, getKeybindings, Input, Key, matchesKey, type TUI } from "@mariozechner/pi-tui";
import { getAgentDir } from "../config.js";
import { type ProviderProfile, ProviderProfileService } from "../provider-profiles/index.js";
import { ShellAnimator } from "./animator.js";
import { type LocalClickableRegion, renderActionChips, renderProviderButtons } from "./clickables.js";
import { getFocusLabel, type ShellFocusRegion, shellKeymap } from "./keymap.js";
import type { ParsedMouseEvent } from "./mouse.js";
import { computeShellLayout, fitLines, framePanelFixed, joinColumns, padLine } from "./render.js";
import { getPanelStyle, pulseDot, shellTheme, shimmerText } from "./theme.js";

interface GlobalClickableRegion extends LocalClickableRegion {
	row: number;
	col: number;
}

export class DashboardShell implements Component, Focusable {
	private readonly composer = new Input();
	private readonly timeline: string[] = [];
	private readonly animator: ShellAnimator;
	private profiles: ProviderProfile[] = [];
	private selectedProviderIndex = 0;
	private focusRegion: ShellFocusRegion = "composer";
	private actionRegions: GlobalClickableRegion[] = [];
	private providerRegions: GlobalClickableRegion[] = [];
	private composerInputRegion?: { row: number; col: number; width: number; height: number };
	private _focused = false;

	constructor(
		private readonly ui: TUI,
		private readonly profileService: ProviderProfileService,
		private readonly onExit: () => void,
	) {
		this.animator = new ShellAnimator(ui);
		this.reloadProfiles();

		this.composer.onSubmit = (value) => {
			const trimmed = value.trim();
			if (!trimmed) return;
			this.timeline.unshift(`Draft queued: ${trimmed}`);
			this.composer.setValue("");
			this.ui.requestRender();
		};

		this.composer.onEscape = () => {
			if (!this.composer.getValue().trim()) {
				this.onExit();
			}
		};
	}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		this.composer.focused = value && this.focusRegion === "composer";
	}

	dispose(): void {
		this.animator.dispose();
	}

	invalidate(): void {
		this.composer.invalidate();
	}

	handleInput(data: string): void {
		const kb = getKeybindings();
		if (matchesKey(data, Key.ctrl("c"))) {
			this.onExit();
			return;
		}

		if (kb.matches(data, "tui.input.tab")) {
			this.focusRegion = this.focusRegion === "composer" ? "workspace" : "composer";
			this.composer.focused = this._focused && this.focusRegion === "composer";
			this.animator.markFocusPulse();
			this.ui.requestRender();
			return;
		}

		if (this.focusRegion === "workspace") {
			this.handleWorkspaceInput(data);
			return;
		}

		this.composer.handleInput(data);
	}

	handleMouseEvent(event: ParsedMouseEvent): boolean {
		if (event.action === "scroll") {
			if (this.hitAny(event.col, event.row, this.providerRegions)) {
				const delta = event.button === "wheel-up" ? -1 : event.button === "wheel-down" ? 1 : 0;
				if (delta !== 0) {
					this.moveProviderSelection(delta);
				}
				return true;
			}
			return false;
		}

		const actionTarget = this.findHit(event.col, event.row, this.actionRegions);
		if (actionTarget && this.isPrimaryMouseActivation(event)) {
			this.activateAction(actionTarget.id);
			return true;
		}

		const providerTarget = this.findHit(event.col, event.row, this.providerRegions);
		if (providerTarget && this.isPrimaryMouseActivation(event)) {
			this.focusRegion = "workspace";
			this.composer.focused = false;
			this.animator.markFocusPulse();
			this.activateProviderById(providerTarget.id);
			return true;
		}

		if (this.composerInputRegion && this.pointInRect(event.col, event.row, this.composerInputRegion)) {
			if (this.isPrimaryMouseActivation(event)) {
				this.focusRegion = "composer";
				this.composer.focused = this._focused;
				this.animator.markFocusPulse();
				this.ui.requestRender();
			}
			return true;
		}

		return false;
	}

	render(width: number): string[] {
		this.reloadProfiles();
		const height = this.ui.terminal.rows;
		const layout = computeShellLayout(width, height);
		const animation = this.animator.getSnapshot();

		const headerLines = fitLines(
			[
				shellTheme.headerBackground(` ${shimmerText("WEPSCLI DASHBOARD", animation.frame)} `),
				shellTheme.headerBackground(
					padLine(
						shellTheme.muted(
							` Focus ${shellTheme.accent(getFocusLabel(this.focusRegion))} | Provider cards ${shellTheme.accent(shellKeymap.navigate)} ${shellTheme.accent(shellKeymap.select)} | Focus switch ${shellTheme.accent(shellKeymap.switchFocus)} `,
						),
						width,
					),
				),
				shellTheme.headerBackground(padLine(shellTheme.muted(` Config root ${getAgentDir()} `), width)),
			],
			width,
			layout.headerHeight,
		);

		this.actionRegions = [];
		this.providerRegions = [];
		this.composerInputRegion = undefined;

		const mainLines = animation.showMain
			? this.renderMainPanel(layout.mainWidth, layout.bodyHeight, animation.frame, animation.focusPulseActive, layout.headerHeight)
			: fitLines([shimmerText("Booting workspace surface...", animation.frame)], layout.mainWidth, layout.bodyHeight);

		const statusLines = layout.showStatusPanel
			? animation.showStatus
				? this.renderStatusPanel(layout.statusWidth, layout.bodyHeight, animation.frame, animation.focusPulseActive)
				: fitLines([shimmerText("Initializing status surface...", animation.frame + 4)], layout.statusWidth, layout.bodyHeight)
			: [];

		const bodyLines = layout.showStatusPanel
			? joinColumns(mainLines, layout.mainWidth, statusLines, layout.statusWidth, layout.gap)
			: mainLines;

		const dockLines = animation.showDock
			? this.renderDock(width, layout.dockHeight, animation.focusPulseActive, layout.headerHeight + layout.bodyHeight)
			: fitLines([shimmerText("Preparing composer dock...", animation.frame + 8)], width, layout.dockHeight);

		return [...headerLines, ...bodyLines, ...dockLines];
	}

	private handleWorkspaceInput(data: string): void {
		const kb = getKeybindings();
		if (kb.matches(data, "tui.select.cancel")) {
			this.onExit();
			return;
		}
		if (kb.matches(data, "tui.select.up")) {
			this.moveProviderSelection(-1);
			return;
		}
		if (kb.matches(data, "tui.select.down")) {
			this.moveProviderSelection(1);
			return;
		}
		if (kb.matches(data, "tui.select.confirm")) {
			const profile = this.profiles[this.selectedProviderIndex];
			if (profile) {
				this.switchActiveProfile(profile);
			}
		}
	}

	private reloadProfiles(): void {
		this.profiles = this.profileService.listProfiles();
		if (this.profiles.length === 0) {
			this.selectedProviderIndex = 0;
			return;
		}

		const selection = this.profileService.getActiveSelection();
		const activeIndex = selection.profileId ? this.profiles.findIndex((item) => item.id === selection.profileId) : -1;
		if (activeIndex >= 0 && (this.selectedProviderIndex < 0 || this.selectedProviderIndex >= this.profiles.length)) {
			this.selectedProviderIndex = activeIndex;
			return;
		}
		if (activeIndex >= 0 && this.selectedProviderIndex === 0 && this.profiles.length === 1) {
			this.selectedProviderIndex = activeIndex;
			return;
		}
		this.selectedProviderIndex = Math.max(0, Math.min(this.selectedProviderIndex, this.profiles.length - 1));
	}

	private moveProviderSelection(delta: number): void {
		if (this.profiles.length === 0) return;
		const next = this.selectedProviderIndex + delta;
		if (next < 0) {
			this.selectedProviderIndex = this.profiles.length - 1;
		} else if (next >= this.profiles.length) {
			this.selectedProviderIndex = 0;
		} else {
			this.selectedProviderIndex = next;
		}
		this.focusRegion = "workspace";
		this.composer.focused = false;
		this.animator.markFocusPulse();
		this.ui.requestRender();
	}

	private renderMainPanel(width: number, height: number, frame: number, focusPulseActive: boolean, headerHeight: number): string[] {
		const innerWidth = Math.max(1, width - 2);
		const selection = this.profileService.getActiveSelection();
		const activeProfile = selection.profileId ? this.profiles.find((item) => item.id === selection.profileId) : undefined;
		const providerRows = renderProviderButtons(this.profiles, this.selectedProviderIndex, selection.profileId, innerWidth);

		const body = [
			shellTheme.accent("Workspace"),
			padLine(
				activeProfile
					? shellTheme.text(`Current provider: ${activeProfile.label} (${activeProfile.family})`)
					: shellTheme.warning("No active provider selected."),
				innerWidth,
			),
			padLine(
				selection.modelId ? shellTheme.text(`Current model: ${selection.modelId}`) : shellTheme.text("Current model: none"),
				innerWidth,
			),
			padLine(shellTheme.muted("Provider entries below are the actual switch controls. Click a row or press Enter."), innerWidth),
			"",
			padLine(shellTheme.accent(`Provider Controls ${shellTheme.accentSoft(`[${pulseDot(frame)}]`)}`), innerWidth),
			...providerRows.lines.map((line) => padLine(line, innerWidth)),
			"",
			padLine(shellTheme.accent("Timeline"), innerWidth),
			...(this.timeline.length > 0
				? this.timeline.slice(0, Math.max(1, height - 12)).map((line) => padLine(shellTheme.text(line), innerWidth))
				: [padLine(shellTheme.muted("No local dashboard activity yet. Use the composer below to populate this timeline."), innerWidth)]),
		];

		const panelTopRow = headerHeight + 1;
		const providerBaseRow = panelTopRow + 1 + 6;
		this.providerRegions = providerRows.regions.map((region) => ({
			...region,
			row: providerBaseRow + region.row,
			col: 2,
		}));

		return framePanelFixed(
			this.focusRegion === "workspace" ? "Main Workspace [active]" : "Main Workspace",
			body,
			width,
			height,
			getPanelStyle("main", this.focusRegion === "workspace", this.focusRegion === "workspace" && focusPulseActive),
		);
	}

	private renderStatusPanel(width: number, height: number, frame: number, focusPulseActive: boolean): string[] {
		const innerWidth = Math.max(1, width - 2);
		const selection = this.profileService.getActiveSelection();
		const activeProfile = selection.profileId ? this.profiles.find((item) => item.id === selection.profileId) : undefined;
		const body = [
			padLine(shellTheme.accent("State"), innerWidth),
			padLine(shellTheme.success(`Task status: idle ${pulseDot(frame)}`), innerWidth),
			padLine(shellTheme.text("Mode: solo"), innerWidth),
			"",
			padLine(shellTheme.accent("Context"), innerWidth),
			padLine(shellTheme.text("Usage: stub"), innerWidth),
			padLine(shellTheme.text("Window: stub"), innerWidth),
			"",
			padLine(shellTheme.accent("Todo"), innerWidth),
			padLine(shellTheme.text("1. Hook dashboard into real session history"), innerWidth),
			padLine(shellTheme.text("2. Replace local draft timeline with agent timeline"), innerWidth),
			padLine(shellTheme.text("3. Wire mode/model/session controls into dock dialogs"), innerWidth),
			"",
			padLine(shellTheme.accent("Selection"), innerWidth),
			padLine(shellTheme.text(`Provider: ${activeProfile?.label ?? "none"}`), innerWidth),
			padLine(shellTheme.text(`Model: ${selection.modelId ?? "none"}`), innerWidth),
		];

		return framePanelFixed("Status Panel", body, width, height, getPanelStyle("status", false, focusPulseActive));
	}

	private renderDock(width: number, height: number, focusPulseActive: boolean, bodyStartRow: number): string[] {
		const innerWidth = Math.max(1, width - 2);
		const selection = this.profileService.getActiveSelection();
		const activeProfile = selection.profileId ? this.profiles.find((item) => item.id === selection.profileId) : undefined;
		const actionChips = renderActionChips(
			[
				{ id: "provider", label: `Provider: ${activeProfile?.label ?? "none"}`, variant: "accent" },
				{ id: "model", label: `Model: ${selection.modelId ?? "none"}`, variant: "muted" },
				{ id: "mode", label: "Mode: solo", variant: "muted" },
				{ id: "session", label: "Session", variant: "muted" },
				{ id: "focus", label: "Focus Composer", variant: "active" },
			],
			innerWidth,
		);

		const composerLines = this.composer.render(innerWidth);
		const actionBaseRow = bodyStartRow + 1;
		this.actionRegions = actionChips.regions.map((region) => ({
			...region,
			row: actionBaseRow + region.row,
			col: 2 + region.col,
		}));

		const composerRowOffset = actionChips.lines.length + 2;
		this.composerInputRegion = {
			row: bodyStartRow + 1 + composerRowOffset,
			col: 2,
			width: innerWidth,
			height: Math.max(1, composerLines.length),
		};

		const body = [
			...actionChips.lines.map((line) => padLine(line, innerWidth)),
			"",
			padLine(shellTheme.accent("Composer"), innerWidth),
			...composerLines.map((line) => padLine(line, innerWidth)),
			padLine(
				shellTheme.muted(
					`Focus ${getFocusLabel(this.focusRegion)} | Use the chips above as explicit controls`,
				),
				innerWidth,
			),
			padLine(
				shellTheme.muted(
					`Keys: ${shellKeymap.switchFocus} focus | ${shellKeymap.select} select/submit | ${shellKeymap.exit} exit`,
				),
				innerWidth,
			),
		];

		return framePanelFixed(
			this.focusRegion === "composer" ? "Bottom Dock [active]" : "Bottom Dock",
			body,
			width,
			height,
			getPanelStyle("dock", this.focusRegion === "composer", this.focusRegion === "composer" && focusPulseActive),
		);
	}

	private activateProviderById(profileId: string): void {
		const index = this.profiles.findIndex((item) => item.id === profileId);
		if (index === -1) return;
		this.selectedProviderIndex = index;
		this.switchActiveProfile(this.profiles[index]!);
	}

	private activateAction(actionId: string): void {
		switch (actionId) {
			case "focus":
				this.focusRegion = "composer";
				this.composer.focused = this._focused;
				this.timeline.unshift("Composer focus selected from dock controls.");
				break;
			case "provider":
				this.focusRegion = "workspace";
				this.composer.focused = false;
				this.timeline.unshift("Provider control selected. Use provider rows to switch explicitly.");
				break;
			case "model":
				this.timeline.unshift("Model dialog placeholder selected. UI wiring comes next.");
				break;
			case "mode":
				this.timeline.unshift("Mode dialog placeholder selected. UI wiring comes next.");
				break;
			case "session":
				this.timeline.unshift("Session control placeholder selected. UI wiring comes next.");
				break;
			default:
				return;
		}

		this.animator.markFocusPulse();
		this.ui.requestRender();
	}

	private findHit(col: number, row: number, regions: GlobalClickableRegion[]): GlobalClickableRegion | undefined {
		return regions.find((region) => this.pointInRect(col, row, region));
	}

	private hitAny(col: number, row: number, regions: GlobalClickableRegion[]): boolean {
		return this.findHit(col, row, regions) !== undefined;
	}

	private pointInRect(col: number, row: number, rect: { col: number; row: number; width: number; height: number }): boolean {
		return col >= rect.col && col < rect.col + rect.width && row >= rect.row && row < rect.row + rect.height;
	}

	private isPrimaryMouseActivation(event: ParsedMouseEvent): boolean {
		return event.button === "left" && (event.action === "press" || event.action === "release");
	}

	private switchActiveProfile(profile: ProviderProfile): void {
		const selection = this.profileService.getActiveSelection();
		const nextModel = profile.models[0]?.id;
		const isSameSelection = selection.profileId === profile.id && selection.modelId === nextModel;

		if (!isSameSelection) {
			this.profileService.setActiveSelection(profile.id, nextModel);
			this.timeline.unshift(`Active provider switched to ${profile.label}${nextModel ? ` (${nextModel})` : ""}`);
		}

		this.animator.markFocusPulse();
		this.ui.requestRender();
	}
}
