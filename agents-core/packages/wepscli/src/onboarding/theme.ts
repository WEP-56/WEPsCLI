import chalk from "chalk";
import type { SelectListTheme } from "@mariozechner/pi-tui";

const brandPrimary = chalk.hex("#7dd3fc");
const brandAccent = chalk.hex("#38bdf8");
const brandDim = chalk.hex("#94a3b8");

export const onboardingTheme = {
	brand: (text: string) => chalk.bold(brandPrimary(text)),
	accent: (text: string) => brandAccent(text),
	title: (text: string) => chalk.bold(brandPrimary(text)),
	text: (text: string) => chalk.white(text),
	muted: (text: string) => brandDim(text),
	success: (text: string) => chalk.greenBright(text),
	error: (text: string) => chalk.redBright(text),
	warning: (text: string) => chalk.yellowBright(text),
	border: (text: string) => brandAccent(text),
	key: (text: string) => chalk.bold(chalk.white(text)),
	section: (text: string) => chalk.bold(brandAccent(text)),
};

export function createSelectListTheme(): SelectListTheme {
	return {
		selectedPrefix: onboardingTheme.accent,
		selectedText: onboardingTheme.accent,
		description: onboardingTheme.muted,
		scrollInfo: onboardingTheme.muted,
		noMatch: onboardingTheme.warning,
	};
}
