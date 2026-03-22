import type { ProviderProfile } from "../provider-profiles/index.js";
import type { SessionCard } from "./types.js";
import type { CardTag, OverlayKind, ShellFocus, ShellView } from "./types.js";

export const INITIAL_SESSIONS: SessionCard[] = [
	{
		id: "shell-rebuild",
		title: "Continue WEPSCLI shell rebuild",
		summary: "Use the new OpenTUI shell layer as the replacement path for the old workbench scaffold.",
		state: "active",
	},
	{
		id: "provider-sync",
		title: "Provider state sync pass",
		summary: "Keep onboarding and provider-profile storage as the backend contract for the new shell.",
		state: "recent",
	},
	{
		id: "visual-pass",
		title: "Affordance pass",
		summary: "Replace vague click regions with visible controls, cards, and dialogs.",
		state: "ready",
	},
];

export function seedTimeline(profiles: ProviderProfile[]): string[] {
	return [
		"OpenTUI/Solid shell scaffold loaded under src/WEPSCLI-shell.",
		"Provider profiles and onboarding remain owned by the existing storage/runtime layer.",
		profiles[0] ? `Current provider loaded from config: ${profiles[0].label}.` : "No provider profile was found in storage.",
	];
}

export function labelForView(view: ShellView): string {
	switch (view) {
		case "home":
			return "Home";
		case "providers":
			return "Providers";
		case "history":
			return "History";
	}
}

export function labelForFocus(focus: ShellFocus): string {
	switch (focus) {
		case "rail":
			return "Left Rail";
		case "main":
			return "Main Workbench";
		case "composer":
			return "Composer";
		case "overlay":
			return "Overlay";
	}
}

export function overlayTitle(kind: OverlayKind | undefined): string {
	switch (kind) {
		case "provider":
			return "Provider Picker";
		case "model-provider":
			return "Model Provider Picker";
		case "model":
			return "Model Picker";
		case "session":
			return "Session Picker";
		case undefined:
			return "Picker";
	}
}

export function overlayDescription(kind: OverlayKind | undefined): string {
	switch (kind) {
		case "provider":
			return "Pick the active provider profile from existing WEPSCLI config storage.";
		case "model-provider":
			return "Pick which provider you want to browse models for.";
		case "model":
			return "Pick the active model for the chosen provider.";
		case "session":
			return "Pick a staged placeholder session while runtime history integration is still pending.";
		case undefined:
			return "";
	}
}

export function wrapIndex(current: number, delta: number, length: number): number {
	if (length === 0) return 0;
	return (current + delta + length) % length;
}

export function truncate(value: string, maxLength: number): string {
	return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function statusTone(status: ProviderProfile["lastValidationStatus"]): CardTag["tone"] {
	switch (status) {
		case "ok":
			return "success";
		case "error":
			return "danger";
		case "unknown":
			return "warning";
	}
}

export function mapHistoryRecordToCard(record: {
	id: string;
	title: string;
	summary: string;
	state: SessionCard["state"];
	updatedAt?: string;
	providerLabel?: string;
	modelId?: string;
}): SessionCard {
	return {
		id: record.id,
		title: record.title,
		summary: record.summary,
		state: record.state,
		updatedAt: record.updatedAt,
		providerLabel: record.providerLabel,
		modelId: record.modelId,
	};
}

export function formatTimestamp(timestamp?: string): string {
	if (!timestamp) {
		return "just now";
	}

	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return "unknown time";
	}

	return date.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}
