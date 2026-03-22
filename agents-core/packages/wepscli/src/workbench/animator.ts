import type { TUI } from "@mariozechner/pi-tui";

export interface WorkbenchAnimationSnapshot {
	frame: number;
	showBody: boolean;
	showInspector: boolean;
	showDock: boolean;
	focusPulseActive: boolean;
}

export class WorkbenchAnimator {
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
		this.focusPulseUntil = Date.now() + 550;
	}

	getSnapshot(): WorkbenchAnimationSnapshot {
		const elapsed = Date.now() - this.startedAt;
		return {
			frame: this.frame,
			showBody: elapsed >= 160,
			showInspector: elapsed >= 320,
			showDock: elapsed >= 480,
			focusPulseActive: Date.now() < this.focusPulseUntil,
		};
	}
}
