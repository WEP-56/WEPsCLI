import type { TUI } from "@mariozechner/pi-tui";

export interface ShellAnimationSnapshot {
	frame: number;
	showMain: boolean;
	showStatus: boolean;
	showDock: boolean;
	focusPulseActive: boolean;
}

export class ShellAnimator {
	private frame = 0;
	private interval: NodeJS.Timeout | undefined;
	private readonly startedAt = Date.now();
	private focusPulseUntil = 0;

	constructor(private readonly ui: TUI) {
		this.interval = setInterval(() => {
			this.frame += 1;
			this.ui.requestRender();
		}, 120);
	}

	dispose(): void {
		if (!this.interval) return;
		clearInterval(this.interval);
		this.interval = undefined;
	}

	markFocusPulse(): void {
		this.focusPulseUntil = Date.now() + 500;
	}

	getSnapshot(): ShellAnimationSnapshot {
		const elapsed = Date.now() - this.startedAt;
		return {
			frame: this.frame,
			showMain: elapsed >= 180,
			showStatus: elapsed >= 360,
			showDock: elapsed >= 540,
			focusPulseActive: Date.now() < this.focusPulseUntil,
		};
	}
}
