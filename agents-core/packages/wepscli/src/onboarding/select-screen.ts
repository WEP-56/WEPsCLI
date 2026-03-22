import { type Component, SelectList, Spacer, Text, type SelectItem } from "@mariozechner/pi-tui";
import { FramedScreen } from "./framed-screen.js";
import { createSelectListTheme, onboardingTheme } from "./theme.js";

export class SelectScreen extends FramedScreen {
	private readonly selectList: SelectList;

	constructor(options: {
		stepLabel: string;
		title: string;
		description: string;
		items: SelectItem[];
		initialIndex?: number;
		onSelect: (item: SelectItem) => void;
		onBack: () => void;
	}) {
		super(options.stepLabel, options.title, options.description);

		this.content.addChild(new Text(onboardingTheme.section("Options"), 0, 0));
		this.content.addChild(new Spacer(1));

		this.selectList = new SelectList(options.items, Math.min(10, options.items.length), createSelectListTheme());
		if (typeof options.initialIndex === "number") {
			this.selectList.setSelectedIndex(options.initialIndex);
		}
		this.selectList.onSelect = options.onSelect;
		this.selectList.onCancel = options.onBack;

		this.content.addChild(this.selectList);
		this.setFooter("Up/Down move | Enter select | Esc back");
	}

	override getFocusTarget(): Component {
		return this.selectList;
	}
}
