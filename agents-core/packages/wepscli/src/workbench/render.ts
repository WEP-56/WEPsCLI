import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { PanelVisualStyle } from "./theme.js";

export interface Rect {
	row: number;
	col: number;
	width: number;
	height: number;
}

export function blankLine(width: number): string {
	return " ".repeat(Math.max(0, width));
}

export function padLine(text: string, width: number): string {
	const trimmed = truncateToWidth(text, width, "");
	const pad = Math.max(0, width - visibleWidth(trimmed));
	return trimmed + " ".repeat(pad);
}

export function fitLines(lines: string[], width: number, height: number): string[] {
	const fitted = lines.slice(0, Math.max(0, height)).map((line) => padLine(line, width));
	while (fitted.length < height) {
		fitted.push(blankLine(width));
	}
	return fitted;
}

export function framePanelFixed(
	title: string,
	bodyLines: string[],
	width: number,
	height: number,
	style: PanelVisualStyle,
): string[] {
	if (width <= 2 || height <= 0) {
		return fitLines([], width, height);
	}

	const innerWidth = Math.max(1, width - 2);
	const titleText = truncateToWidth(` ${title} `, Math.max(1, innerWidth), "");
	const borderPad = "-".repeat(Math.max(0, innerWidth - visibleWidth(titleText)));
	const top = style.border(`+${titleText}${borderPad}+`);
	const bottom = style.border(`+${"-".repeat(innerWidth)}+`);
	const usableBodyHeight = Math.max(0, height - 2);
	const body = fitLines(
		bodyLines.slice(0, usableBodyHeight).map((line) => style.body(`|${padLine(line, innerWidth)}|`)),
		width,
		usableBodyHeight,
	);

	return fitLines([top, ...body, bottom], width, height);
}

export function joinColumns(
	leftLines: string[],
	leftWidth: number,
	rightLines: string[],
	rightWidth: number,
	gap: number,
): string[] {
	const height = Math.max(leftLines.length, rightLines.length);
	const gapText = " ".repeat(Math.max(0, gap));
	const lines: string[] = [];

	for (let i = 0; i < height; i += 1) {
		const left = padLine(leftLines[i] ?? "", leftWidth);
		const right = padLine(rightLines[i] ?? "", rightWidth);
		lines.push(`${left}${gapText}${right}`);
	}

	return lines;
}

export function computeWorkbenchLayout(width: number, height: number): {
	headerHeight: number;
	bodyHeight: number;
	dockHeight: number;
	showRail: boolean;
	showInspector: boolean;
	railWidth: number;
	mainWidth: number;
	inspectorWidth: number;
	gap: number;
} {
	const headerHeight = height <= 18 ? 2 : 3;
	const dockHeight = height <= 18 ? 5 : width >= 120 ? 7 : 6;
	const bodyHeight = Math.max(6, height - headerHeight - dockHeight);
	const gap = 1;

	let showRail = width >= 84;
	let showInspector = width >= 124;
	let railWidth = showRail ? 24 : 0;
	let inspectorWidth = showInspector ? 30 : 0;

	let mainWidth = width - railWidth - inspectorWidth - (showRail ? gap : 0) - (showInspector ? gap : 0);
	if (showInspector && mainWidth < 48) {
		showInspector = false;
		inspectorWidth = 0;
		mainWidth = width - railWidth - (showRail ? gap : 0);
	}

	if (showRail && mainWidth < 42) {
		showRail = false;
		railWidth = 0;
		mainWidth = width - inspectorWidth - (showInspector ? gap : 0);
	}

	return {
		headerHeight,
		bodyHeight,
		dockHeight,
		showRail,
		showInspector,
		railWidth,
		mainWidth,
		inspectorWidth,
		gap,
	};
}

export function computeCenteredRect(viewportWidth: number, viewportHeight: number, width: number, height: number): Rect {
	const safeWidth = Math.max(10, Math.min(width, viewportWidth));
	const safeHeight = Math.max(6, Math.min(height, viewportHeight));
	return {
		row: Math.max(1, Math.floor((viewportHeight - safeHeight) / 2) + 1),
		col: Math.max(1, Math.floor((viewportWidth - safeWidth) / 2) + 1),
		width: safeWidth,
		height: safeHeight,
	};
}
