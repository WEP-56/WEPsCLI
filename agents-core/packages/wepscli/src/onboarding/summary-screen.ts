import { getKeybindings, Spacer, Text } from "@mariozechner/pi-tui";
import { FramedScreen } from "./framed-screen.js";
import { onboardingTheme } from "./theme.js";

export class SummaryScreen extends FramedScreen {
	constructor(options: {
		stepLabel: string;
		title: string;
		description: string;
		summaryLines: string[];
		onConfirm: () => void;
		onBack: () => void;
	}) {
		super(options.stepLabel, options.title, options.description);

		for (const line of options.summaryLines) {
			this.content.addChild(new Text(onboardingTheme.text(line), 0, 0));
			this.content.addChild(new Spacer(1));
		}

		this.setFooter("Enter save and continue | Esc back");

		this.handleInput = (data: string) => {
			const kb = getKeybindings();
			if (kb.matches(data, "tui.select.confirm")) {
				options.onConfirm();
				return;
			}
			if (kb.matches(data, "tui.select.cancel")) {
				options.onBack();
			}
		};
	}
}
