import { Container, type Component, type Focusable, getKeybindings, Input, Spacer, Text } from "@mariozechner/pi-tui";
import { FramedScreen } from "./framed-screen.js";
import { onboardingTheme } from "./theme.js";

export class TextInputScreen extends FramedScreen implements Focusable {
	private readonly input = new Input();
	private readonly errorText = new Text("", 0, 0);
	private readonly body = new Container();
	private _focused = false;

	constructor(options: {
		stepLabel: string;
		title: string;
		description: string;
		label: string;
		initialValue?: string;
		placeholder?: string;
		validate?: (value: string) => string | undefined;
		onSubmit: (value: string) => void;
		onBack: () => void;
	}) {
		super(options.stepLabel, options.title, options.description);

		this.body.addChild(new Text(onboardingTheme.section(options.label), 0, 0));
		if (options.placeholder) {
			this.body.addChild(new Spacer(1));
			this.body.addChild(new Text(onboardingTheme.muted(options.placeholder), 0, 0));
		}
		this.body.addChild(new Spacer(1));
		this.body.addChild(this.input);
		this.body.addChild(new Spacer(1));
		this.body.addChild(this.errorText);
		this.content.addChild(this.body);

		if (options.initialValue) {
			this.input.setValue(options.initialValue);
		}

		this.input.onEscape = options.onBack;
		this.input.onSubmit = () => {
			const value = this.input.getValue().trim();
			const error = options.validate?.(value);
			if (error) {
				this.errorText.setText(onboardingTheme.error(error));
				return;
			}
			this.errorText.setText("");
			options.onSubmit(value);
		};

		this.setFooter("Enter confirm | Esc back");
	}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		this.input.focused = value;
	}

	override getFocusTarget(): Component {
		return this;
	}

	handleInput(data: string): void {
		const kb = getKeybindings();
		if (kb.matches(data, "tui.select.cancel")) {
			this.input.onEscape?.();
			return;
		}
		this.input.handleInput(data);
	}
}
