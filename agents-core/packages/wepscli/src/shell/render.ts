import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import type { PanelVisualStyle } from "./theme.js";

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

export function framePanel(
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

	const wrappedBody = bodyLines.flatMap((line) => wrapTextWithAnsi(line, innerWidth));
	const usableBodyHeight = Math.max(0, height - 2);
	const body = fitLines(
		wrappedBody.map((line) => style.body(`|${padLine(line, innerWidth)}|`)),
		width,
		usableBodyHeight,
	);

	return fitLines([top, ...body, bottom], width, height);
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

	for (let i = 0; i < height; i++) {
		const left = padLine(leftLines[i] ?? "", leftWidth);
		const right = padLine(rightLines[i] ?? "", rightWidth);
		lines.push(`${left}${gapText}${right}`);
	}

	return lines;
}

export function computeShellLayout(width: number, height: number): {
	headerHeight: number;
	bodyHeight: number;
	dockHeight: number;
	showStatusPanel: boolean;
	mainWidth: number;
	statusWidth: number;
	gap: number;
} {
	const showStatusPanel = width >= 108;
	const gap = showStatusPanel ? 1 : 0;

	if (height <= 16) {
		const headerHeight = 2;
		const dockHeight = 4;
		const bodyHeight = Math.max(4, height - headerHeight - dockHeight);
		const statusWidth = showStatusPanel ? Math.max(24, Math.floor(width * 0.28)) : 0;
		const mainWidth = showStatusPanel ? width - statusWidth - gap : width;
		return { headerHeight, bodyHeight, dockHeight, showStatusPanel, mainWidth, statusWidth, gap };
	}

	const headerHeight = 3;
	const dockHeight = width >= 120 ? 7 : 6;
	const bodyHeight = Math.max(6, height - headerHeight - dockHeight);
	const statusWidth = showStatusPanel ? Math.max(28, Math.floor(width * 0.28)) : 0;
	const mainWidth = showStatusPanel ? width - statusWidth - gap : width;
	return { headerHeight, bodyHeight, dockHeight, showStatusPanel, mainWidth, statusWidth, gap };
}

export interface ShellRect {
	row: number;
	col: number;
	width: number;
	height: number;
}

export interface ShellRegions {
	main: ShellRect;
	status?: ShellRect;
	dock: ShellRect;
	providerList: ShellRect;
}

export function computeShellRegions(width: number, height: number, providerListLineCount: number): ShellRegions {
	const layout = computeShellLayout(width, height);
	const bodyStartRow = layout.headerHeight + 1;

	const main: ShellRect = {
		row: bodyStartRow,
		col: 1,
		width: layout.mainWidth,
		height: layout.bodyHeight,
	};

	const status = layout.showStatusPanel
		? {
				row: bodyStartRow,
				col: layout.mainWidth + layout.gap + 1,
				width: layout.statusWidth,
				height: layout.bodyHeight,
			}
		: undefined;

	const dock: ShellRect = {
		row: bodyStartRow + layout.bodyHeight,
		col: 1,
		width,
		height: layout.dockHeight,
	};

	const providerList: ShellRect = {
		row: main.row + 6,
		col: main.col + 1,
		width: Math.max(1, main.width - 2),
		height: providerListLineCount,
	};

	return {
		main,
		status,
		dock,
		providerList,
	};
}
