import type { ProviderProfile } from "../provider-profiles/index.js";
import type { Rect } from "./render.js";

export type WorkbenchView = "home" | "providers" | "history";
export type WorkbenchFocus = "rail" | "main" | "composer" | "overlay";
export type OverlayKind = "provider-switch" | "model-switch" | "session-list";
export type ClickRegionGroup = "toolbar" | "rail" | "main" | "dock" | "overlay";
export type ButtonVariant = "active" | "primary" | "secondary" | "success" | "warning";

export interface ButtonSpec {
	id: string;
	label: string;
	variant: ButtonVariant;
}

export interface ClickRegion {
	group: ClickRegionGroup;
	id: string;
	row: number;
	col: number;
	width: number;
	height: number;
}

export interface LocalRegion {
	id: string;
	row: number;
	col: number;
	width: number;
	height: number;
}

export interface RenderedButtons {
	lines: string[];
	regions: LocalRegion[];
}

export interface RailItem {
	id: WorkbenchView;
	label: string;
	description: string;
}

export interface WorkbenchCard {
	id: string;
	title: string;
	description: string[];
	actionLabel: string;
	variant: ButtonVariant;
}

export interface SessionRecord {
	id: string;
	title: string;
	summary: string;
	state: "active" | "ready" | "recent";
	updatedLabel: string;
}

export interface OverlayOption {
	id: string;
	label: string;
	description: string;
	badge?: string;
	disabled?: boolean;
}

export interface RenderWorkbenchState {
	width: number;
	height: number;
	view: WorkbenchView;
	focusRegion: WorkbenchFocus;
	overlay?: OverlayKind;
	railSelectionIndex: number;
	mainSelectionIndex: number;
	overlaySelectionIndex: number;
	frame: number;
	focusPulseActive: boolean;
	showBody: boolean;
	showInspector: boolean;
	showDock: boolean;
	profiles: ProviderProfile[];
	activeProfile?: ProviderProfile;
	activeSelection: { profileId?: string; modelId?: string };
	railItems: RailItem[];
	mainCards: WorkbenchCard[];
	overlayOptions: OverlayOption[];
	timeline: string[];
	sessionsCount: number;
	agentDir: string;
	renderComposer: (width: number) => string[];
	styleButton: (label: string, variant: ButtonVariant) => string;
	truncateLabel: (value: string, maxLength: number) => string;
	getViewLabel: (view: WorkbenchView) => string;
	getFocusLabel: (focus: WorkbenchFocus) => string;
}

export interface RenderWorkbenchResult {
	lines: string[];
	toolbarRegions: ClickRegion[];
	railRegions: ClickRegion[];
	mainRegions: ClickRegion[];
	dockRegions: ClickRegion[];
	overlayRegions: ClickRegion[];
	composerRegion?: Rect;
}
