export interface RuntimeRecoveryHint {
	label: string;
	nextStep: string;
}

export function getRuntimeRecoveryHint(message: string): RuntimeRecoveryHint | undefined {
	const normalized = message.toLowerCase();

	if (
		normalized.includes("no api key") ||
		normalized.includes("api key") ||
		normalized.includes("unauthorized") ||
		normalized.includes("forbidden") ||
		normalized.includes("401") ||
		normalized.includes("403")
	) {
		return {
			label: "Provider auth issue - ready",
			nextStep: "Next: check the active provider credentials, then use /providers or /provider add to fix the endpoint or API key.",
		};
	}

	if (
		normalized.includes("no provider profile selected") ||
		normalized.includes("unknown provider profile") ||
		normalized.includes("provider profile")
	) {
		return {
			label: "Provider setup issue - ready",
			nextStep: "Next: use /providers to switch provider, or /provider add to create a working provider profile.",
		};
	}

	if (
		normalized.includes("no model configured") ||
		(normalized.includes("model") && (normalized.includes("unavailable") || normalized.includes("not found") || normalized.includes("unknown")))
	) {
		return {
			label: "Model issue - ready",
			nextStep: "Next: use /models to switch to an available model, or /providers to change the active provider.",
		};
	}

	if (
		normalized.includes("rate limit") ||
		normalized.includes("429") ||
		normalized.includes("too many requests") ||
		normalized.includes("quota")
	) {
		return {
			label: "Provider busy - ready",
			nextStep: "Next: wait and retry, or switch models/providers with /models or /providers.",
		};
	}

	if (
		normalized.includes("fetch failed") ||
		normalized.includes("network") ||
		normalized.includes("timeout") ||
		normalized.includes("timed out") ||
		normalized.includes("enotfound") ||
		normalized.includes("econn") ||
		normalized.includes("socket") ||
		normalized.includes("tls")
	) {
		return {
			label: "Provider connection issue - ready",
			nextStep: "Next: verify the base URL and network path, then retry. If needed, switch provider with /providers.",
		};
	}

	return {
		label: "Request failed - ready",
		nextStep: "Next: adjust the request and retry. Use /debug if the failure keeps repeating.",
	};
}
