import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { ProviderProfile } from "../provider-profiles/index.js";
import { shellTheme } from "./theme.js";

export type ClickableKind = "provider" | "action";

export interface LocalClickableRegion {
	kind: ClickableKind;
	id: string;
	row: number;
	col: number;
	width: number;
	height: number;
}

interface ChipItem {
	id: string;
	label: string;
	variant: "active" | "accent" | "muted" | "success";
}

export interface RenderedBlock {
	lines: string[];
	regions: LocalClickableRegion[];
}

function renderChipText(item: ChipItem): string {
	const base = `[ ${item.label} ]`;
	switch (item.variant) {
		case "active":
			return shellTheme.accentStrong(base);
		case "accent":
			return shellTheme.accent(base);
		case "success":
			return shellTheme.success(base);
		case "muted":
			return shellTheme.muted(base);
	}
}

export function renderActionChips(items: ChipItem[], width: number): RenderedBlock {
	const lines: string[] = [];
	const regions: LocalClickableRegion[] = [];
	let currentLine = "";
	let currentWidth = 0;
	let row = 0;

	for (const item of items) {
		const chip = renderChipText(item);
		const chipWidth = visibleWidth(chip);
		const gap = currentLine ? 1 : 0;

		if (currentWidth + gap + chipWidth > width && currentLine) {
			lines.push(currentLine);
			currentLine = "";
			currentWidth = 0;
			row += 1;
		}

		const startCol = currentWidth + (currentLine ? 1 : 0);
		currentLine += (currentLine ? " " : "") + chip;
		currentWidth = visibleWidth(currentLine);
		regions.push({
			kind: "action",
			id: item.id,
			row,
			col: startCol,
			width: chipWidth,
			height: 1,
		});
	}

	if (currentLine) {
		lines.push(currentLine);
	}

	return { lines, regions };
}

export function renderProviderButtons(
	profiles: ProviderProfile[],
	selectedIndex: number,
	activeProfileId: string | undefined,
	width: number,
): RenderedBlock {
	const lines: string[] = [];
	const regions: LocalClickableRegion[] = [];
	const maxContentWidth = Math.max(8, width - 2);

	profiles.forEach((profile, index) => {
		const chips: ChipItem[] = [
			{
				id: profile.id,
				label: truncateToWidth(profile.label, 18, ""),
				variant: index === selectedIndex ? "active" : "accent",
			},
			{
				id: `${profile.id}:family`,
				label: profile.family,
				variant: "muted",
			},
			{
				id: `${profile.id}:model`,
				label: truncateToWidth(profile.models[0]?.id ?? "no-model", 18, ""),
				variant: "muted",
			},
			{
				id: `${profile.id}:state`,
				label: activeProfileId === profile.id ? "ACTIVE" : "ACTIVATE",
				variant: activeProfileId === profile.id ? "success" : "accent",
			},
		];

		let prefix = index === selectedIndex ? shellTheme.accentStrong("▶ ") : shellTheme.muted("• ");
		let currentCol = visibleWidth(prefix);
		let line = prefix;

		for (let chipIndex = 0; chipIndex < chips.length; chipIndex++) {
			const chipText = renderChipText(chips[chipIndex]!);
			const chipWidth = visibleWidth(chipText);
			const gap = chipIndex === 0 ? 0 : 1;
			if (currentCol + gap + chipWidth > maxContentWidth) {
				break;
			}
			line += (chipIndex === 0 ? "" : " ") + chipText;
			regions.push({
				kind: "provider",
				id: profile.id,
				row: index,
				col: 0,
				width: Math.min(maxContentWidth, visibleWidth(line)),
				height: 1,
			});
			currentCol = visibleWidth(line);
		}

		lines.push(line);
	});

	return { lines, regions };
}
