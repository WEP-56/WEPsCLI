import { render } from "@opentui/solid";

render(() => (
	<box width="100%" height="100%" backgroundColor="#051018" flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} gap={1}>
		<box backgroundColor="#0a2235" paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
			<text fg="#d7f4ff">WEPSCLI panel smoke test</text>
		</box>
		<box backgroundColor="#081827" border={["top", "right", "bottom", "left"]} borderColor="#184764" padding={1} flexDirection="column" gap={1}>
			<text fg="#73d8ff">If you can read this, OpenTUI rendering works.</text>
			<text fg="#7fa5bb">If this is still blank, the problem is below WEPSCLI-shell.</text>
		</box>
	</box>
));
