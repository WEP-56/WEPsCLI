export type ProviderFamily = "openai" | "anthropic";

export type ProviderApiDialect = "openai-responses" | "openai-completions" | "anthropic-messages";

export type ValidationStatus = "unknown" | "ok" | "error";

export interface DiscoveredModel {
	id: string;
	name: string;
	family: ProviderFamily;
	raw?: unknown;
}

export interface ProviderProfile {
	id: string;
	label: string;
	family: ProviderFamily;
	apiDialect: ProviderApiDialect;
	baseUrl: string;
	enabled: boolean;
	models: DiscoveredModel[];
	createdAt: string;
	updatedAt: string;
	lastValidatedAt?: string;
	lastValidationStatus: ValidationStatus;
	lastValidationMessage?: string;
}

export interface ProvidersConfig {
	version: 1;
	activeProfileId?: string;
	activeModelId?: string;
	profiles: ProviderProfile[];
}

export interface CreateProviderProfileInput {
	label: string;
	family: ProviderFamily;
	baseUrl: string;
	apiDialect?: ProviderApiDialect;
	enabled?: boolean;
	apiKey?: string;
}

export interface UpdateProviderProfileInput {
	label?: string;
	baseUrl?: string;
	apiDialect?: ProviderApiDialect;
	enabled?: boolean;
	apiKey?: string;
}

export interface RefreshModelsResult {
	profile: ProviderProfile;
	models: DiscoveredModel[];
}

export interface FailedRefreshModelsResult {
	profile: ProviderProfile;
	error: string;
}
