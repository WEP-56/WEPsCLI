import { ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import type { ProviderProfile } from "../provider-profiles/types.js";
import { ProviderProfileService } from "../provider-profiles/index.js";
import { OnboardingApp } from "./onboarding-app.js";

export async function runOnboarding(
	profiles: ProviderProfileService,
): Promise<ProviderProfile> {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		throw new Error("First-run onboarding requires an interactive terminal.");
	}

	return new Promise<ProviderProfile>((resolve, reject) => {
		const ui = new TUI(new ProcessTerminal());
		let settled = false;

		const done = (fn: () => void) => {
			if (settled) return;
			settled = true;
			try {
				ui.stop();
			} finally {
				fn();
			}
		};

		const app = new OnboardingApp(
			ui,
			profiles,
			(profile) => done(() => resolve(profile)),
			() => done(() => reject(new Error("Onboarding aborted by user"))),
		);

		ui.addChild(app);
		ui.start();
	});
}
