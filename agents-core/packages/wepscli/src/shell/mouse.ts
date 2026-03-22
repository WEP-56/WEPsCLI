export type MouseButton = "left" | "middle" | "right" | "wheel-up" | "wheel-down" | "unknown";
export type MouseAction = "press" | "release" | "drag" | "move" | "scroll";

export interface ParsedMouseEvent {
	button: MouseButton;
	action: MouseAction;
	row: number;
	col: number;
	shift: boolean;
	alt: boolean;
	ctrl: boolean;
}

const SGR_MOUSE_PATTERN = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/;

export const ENABLE_MOUSE_SEQUENCE = "\x1b[?1000h\x1b[?1006h";
export const DISABLE_MOUSE_SEQUENCE = "\x1b[?1000l\x1b[?1006l";

export function parseMouseSequence(data: string): ParsedMouseEvent | null {
	const match = data.match(SGR_MOUSE_PATTERN);
	if (!match) {
		return null;
	}

	const code = Number(match[1]);
	const col = Number(match[2]);
	const row = Number(match[3]);
	const terminator = match[4];

	const shift = (code & 4) !== 0;
	const alt = (code & 8) !== 0;
	const ctrl = (code & 16) !== 0;
	const motion = (code & 32) !== 0;
	const wheel = (code & 64) !== 0;
	const baseButton = code & 3;

	if (wheel) {
		return {
			button: baseButton === 0 ? "wheel-up" : baseButton === 1 ? "wheel-down" : "unknown",
			action: "scroll",
			row,
			col,
			shift,
			alt,
			ctrl,
		};
	}

	return {
		button: baseButton === 0 ? "left" : baseButton === 1 ? "middle" : baseButton === 2 ? "right" : "unknown",
		action: motion ? (terminator === "M" ? "drag" : "move") : terminator === "M" ? "press" : "release",
		row,
		col,
		shift,
		alt,
		ctrl,
	};
}
