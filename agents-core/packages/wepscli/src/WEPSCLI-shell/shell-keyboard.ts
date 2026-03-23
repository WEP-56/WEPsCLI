import { useKeyboard } from "@opentui/solid";
import { writeShellDebugLog } from "./debug-log.js";
import { wrapIndex } from "./helpers.js";
import type { ShellModeId } from "./shell-modes.js";
import type { ToolApprovalDecision } from "./tool-approval.js";
import type { OverlayKind, ShellFocus } from "./types.js";

interface ShellKeyboardStateAccessors {
	focusRegion: () => ShellFocus;
	overlay: () => OverlayKind | undefined;
	overlayIndex: () => number;
	overlayOptionsLength: () => number;
	hasActiveApproval: () => boolean;
	approvalDecisionIndex: () => number;
	providerAddFlowActive: () => boolean;
	providerAddFlowPickerStep: () => boolean;
	skillAddFlowActive: () => boolean;
	composerValue: () => string;
}

interface ShellKeyboardActions {
	exitShell: () => void;
	abortActiveRequest: () => Promise<void> | void;
	resolveActiveApproval: (decision: ToolApprovalDecision) => void;
	setApprovalDecisionIndex: (updater: (current: number) => number) => void;
	providerAddBack: () => void;
	providerAddMoveSelection: (delta: number) => void;
	providerAddConfirmSelection: () => void;
	closeSkillAddFlow: () => void;
	closeOverlay: () => void;
	setOverlayIndex: (updater: (current: number) => number) => void;
	activateOverlaySelection: () => void;
	applyNextShellMode: () => void;
	applyMode: (modeId: ShellModeId) => void;
	cycleFocus: () => void;
	setFocusRegion: (region: ShellFocus) => void;
}

export function useShellKeyboard(state: ShellKeyboardStateAccessors, actions: ShellKeyboardActions): void {
	useKeyboard((evt) => {
		writeShellDebugLog(`key name=${evt.name} focus=${state.focusRegion()} overlay=${state.overlay() ?? "none"}`);

		if (evt.ctrl && evt.name === "c") {
			evt.preventDefault();
			actions.exitShell();
			return;
		}

		if (evt.ctrl && evt.name === ".") {
			evt.preventDefault();
			void actions.abortActiveRequest();
			return;
		}

		if (state.hasActiveApproval()) {
			if (evt.name === "escape") {
				evt.preventDefault();
				actions.resolveActiveApproval("cancel");
				return;
			}
			if (evt.name === "left" || evt.name === "up") {
				evt.preventDefault();
				actions.setApprovalDecisionIndex((current) => wrapIndex(current, -1, 3));
				return;
			}
			if (evt.name === "right" || evt.name === "down") {
				evt.preventDefault();
				actions.setApprovalDecisionIndex((current) => wrapIndex(current, 1, 3));
				return;
			}
			if (evt.name === "return") {
				evt.preventDefault();
				const decisions: ToolApprovalDecision[] = ["allow", "reject", "cancel"];
				actions.resolveActiveApproval(decisions[state.approvalDecisionIndex()] ?? "cancel");
				return;
			}
			return;
		}

		if (state.providerAddFlowActive()) {
			if (evt.name === "escape") {
				evt.preventDefault();
				actions.providerAddBack();
				return;
			}

			if (state.providerAddFlowPickerStep()) {
				if (evt.name === "up") {
					evt.preventDefault();
					actions.providerAddMoveSelection(-1);
					return;
				}
				if (evt.name === "down") {
					evt.preventDefault();
					actions.providerAddMoveSelection(1);
					return;
				}
				if (evt.name === "return") {
					evt.preventDefault();
					actions.providerAddConfirmSelection();
					return;
				}
			}

			return;
		}

		if (state.skillAddFlowActive()) {
			if (evt.name === "escape") {
				evt.preventDefault();
				actions.closeSkillAddFlow();
			}
			return;
		}

		if (state.overlay()) {
			if (evt.name === "escape") {
				evt.preventDefault();
				actions.closeOverlay();
				return;
			}
			if (evt.name === "up") {
				evt.preventDefault();
				actions.setOverlayIndex((current) => wrapIndex(current, -1, state.overlayOptionsLength()));
				return;
			}
			if (evt.name === "down") {
				evt.preventDefault();
				actions.setOverlayIndex((current) => wrapIndex(current, 1, state.overlayOptionsLength()));
				return;
			}
			if (evt.name === "return") {
				evt.preventDefault();
				actions.activateOverlaySelection();
				return;
			}
			return;
		}

		if (evt.option && evt.name === "m") {
			evt.preventDefault();
			actions.applyNextShellMode();
			return;
		}

		if (evt.option && ["1", "2", "3", "4"].includes(evt.name)) {
			evt.preventDefault();
			const nextMode = (
				{
					"1": "agent",
					"2": "plan",
					"3": "read-only",
					"4": "auto-approve",
				} as Record<string, ShellModeId>
			)[evt.name];
			if (nextMode) {
				actions.applyMode(nextMode);
			}
			return;
		}

		if (evt.name === "tab") {
			evt.preventDefault();
			actions.cycleFocus();
			return;
		}

		if (state.focusRegion() === "main") {
			if (evt.name === "up" || evt.name === "down") {
				evt.preventDefault();
				return;
			}
			if (evt.name === "escape") {
				evt.preventDefault();
				actions.setFocusRegion("composer");
				return;
			}
		}

		if (state.focusRegion() === "composer" && evt.name === "escape" && !state.composerValue().trim()) {
			evt.preventDefault();
			actions.exitShell();
		}
	});
}
