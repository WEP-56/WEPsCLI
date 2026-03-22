import { type Component, type Focusable, getKeybindings, Input, Key, matchesKey, type TUI } from "@mariozechner/pi-tui";
import { getAgentDir } from "../config.js";
import { type ProviderProfile, ProviderProfileService } from "../provider-profiles/index.js";
import { WorkbenchAnimator } from "./animator.js";
import type { ParsedMouseEvent } from "./mouse.js";
import { computeWorkbenchLayout, type Rect } from "./render.js";
import { renderWorkbench } from "./renderer.js";
import { workbenchTheme } from "./theme.js";
import type { ButtonVariant, ClickRegion, OverlayKind, OverlayOption, RailItem, SessionRecord, WorkbenchCard, WorkbenchFocus, WorkbenchView } from "./types.js";

export class WorkbenchShell implements Component, Focusable {
	private readonly composer = new Input();
	private readonly animator: WorkbenchAnimator;
	private readonly timeline: string[] = [];
	private readonly sessions: SessionRecord[] = [
		{
			id: "wepscli-shell-rebuild",
			title: "Continue WEPSCLI shell rebuild",
			summary: "Track the OpenCode-first workbench rewrite and validate the new control surfaces.",
			state: "active",
			updatedLabel: "Active now",
		},
		{
			id: "provider-setup-pass",
			title: "Provider setup sanity pass",
			summary: "Keep onboarding stable while the new shell grows around the existing provider runtime.",
			state: "recent",
			updatedLabel: "Earlier today",
		},
		{
			id: "visual-affordance-notes",
			title: "Clickable affordance notes",
			summary: "Capture which controls still feel like hidden targets and move them to cards, chips, or dialogs.",
			state: "ready",
			updatedLabel: "Queued",
		},
	];

	private profiles: ProviderProfile[] = [];
	private view: WorkbenchView = "home";
	private focusRegion: WorkbenchFocus = "main";
	private overlay?: OverlayKind;
	private railSelectionIndex = 0;
	private mainSelectionIndex = 0;
	private overlaySelectionIndex = 0;
	private toolbarRegions: ClickRegion[] = [];
	private railRegions: ClickRegion[] = [];
	private mainRegions: ClickRegion[] = [];
	private dockRegions: ClickRegion[] = [];
	private overlayRegions: ClickRegion[] = [];
	private composerRegion?: Rect;
	private _focused = false;

	constructor(
		private readonly ui: TUI,
		private readonly profileService: ProviderProfileService,
		private readonly onExit: () => void,
	) {
		this.animator = new WorkbenchAnimator(ui);
		this.reloadProfiles();
		this.seedTimeline();

		this.composer.onSubmit = (value) => {
			const trimmed = value.trim();
			if (!trimmed) return;
			if (this.handleComposerCommand(trimmed)) {
				this.composer.setValue("");
				this.ui.requestRender();
				return;
			}

			this.pushTimeline(`Draft queued: ${trimmed}`);
			this.ensureDraftSession(trimmed);
			this.composer.setValue("");
			this.ui.requestRender();
		};

		this.composer.onEscape = () => {
			if (this.composer.getValue().trim()) {
				return;
			}

			if (this.overlay) {
				this.closeOverlay();
				return;
			}

			this.onExit();
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

		if (this.overlay) {
			this.handleOverlayInput(data);
			return;
		}

		if (kb.matches(data, "tui.input.tab")) {
			this.cycleFocus();
			return;
		}

		if (this.focusRegion !== "composer" && this.handleShortcut(data)) {
			return;
		}

		switch (this.focusRegion) {
			case "rail":
				this.handleRailInput(data);
				return;
			case "main":
				this.handleMainInput(data);
				return;
			case "composer":
				this.composer.handleInput(data);
				return;
			case "overlay":
				return;
		}
	}

	handleMouseEvent(event: ParsedMouseEvent): boolean {
		if (event.action === "scroll") {
			return this.handleScroll(event);
		}

		if (!this.isPrimaryMouseActivation(event)) {
			return false;
		}

		if (this.overlay) {
			const overlayHit = this.findHit(event.col, event.row, this.overlayRegions);
			if (!overlayHit) {
				return false;
			}
			this.focusRegion = "overlay";
			this.activateAction(overlayHit.id);
			return true;
		}

		if (this.composerRegion && this.pointInRect(event.col, event.row, this.composerRegion)) {
			this.setFocusRegion("composer");
			return true;
		}

		const region =
			this.findHit(event.col, event.row, this.toolbarRegions) ??
			this.findHit(event.col, event.row, this.railRegions) ??
			this.findHit(event.col, event.row, this.mainRegions) ??
			this.findHit(event.col, event.row, this.dockRegions);

		if (!region) {
			return false;
		}

		this.setFocusRegion(region.group === "rail" ? "rail" : "main");
		this.activateAction(region.id);
		return true;
	}

	render(width: number): string[] {
		this.reloadProfiles();
		const animation = this.animator.getSnapshot();
		const mainCards = this.getMainCards();
		const overlayOptions = this.getOverlayOptions();
		this.mainSelectionIndex = mainCards.length === 0 ? 0 : Math.min(this.mainSelectionIndex, mainCards.length - 1);
		this.overlaySelectionIndex = overlayOptions.length === 0 ? 0 : Math.min(this.overlaySelectionIndex, overlayOptions.length - 1);

		const result = renderWorkbench({
			width,
			height: this.ui.terminal.rows,
			view: this.view,
			focusRegion: this.focusRegion,
			overlay: this.overlay,
			railSelectionIndex: this.railSelectionIndex,
			mainSelectionIndex: this.mainSelectionIndex,
			overlaySelectionIndex: this.overlaySelectionIndex,
			frame: animation.frame,
			focusPulseActive: animation.focusPulseActive,
			showBody: animation.showBody,
			showInspector: animation.showInspector,
			showDock: animation.showDock,
			profiles: this.profiles,
			activeProfile: this.getActiveProfile(),
			activeSelection: this.profileService.getActiveSelection(),
			railItems: this.getRailItems(),
			mainCards,
			overlayOptions,
			timeline: this.timeline,
			sessionsCount: this.sessions.length,
			agentDir: getAgentDir(),
			renderComposer: (innerWidth) => this.composer.render(innerWidth),
			styleButton: (label, variant) => this.styleButton(label, variant),
			truncateLabel: (value, maxLength) => this.truncateLabel(value, maxLength),
			getViewLabel: (view) => this.getViewLabel(view),
			getFocusLabel: (focus) => this.getFocusLabel(focus),
		});

		this.toolbarRegions = result.toolbarRegions;
		this.railRegions = result.railRegions;
		this.mainRegions = result.mainRegions;
		this.dockRegions = result.dockRegions;
		this.overlayRegions = result.overlayRegions;
		this.composerRegion = result.composerRegion;
		return result.lines;
	}

	private handleRailInput(data: string): void {
		const kb = getKeybindings();
		const items = this.getRailItems();
		if (kb.matches(data, "tui.select.cancel")) {
			this.setFocusRegion("main");
			return;
		}
		if (kb.matches(data, "tui.select.up")) {
			this.railSelectionIndex = this.railSelectionIndex <= 0 ? items.length - 1 : this.railSelectionIndex - 1;
			this.animator.markFocusPulse();
			this.ui.requestRender();
			return;
		}
		if (kb.matches(data, "tui.select.down")) {
			this.railSelectionIndex = this.railSelectionIndex >= items.length - 1 ? 0 : this.railSelectionIndex + 1;
			this.animator.markFocusPulse();
			this.ui.requestRender();
			return;
		}
		if (kb.matches(data, "tui.select.confirm")) {
			this.activateAction(`nav:${items[this.railSelectionIndex]!.id}`);
		}
	}

	private handleMainInput(data: string): void {
		const kb = getKeybindings();
		const cards = this.getMainCards();
		if (cards.length === 0) {
			return;
		}
		if (kb.matches(data, "tui.select.cancel")) {
			this.onExit();
			return;
		}
		if (kb.matches(data, "tui.select.up")) {
			this.mainSelectionIndex = this.mainSelectionIndex <= 0 ? cards.length - 1 : this.mainSelectionIndex - 1;
			this.animator.markFocusPulse();
			this.ui.requestRender();
			return;
		}
		if (kb.matches(data, "tui.select.down")) {
			this.mainSelectionIndex = this.mainSelectionIndex >= cards.length - 1 ? 0 : this.mainSelectionIndex + 1;
			this.animator.markFocusPulse();
			this.ui.requestRender();
			return;
		}
		if (kb.matches(data, "tui.select.confirm")) {
			this.activateAction(cards[this.mainSelectionIndex]!.id);
		}
	}

	private handleOverlayInput(data: string): void {
		const kb = getKeybindings();
		const options = this.getOverlayOptions();
		if (kb.matches(data, "tui.select.cancel")) {
			this.closeOverlay();
			return;
		}
		if (options.length === 0) {
			return;
		}
		if (kb.matches(data, "tui.select.up")) {
			this.overlaySelectionIndex = this.overlaySelectionIndex <= 0 ? options.length - 1 : this.overlaySelectionIndex - 1;
			this.animator.markFocusPulse();
			this.ui.requestRender();
			return;
		}
		if (kb.matches(data, "tui.select.down")) {
			this.overlaySelectionIndex = this.overlaySelectionIndex >= options.length - 1 ? 0 : this.overlaySelectionIndex + 1;
			this.animator.markFocusPulse();
			this.ui.requestRender();
			return;
		}
		if (kb.matches(data, "tui.select.confirm")) {
			this.activateAction(options[this.overlaySelectionIndex]!.id);
		}
	}

	private handleShortcut(data: string): boolean {
		if (data.length !== 1) {
			return false;
		}

		switch (data.toLowerCase()) {
			case "h":
				this.activateAction("nav:home");
				return true;
			case "p":
				this.activateAction("overlay:provider-switch");
				return true;
			case "m":
				this.activateAction("overlay:model-switch");
				return true;
			case "s":
				this.activateAction("overlay:session-list");
				return true;
			case "n":
				this.activateAction("session:new");
				return true;
			default:
				return false;
		}
	}

	private handleScroll(event: ParsedMouseEvent): boolean {
		const delta = event.button === "wheel-up" ? -1 : event.button === "wheel-down" ? 1 : 0;
		if (delta === 0) {
			return false;
		}

		if (this.overlay && this.overlayRegions.some((region) => this.pointInRect(event.col, event.row, region))) {
			const options = this.getOverlayOptions();
			if (options.length === 0) {
				return false;
			}
			this.overlaySelectionIndex = (this.overlaySelectionIndex + delta + options.length) % options.length;
			this.ui.requestRender();
			return true;
		}

		if (this.mainRegions.some((region) => this.pointInRect(event.col, event.row, region))) {
			const cards = this.getMainCards();
			if (cards.length === 0) {
				return false;
			}
			this.mainSelectionIndex = (this.mainSelectionIndex + delta + cards.length) % cards.length;
			this.setFocusRegion("main");
			return true;
		}

		return false;
	}

	private activateAction(actionId: string): void {
		if (actionId === "focus:composer") {
			this.setFocusRegion("composer");
			this.pushTimeline("Composer focus selected from the dock.");
			this.ui.requestRender();
			return;
		}

		if (actionId.startsWith("nav:")) {
			this.setView(actionId.slice(4) as WorkbenchView);
			return;
		}

		if (actionId.startsWith("overlay:")) {
			this.openOverlay(actionId.slice(8) as OverlayKind);
			return;
		}

		if (actionId === "session:new") {
			this.startNewSession();
			return;
		}

		if (actionId.startsWith("provider:")) {
			this.activateProvider(actionId.slice(9));
			return;
		}

		if (actionId.startsWith("model:")) {
			this.activateModel(actionId.slice(6));
			return;
		}

		if (actionId.startsWith("session:")) {
			this.activateSession(actionId.slice(8));
		}
	}

	private setView(view: WorkbenchView): void {
		this.view = view;
		this.railSelectionIndex = Math.max(0, this.getRailItems().findIndex((item) => item.id === view));
		this.mainSelectionIndex = 0;
		this.focusRegion = "main";
		this.composer.focused = false;
		this.animator.markFocusPulse();
		this.pushTimeline(`View changed to ${this.getViewLabel(view)}.`);
		this.ui.requestRender();
	}

	private openOverlay(overlay: OverlayKind): void {
		if (overlay === "model-switch" && !this.getActiveProfile()) {
			this.pushTimeline("Model picker blocked because no provider is active.");
			this.ui.requestRender();
			return;
		}

		this.overlay = overlay;
		this.overlaySelectionIndex = 0;
		this.focusRegion = "overlay";
		this.composer.focused = false;
		this.animator.markFocusPulse();
		this.ui.requestRender();
	}

	private closeOverlay(): void {
		this.overlay = undefined;
		this.setFocusRegion("main");
	}

	private activateProvider(profileId: string): void {
		const profile = this.profiles.find((item) => item.id === profileId);
		if (!profile) {
			return;
		}

		const currentSelection = this.profileService.getActiveSelection();
		const nextModel = currentSelection.profileId === profile.id ? currentSelection.modelId ?? profile.models[0]?.id : profile.models[0]?.id;
		this.profileService.setActiveSelection(profile.id, nextModel);
		this.reloadProfiles();
		this.pushTimeline(`Active provider switched to ${profile.label}${nextModel ? ` (${nextModel})` : ""}.`);
		this.overlay = undefined;
		this.view = "providers";
		this.mainSelectionIndex = Math.max(0, this.profiles.findIndex((item) => item.id === profile.id));
		this.setFocusRegion("main");
	}

	private activateModel(modelId: string): void {
		const profile = this.getActiveProfile();
		if (!profile) {
			return;
		}

		this.profileService.setActiveSelection(profile.id, modelId);
		this.pushTimeline(`Default model switched to ${modelId}.`);
		this.overlay = undefined;
		this.setFocusRegion("main");
	}

	private activateSession(sessionId: string): void {
		const session = this.sessions.find((item) => item.id === sessionId);
		if (!session) {
			return;
		}

		this.pushTimeline(`Session selected: ${session.title}. Runtime session history wiring is still pending.`);
		this.overlay = undefined;
		this.view = "history";
		this.mainSelectionIndex = Math.max(0, this.sessions.findIndex((item) => item.id === sessionId));
		this.setFocusRegion("main");
	}

	private startNewSession(): void {
		const activeProfile = this.getActiveProfile();
		this.sessions.unshift({
			id: `draft-${Date.now()}`,
			title: "New dashboard session",
			summary: activeProfile ? `Prepared a fresh session surface for ${activeProfile.label}.` : "Prepared a fresh session surface before provider selection.",
			state: "ready",
			updatedLabel: "Just now",
		});
		this.pushTimeline(
			activeProfile
				? `New session staged with ${activeProfile.label}.`
				: "New session staged. Configure a provider before real execution wiring lands.",
		);
		this.view = "history";
		this.mainSelectionIndex = 0;
		this.setFocusRegion("main");
	}

	private cycleFocus(): void {
		if (this.overlay) {
			this.setFocusRegion("overlay");
			return;
		}

		const layout = computeWorkbenchLayout(this.ui.terminal.columns, this.ui.terminal.rows);
		const order: WorkbenchFocus[] = [];
		if (layout.showRail) {
			order.push("rail");
		}
		order.push("main", "composer");
		const currentIndex = order.indexOf(this.focusRegion);
		const next = order[(currentIndex + 1) % order.length] ?? "main";
		this.setFocusRegion(next);
	}

	private setFocusRegion(region: WorkbenchFocus): void {
		this.focusRegion = region;
		this.composer.focused = this._focused && region === "composer";
		this.animator.markFocusPulse();
		this.ui.requestRender();
	}

	private getRailItems(): RailItem[] {
		return [
			{ id: "home", label: "Home", description: "Dashboard and quick launch cards" },
			{ id: "providers", label: "Providers", description: "Explicit provider cards and activation state" },
			{ id: "history", label: "History", description: "Recent session placeholders until runtime history is wired" },
		];
	}

	private getMainCards(): WorkbenchCard[] {
		const activeProfile = this.getActiveProfile();
		const selection = this.profileService.getActiveSelection();

		if (this.view === "providers") {
			return this.profiles.map((profile) => ({
				id: `provider:${profile.id}`,
				title: profile.label,
				description: [
					`${profile.family}  |  ${profile.models.length} cached model${profile.models.length === 1 ? "" : "s"}  |  ${profile.lastValidationStatus}`,
					profile.baseUrl,
				],
				actionLabel: selection.profileId === profile.id ? "Active" : "Activate",
				variant: selection.profileId === profile.id ? "success" : "primary",
			}));
		}

		if (this.view === "history") {
			return this.sessions.map((session) => ({
				id: `session:${session.id}`,
				title: session.title,
				description: [`${session.summary}`, `${session.updatedLabel}  |  ${session.state}`],
				actionLabel: session.state === "active" ? "Open" : "Resume",
				variant: session.state === "active" ? "success" : "primary",
			}));
		}

		return [
			{
				id: "session:new",
				title: "New Session",
				description: [
					activeProfile ? `Start a fresh workbench task with ${activeProfile.label}.` : "Stage a fresh workbench task before full runtime session wiring lands.",
					"Explicit cards replace hidden click zones in the main workspace.",
				],
				actionLabel: "Start",
				variant: "success",
			},
			{
				id: "overlay:provider-switch",
				title: "Provider Dialog",
				description: [
					activeProfile ? `Current provider: ${activeProfile.label}` : "No active provider selected yet.",
					"Open a direct picker to swap endpoints and keep the decision visible.",
				],
				actionLabel: "Open",
				variant: "primary",
			},
			{
				id: activeProfile ? "overlay:model-switch" : "nav:providers",
				title: activeProfile ? "Model Dialog" : "Provider Center",
				description: [
					activeProfile ? `Current model: ${selection.modelId ?? activeProfile.models[0]?.id ?? "none"}` : "Open provider cards first so the model picker has a real target.",
					activeProfile ? "Switch the default model through a modal row picker." : "The shell keeps provider setup separate from the main workbench cards.",
				],
				actionLabel: activeProfile ? "Switch" : "Open",
				variant: "secondary",
			},
			{
				id: "overlay:session-list",
				title: "Resume Session",
				description: [
					`${this.sessions.length} staged sessions are available in the rebuilt shell.`,
					"Use the dialog picker now; later this maps to persisted runtime history.",
				],
				actionLabel: "Browse",
				variant: "primary",
			},
		];
	}

	private getOverlayOptions(): OverlayOption[] {
		if (!this.overlay) {
			return [];
		}

		if (this.overlay === "provider-switch") {
			const selection = this.profileService.getActiveSelection();
			return this.profiles.map((profile) => ({
				id: `provider:${profile.id}`,
				label: profile.label,
				description: `${profile.family}  |  ${profile.models.length} model${profile.models.length === 1 ? "" : "s"}  |  ${this.truncateLabel(profile.baseUrl, 32)}`,
				badge: selection.profileId === profile.id ? "ACTIVE" : undefined,
			}));
		}

		if (this.overlay === "model-switch") {
			const profile = this.getActiveProfile();
			const selection = this.profileService.getActiveSelection();
			if (!profile || profile.models.length === 0) {
				return [
					{
						id: "overlay:model-switch",
						label: "No cached models",
						description: "The active provider has no cached models yet. Re-run onboarding or refresh models later.",
						disabled: true,
					},
				];
			}

			return profile.models.map((model) => ({
				id: `model:${model.id}`,
				label: model.id,
				description: `${model.family}  |  ${model.name}`,
				badge: selection.modelId === model.id ? "CURRENT" : undefined,
			}));
		}

		return this.sessions.map((session) => ({
			id: `session:${session.id}`,
			label: session.title,
			description: `${session.summary}  |  ${session.updatedLabel}`,
			badge: session.state === "active" ? "ACTIVE" : undefined,
		}));
	}

	private getActiveProfile(): ProviderProfile | undefined {
		const selection = this.profileService.getActiveSelection();
		return selection.profileId ? this.profiles.find((item) => item.id === selection.profileId) : this.profiles[0];
	}

	private seedTimeline(): void {
		this.timeline.push("Workbench rebuild active: explicit cards, chips, and dialogs replace hidden shell hit targets.");
		this.timeline.push("Onboarding, config, and provider profiles are kept intact from the earlier milestone.");
		const activeProfile = this.getActiveProfile();
		if (activeProfile) {
			this.timeline.push(`Current provider foundation loaded from storage: ${activeProfile.label}.`);
		}
	}

	private pushTimeline(message: string): void {
		const timestamp = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
		this.timeline.unshift(`${timestamp}  ${message}`);
		if (this.timeline.length > 12) {
			this.timeline.length = 12;
		}
	}

	private ensureDraftSession(prompt: string): void {
		this.sessions.unshift({
			id: `draft-${Date.now()}`,
			title: `Draft: ${this.truncateLabel(prompt, 22)}`,
			summary: "Composer input captured into the rebuilt workbench timeline while full agent execution wiring is pending.",
			state: "ready",
			updatedLabel: "Just now",
		});
		if (this.sessions.length > 8) {
			this.sessions.length = 8;
		}
	}

	private handleComposerCommand(value: string): boolean {
		switch (value) {
			case "/providers":
				this.openOverlay("provider-switch");
				return true;
			case "/models":
				this.openOverlay("model-switch");
				return true;
			case "/sessions":
				this.openOverlay("session-list");
				return true;
			case "/new":
				this.startNewSession();
				return true;
			default:
				return false;
		}
	}

	private reloadProfiles(): void {
		this.profiles = this.profileService.listProfiles();
		const items = this.getRailItems();
		if (this.railSelectionIndex < 0 || this.railSelectionIndex >= items.length) {
			this.railSelectionIndex = Math.max(0, items.findIndex((item) => item.id === this.view));
		}
	}

	private styleButton(label: string, variant: ButtonVariant): string {
		const button = `[ ${label} ]`;
		switch (variant) {
			case "active":
				return workbenchTheme.accentStrong(button);
			case "primary":
				return workbenchTheme.accent(button);
			case "secondary":
				return workbenchTheme.muted(button);
			case "success":
				return workbenchTheme.success(button);
			case "warning":
				return workbenchTheme.warning(button);
		}
	}

	private getViewLabel(view: WorkbenchView): string {
		switch (view) {
			case "home":
				return "Home";
			case "providers":
				return "Providers";
			case "history":
				return "History";
		}
	}

	private getFocusLabel(region: WorkbenchFocus): string {
		switch (region) {
			case "rail":
				return "Left Rail";
			case "main":
				return "Main Workbench";
			case "composer":
				return "Composer";
			case "overlay":
				return "Dialog";
		}
	}

	private truncateLabel(value: string, maxLength: number): string {
		return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;
	}

	private findHit(col: number, row: number, regions: ClickRegion[]): ClickRegion | undefined {
		return regions.find((region) => this.pointInRect(col, row, region));
	}

	private pointInRect(col: number, row: number, rect: Rect | ClickRegion): boolean {
		return col >= rect.col && col < rect.col + rect.width && row >= rect.row && row < rect.row + rect.height;
	}

	private isPrimaryMouseActivation(event: ParsedMouseEvent): boolean {
		return event.button === "left" && (event.action === "press" || event.action === "release");
	}
}
