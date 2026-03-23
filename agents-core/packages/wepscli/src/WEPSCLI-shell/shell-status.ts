import { type RuntimeSessionState, runtimeStateTone } from "./runtime-status.js";
import { wepscliShellTheme as theme } from "./theme.js";

export function runtimeStatusColor(state: RuntimeSessionState): string {
	switch (runtimeStateTone(state)) {
		case "accent":
			return theme.accent;
		case "warning":
			return theme.warning;
		case "danger":
			return theme.danger;
		case "success":
			return theme.success;
		case "muted":
			return theme.muted;
	}
}
