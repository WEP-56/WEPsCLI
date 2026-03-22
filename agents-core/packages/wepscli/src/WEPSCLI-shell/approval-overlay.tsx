import type { ToolApprovalDecision, ToolApprovalRequest } from "./tool-approval.js";
import { wepscliShellTheme as theme } from "./theme.js";

const APPROVAL_OPTIONS: Array<{ id: ToolApprovalDecision; label: string; description: string; color: string }> = [
	{
		id: "allow",
		label: "Allow",
		description: "Approve this tool call and continue execution.",
		color: theme.success,
	},
	{
		id: "reject",
		label: "Reject",
		description: "Block this tool call and return an error to the agent.",
		color: theme.danger,
	},
	{
		id: "cancel",
		label: "Cancel",
		description: "Cancel this request without allowing the tool to run.",
		color: theme.warning,
	},
];

export function ApprovalOverlay(props: {
	request: ToolApprovalRequest;
	selectedIndex: number;
	onSelectIndex: (index: number) => void;
	onResolve: (decision: ToolApprovalDecision) => void;
}) {
	return (
		<box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
			<box width="76%" maxWidth={100} backgroundColor={theme.panelAlt} border={["top", "right", "bottom", "left"]} borderColor={theme.warning} padding={1} flexDirection="column" gap={1}>
				<box flexDirection="row" justifyContent="space-between" gap={1}>
					<text fg={theme.warning}>Approve Tool Execution</text>
					<text fg={theme.danger}>{props.request.riskLabel}</text>
				</box>
				<text fg={theme.text}>{props.request.toolName}</text>
				<text fg={theme.muted} wrapMode="word">{props.request.reason}</text>
				<box backgroundColor={theme.panel} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} flexDirection="column" gap={1}>
					<text fg={theme.accent}>Request Summary</text>
					<text fg={theme.text} wrapMode="word">{props.request.summary}</text>
				</box>
				<box backgroundColor={theme.panel} border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} flexDirection="column" gap={1}>
					<text fg={theme.accent}>Arguments</text>
					<scrollbox maxHeight={12}>
						<box flexDirection="column" gap={1}>
							<text fg={theme.text} wrapMode="word">{props.request.argsText}</text>
						</box>
					</scrollbox>
				</box>
				<box flexDirection="row" gap={1}>
					{APPROVAL_OPTIONS.map((option, index) => (
						<box
							flexGrow={1}
							backgroundColor={props.selectedIndex === index ? option.color : theme.panel}
							border={["top", "right", "bottom", "left"]}
						borderColor={option.color}
						padding={1}
						flexDirection="column"
						gap={1}
						onMouseUp={() => {
							props.onSelectIndex(index);
							props.onResolve(option.id);
						}}
					>
							<text fg={props.selectedIndex === index ? theme.background : option.color}>{option.label}</text>
							<text fg={props.selectedIndex === index ? theme.background : theme.muted} wrapMode="word">
								{option.description}
							</text>
						</box>
					))}
				</box>
				<text fg={theme.muted}>Left/Right select | Enter confirm | Esc cancel</text>
			</box>
		</box>
	);
}
