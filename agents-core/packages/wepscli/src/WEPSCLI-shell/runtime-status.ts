export type RuntimePhase = "idle" | "running" | "retrying" | "compacting" | "interrupted" | "error";

export interface RuntimeSessionState {
	phase: RuntimePhase;
	label: string;
	detail?: string;
	interruptible: boolean;
	canContinue: boolean;
}

export function createIdleRuntimeState(): RuntimeSessionState {
	return {
		phase: "idle",
		label: "Ready",
		interruptible: false,
		canContinue: true,
	};
}

export function createRunningRuntimeState(label = "Running"): RuntimeSessionState {
	return {
		phase: "running",
		label,
		interruptible: true,
		canContinue: false,
	};
}

export function createRetryingRuntimeState(label: string, detail?: string): RuntimeSessionState {
	return {
		phase: "retrying",
		label,
		detail,
		interruptible: true,
		canContinue: false,
	};
}

export function createCompactingRuntimeState(label: string, detail?: string): RuntimeSessionState {
	return {
		phase: "compacting",
		label,
		detail,
		interruptible: true,
		canContinue: false,
	};
}

export function createInterruptedRuntimeState(label: string, detail?: string): RuntimeSessionState {
	return {
		phase: "interrupted",
		label,
		detail,
		interruptible: false,
		canContinue: true,
	};
}

export function createErrorRuntimeState(label: string, detail?: string): RuntimeSessionState {
	return {
		phase: "error",
		label,
		detail,
		interruptible: false,
		canContinue: true,
	};
}

export function runtimeStateTone(state: RuntimeSessionState): "muted" | "accent" | "warning" | "danger" | "success" {
	switch (state.phase) {
		case "running":
			return "accent";
		case "retrying":
		case "compacting":
			return "warning";
		case "interrupted":
		case "error":
			return "danger";
		case "idle":
			return "success";
	}
}
