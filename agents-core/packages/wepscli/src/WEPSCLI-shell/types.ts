export type ShellView = "home" | "providers" | "history";
export type ShellFocus = "rail" | "main" | "composer" | "overlay";
export type OverlayKind = "provider" | "model-provider" | "model" | "session";
export type CardTone = "accent" | "success" | "muted";
export type TagTone = "accent" | "success" | "muted" | "warning" | "danger";

export interface SessionCard {
	id: string;
	title: string;
	summary: string;
	state: "active" | "ready" | "recent";
	updatedAt?: string;
	providerLabel?: string;
	modelId?: string;
}

export interface OverlayOption {
	id: string;
	label: string;
	description: string;
	badge?: string;
}

export interface CardTag {
	label: string;
	tone: TagTone;
	color?: string;
}

export interface MainCard {
	id: string;
	title: string;
	lines: string[];
	actionLabel: string;
	tone: CardTone;
	tags?: CardTag[];
}

export interface MainHero {
	title: string;
	subtitle: string;
	lines: string[];
	tags: CardTag[];
}

export interface SlashCommandItem {
	id: string;
	label: string;
	description: string;
	keyHint?: string;
}
