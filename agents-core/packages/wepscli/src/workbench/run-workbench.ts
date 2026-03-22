import { ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import { ProviderProfileService } from "../provider-profiles/index.js";
import { WorkbenchShell } from "./workbench-shell.js";
import { DISABLE_MOUSE_SEQUENCE, ENABLE_MOUSE_SEQUENCE, parseMouseSequence } from "./mouse.js";

export async function runWorkbench(profileService: ProviderProfileService): Promise<void> {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		return;
	}

	return new Promise<void>((resolve) => {
		const ui = new TUI(new ProcessTerminal());
		let closed = false;
		let removeMouseListener: (() => void) | undefined;

		const workbench = new WorkbenchShell(ui, profileService, () => {
			if (closed) return;
			closed = true;
			removeMouseListener?.();
			workbench.dispose();
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

			const consumed = workbench.handleMouseEvent(event);
			return { consume: consumed || true };
		});

		ui.addChild(workbench);
		ui.setFocus(workbench);
		ui.start();
	});
}
