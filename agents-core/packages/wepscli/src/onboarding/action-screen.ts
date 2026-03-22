import { getKeybindings, Spacer, Text } from "@mariozechner/pi-tui";
import { FramedScreen } from "./framed-screen.js";
import { onboardingTheme } from "./theme.js";

type ActionState<TResult> =
	| { kind: "idle" }
	| { kind: "running"; frame: number }
	| { kind: "done"; result: TResult };

export class ActionScreen<TResult> extends FramedScreen {
	private readonly messageText = new Text("", 0, 0);
	private readonly detailText = new Text("", 0, 0);
	private state: ActionState<TResult> = { kind: "idle" };
	private timer: NodeJS.Timeout | undefined;

	constructor(options: {
		stepLabel: string;
		title: string;
		description: string;
		idleMessage: string;
		run: () => Promise<TResult>;
		formatResult: (result: TResult) => { message: string; detail?: string };
		onContinue: (result: TResult) => void;
		onBack: () => void;
		requestRender: () => void;
	}) {
		super(options.stepLabel, options.title, options.description);

		this.content.addChild(this.messageText);
		this.content.addChild(new Spacer(1));
		this.content.addChild(this.detailText);
		this.setIdle(options.idleMessage);

		this.handleInput = async (data: string) => {
			const kb = getKeybindings();
			if (kb.matches(data, "tui.select.cancel") && this.state.kind !== "running") {
				this.stopTimer();
				options.onBack();
				return;
			}

			if (!kb.matches(data, "tui.select.confirm")) {
				return;
			}

			if (this.state.kind === "idle") {
				this.state = { kind: "running", frame: 0 };
				this.startTimer(options.requestRender);
				this.messageText.setText(onboardingTheme.accent("Working."));
				this.detailText.setText(onboardingTheme.muted("Please wait while WEPSCLI talks to the provider."));
				options.requestRender();

				try {
					const result = await options.run();
					this.stopTimer();
					this.state = { kind: "done", result };
					const formatted = options.formatResult(result);
					this.messageText.setText(formatted.message);
					this.detailText.setText(formatted.detail ? onboardingTheme.muted(formatted.detail) : "");
					this.setFooter("Enter continue | Esc back");
					options.requestRender();
				} catch (error) {
					this.stopTimer();
					this.state = { kind: "idle" };
					const message = error instanceof Error ? error.message : String(error);
					this.messageText.setText(onboardingTheme.error(message));
					this.detailText.setText(onboardingTheme.muted("Press Enter to retry or Esc to go back."));
					this.setFooter("Enter retry | Esc back");
					options.requestRender();
				}
				return;
			}

			if (this.state.kind === "done") {
				options.onContinue(this.state.result);
			}
		};
	}

	private setIdle(message: string): void {
		this.messageText.setText(onboardingTheme.text(message));
		this.detailText.setText(onboardingTheme.muted("Press Enter to start."));
		this.setFooter("Enter start | Esc back");
	}

	private startTimer(requestRender: () => void): void {
		const frames = ["Working.", "Working..", "Working..."];
		this.timer = setInterval(() => {
			if (this.state.kind !== "running") {
				return;
			}
			const nextFrame = (this.state.frame + 1) % frames.length;
			this.state = { kind: "running", frame: nextFrame };
			this.messageText.setText(onboardingTheme.accent(frames[nextFrame]));
			requestRender();
		}, 140);
	}

	private stopTimer(): void {
		if (!this.timer) return;
		clearInterval(this.timer);
		this.timer = undefined;
	}
}
