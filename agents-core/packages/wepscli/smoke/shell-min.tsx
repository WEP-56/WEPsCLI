import { render } from "@opentui/solid";
import { DockPanel, HeaderBar, MainPanel } from "../src/WEPSCLI-shell/components";

render(() => (
	<box width="100%" height="100%" backgroundColor="#051018" flexDirection="column">
		<HeaderBar providerLabel="Smoke Provider" modelLabel="smoke-model" onAction={() => {}} />
		<MainPanel
			viewLabel="Home"
			focused={true}
			cards={[
				{
					id: "card-1",
					title: "Smoke Card",
					lines: ["If this card is visible, component rendering is fine.", "The remaining bug is in shell-app state logic."],
					actionLabel: "Open",
					tone: "accent",
					tags: [{ label: "SMOKE", tone: "accent" }],
				},
			]}
			selectedIndex={0}
			timeline={["Smoke timeline item"]}
			onSelect={() => {}}
		/>
		<DockPanel
			activeProvider="Smoke Provider"
			activeModel="smoke-model"
			focused={false}
			onAction={() => {}}
			inputRef={() => {}}
			onFocusComposer={() => {}}
			onSubmit={() => {}}
		/>
	</box>
)).catch((error) => {
	console.error("SMOKE_SHELL_MIN_ERROR");
	console.error(error instanceof Error ? error.stack ?? error.message : String(error));
	process.exit(1);
});
