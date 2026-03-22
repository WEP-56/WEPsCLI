import type { ProviderApiDialect, ProviderFamily, ProvidersConfig } from "./types.js";

export const PROVIDERS_CONFIG_VERSION = 1;

export function createDefaultProvidersConfig(): ProvidersConfig {
	return {
		version: PROVIDERS_CONFIG_VERSION,
		profiles: [],
	};
}

export function getDefaultDialect(family: ProviderFamily): ProviderApiDialect {
	switch (family) {
		case "openai":
			return "openai-responses";
		case "anthropic":
			return "anthropic-messages";
	}
}

export function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "");
}
