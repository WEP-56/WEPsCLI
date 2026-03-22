import { ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import { ProviderProfileService } from "../provider-profiles/index.js";
import { DashboardShell } from "./dashboard-shell.js";
import { DISABLE_MOUSE_SEQUENCE, ENABLE_MOUSE_SEQUENCE, parseMouseSequence } from "./mouse.js";

export async function runShell(profileService: ProviderProfileService): Promise<void> {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		return;
	}

	return new Promise<void>((resolve) => {
		const ui = new TUI(new ProcessTerminal());
		let closed = false;
		let removeMouseListener: (() => void) | undefined;

		const shell = new DashboardShell(ui, profileService, () => {
			if (closed) return;
			closed = true;
			removeMouseListener?.();
			shell.dispose();
			ui.terminal.write(DISABLE_MOUSE_SEQUENCE);
			ui.stop();
			resolve();
		});

		ui.terminal.write(ENABLE_MOUSE_SEQUENCE);
		removeMouseListener = ui.addInputListener((data) => {
			const event = parseMouseSequence(data);
			if (!event) {
				return undefined;
			}

			const consumed = shell.handleMouseEvent(event);
			return { consume: consumed || true };
		});

		ui.addChild(shell);
		ui.setFocus(shell);
		ui.start();
	});
}
