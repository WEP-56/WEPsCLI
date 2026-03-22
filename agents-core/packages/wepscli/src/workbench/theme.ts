import chalk from "chalk";

export type PanelTone = "rail" | "main" | "inspector" | "dock" | "overlay";

export interface PanelVisualStyle {
	border: (text: string) => string;
	body: (text: string) => string;
}

const bgHeader = "#072338";
const bgRail = "#05131d";
const bgMain = "#071a28";
const bgInspector = "#08131e";
const bgDock = "#0b2638";
const bgOverlay = "#0a3146";

const fgText = "#e6f7ff";
const fgMuted = "#7ea0b5";
const fgAccent = "#7dd3fc";
const fgAccentStrong = "#38bdf8";
const fgAccentSoft = "#67e8f9";
const fgSuccess = "#5eead4";
const fgWarning = "#fde68a";
const fgDanger = "#fca5a5";

const backgroundByTone: Record<PanelTone, (text: string) => string> = {
	rail: chalk.bgHex(bgRail),
	main: chalk.bgHex(bgMain),
	inspector: chalk.bgHex(bgInspector),
	dock: chalk.bgHex(bgDock),
	overlay: chalk.bgHex(bgOverlay),
};

export const workbenchTheme = {
	headerBackground: (text: string) => chalk.bgHex(bgHeader)(text),
	text: (text: string) => chalk.hex(fgText)(text),
	muted: (text: string) => chalk.hex(fgMuted)(text),
	accent: (text: string) => chalk.hex(fgAccent)(text),
	accentStrong: (text: string) => chalk.bold(chalk.hex(fgAccentStrong)(text)),
	accentSoft: (text: string) => chalk.hex(fgAccentSoft)(text),
	success: (text: string) => chalk.hex(fgSuccess)(text),
	warning: (text: string) => chalk.hex(fgWarning)(text),
	danger: (text: string) => chalk.hex(fgDanger)(text),
};

export function getPanelStyle(tone: PanelTone, active: boolean, pulsing: boolean): PanelVisualStyle {
	const background = backgroundByTone[tone];
	const borderTone: (text: string) => string = pulsing
		? (text: string) => chalk.bold(chalk.hex("#bae6fd")(text))
		: active
			? (text: string) => chalk.bold(chalk.hex(fgAccentStrong)(text))
			: (text: string) => chalk.hex(fgAccentSoft)(text);

	return {
		border: (text: string) => background(borderTone(text)),
		body: (text: string) => background(text),
	};
}

export function pulseDot(frame: number): string {
	const glyphs = ["o", "O", "0", "O"];
	return glyphs[frame % glyphs.length] ?? "o";
}

export function sweepText(text: string, frame: number): string {
	if (!text) return text;

	const hotspot = frame % Math.max(1, text.length);
	let output = "";
	for (let i = 0; i < text.length; i += 1) {
		const char = text[i] ?? "";
		if (i === hotspot) {
			output += workbenchTheme.accentStrong(char);
			continue;
		}
		if (Math.abs(i - hotspot) === 1) {
			output += workbenchTheme.accent(char);
			continue;
		}
		output += workbenchTheme.text(char);
	}
	return output;
}
