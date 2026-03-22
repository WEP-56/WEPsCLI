import { render } from "@opentui/solid";
import type { ProviderProfileService } from "../provider-profiles/index.js";
import { WEPSCLIShellApp } from "./shell-app.js";

export async function runWepscliShell(profileService: ProviderProfileService): Promise<void> {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		return;
	}

	return new Promise<void>((resolve, reject) => {
		render(
			() => <WEPSCLIShellApp profileService={profileService} onExit={resolve} />,
			{
				targetFps: 60,
				gatherStats: false,
				exitOnCtrlC: false,
				useKittyKeyboard: {},
				autoFocus: true,
				openConsoleOnError: true,
			},
		).catch(reject);
	});
}
