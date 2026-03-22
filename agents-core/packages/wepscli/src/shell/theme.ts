import chalk from "chalk";

export type PanelTone = "main" | "status" | "dock";

export interface PanelVisualStyle {
	border: (text: string) => string;
	body: (text: string) => string;
}

const bgApp = "#051018";
const bgHeader = "#082236";
const bgMain = "#071927";
const bgStatus = "#08131f";
const bgDock = "#09283d";
const fgText = "#e2f4ff";
const fgMuted = "#88a9bd";
const fgAccent = "#7dd3fc";
const fgAccentStrong = "#38bdf8";
const fgAccentSoft = "#67e8f9";
const fgSuccess = "#5eead4";
const fgWarning = "#fde68a";

export const shellTheme = {
	headerBackground: (text: string) => chalk.bgHex(bgHeader)(text),
	appBackground: (text: string) => chalk.bgHex(bgApp)(text),
	panelMainBackground: (text: string) => chalk.bgHex(bgMain)(text),
	panelStatusBackground: (text: string) => chalk.bgHex(bgStatus)(text),
	panelDockBackground: (text: string) => chalk.bgHex(bgDock)(text),
	text: (text: string) => chalk.hex(fgText)(text),
	muted: (text: string) => chalk.hex(fgMuted)(text),
	accent: (text: string) => chalk.bold(chalk.hex(fgAccent)(text)),
	accentStrong: (text: string) => chalk.bold(chalk.hex(fgAccentStrong)(text)),
	accentSoft: (text: string) => chalk.hex(fgAccentSoft)(text),
	success: (text: string) => chalk.hex(fgSuccess)(text),
	warning: (text: string) => chalk.hex(fgWarning)(text),
};

export function getPanelStyle(tone: PanelTone, active: boolean, pulsing: boolean): PanelVisualStyle {
	const background =
		tone === "main"
			? shellTheme.panelMainBackground
			: tone === "status"
				? shellTheme.panelStatusBackground
				: shellTheme.panelDockBackground;

	const borderBase = active ? shellTheme.accentStrong : shellTheme.accentSoft;
	const border = pulsing ? (text: string) => chalk.bold(chalk.hex("#bae6fd")(text)) : borderBase;

	return {
		border: (text: string) => background(border(text)),
		body: (text: string) => background(shellTheme.text(text)),
	};
}

export function pulseDot(frame: number): string {
	const glyphs = ["o", "O", "0", "O"];
	return glyphs[frame % glyphs.length] ?? "o";
}

export function shimmerText(text: string, frame: number): string {
	if (!text) return text;

	const hotspot = frame % text.length;
	let output = "";
	for (let i = 0; i < text.length; i++) {
		const char = text[i]!;
		if (i === hotspot) {
			output += shellTheme.accentStrong(char);
		} else if (Math.abs(i - hotspot) === 1) {
			output += shellTheme.accent(char);
		} else {
			output += shellTheme.text(char);
		}
	}
	return output;
}
