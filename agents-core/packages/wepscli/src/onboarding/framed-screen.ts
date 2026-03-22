import { Container, Spacer, Text, type Component } from "@mariozechner/pi-tui";
import { onboardingTheme } from "./theme.js";

export interface WizardScreen extends Component {
	getFocusTarget(): Component;
}

class BorderLine implements Component {
	invalidate(): void {}

	render(width: number): string[] {
		return [onboardingTheme.border("=".repeat(Math.max(1, width)))];
	}
}

export class FramedScreen extends Container implements WizardScreen {
	protected readonly content = new Container();
	private readonly footerText = new Text("", 0, 0);

	constructor(stepLabel: string, title: string, description: string) {
		super();

		this.addChild(new BorderLine());
		this.addChild(new Text(onboardingTheme.brand(`WEPSCLI SETUP  ${stepLabel}`), 0, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(onboardingTheme.title(title), 0, 0));
		if (description.trim()) {
			this.addChild(new Spacer(1));
			this.addChild(new Text(onboardingTheme.muted(description), 0, 0));
		}
		this.addChild(new Spacer(1));
		this.addChild(this.content);
		this.addChild(new Spacer(1));
		this.addChild(this.footerText);
		this.addChild(new BorderLine());
	}

	protected setFooter(text: string): void {
		this.footerText.setText(onboardingTheme.muted(text));
	}

	getFocusTarget(): Component {
		return this;
	}

	handleInput(_data: string): void {}
}
