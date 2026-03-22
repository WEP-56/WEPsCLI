import { trimTrailingSlash } from "./defaults.js";
import type { DiscoveredModel, ProviderProfile } from "./types.js";

interface OpenAiListModelsResponse {
	data?: Array<{
		id?: string;
		owned_by?: string;
	}>;
}

interface AnthropicListModelsResponse {
	data?: Array<{
		id?: string;
		display_name?: string;
	}>;
}

function getModelsUrl(baseUrl: string): string {
	const normalized = trimTrailingSlash(baseUrl.trim());
	if (normalized.endsWith("/models")) {
		return normalized;
	}
	return `${normalized}/models`;
}

function normalizeOpenAiModels(payload: OpenAiListModelsResponse): DiscoveredModel[] {
	const items = payload.data ?? [];
	return items
		.filter((item): item is { id: string; owned_by?: string } => typeof item.id === "string" && item.id.length > 0)
		.map((item) => ({
			id: item.id,
			name: item.id,
			family: "openai",
			raw: item,
		}));
}

function normalizeAnthropicModels(payload: AnthropicListModelsResponse): DiscoveredModel[] {
	const items = payload.data ?? [];
	return items
		.filter((item): item is { id: string; display_name?: string } => typeof item.id === "string" && item.id.length > 0)
		.map((item) => ({
			id: item.id,
			name: item.display_name || item.id,
			family: "anthropic",
			raw: item,
		}));
}

function buildHeaders(profile: ProviderProfile, apiKey: string): Record<string, string> {
	if (profile.family === "anthropic") {
		return {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		};
	}

	return {
		Authorization: `Bearer ${apiKey}`,
	};
}

export async function fetchModelsForProfile(
	profile: ProviderProfile,
	apiKey: string,
	fetchImpl: typeof fetch = fetch,
): Promise<DiscoveredModel[]> {
	const response = await fetchImpl(getModelsUrl(profile.baseUrl), {
		method: "GET",
		headers: buildHeaders(profile, apiKey),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Model listing failed (${response.status} ${response.statusText}): ${text || "empty response"}`);
	}

	const payload = (await response.json()) as OpenAiListModelsResponse | AnthropicListModelsResponse;
	const models = profile.family === "anthropic" ? normalizeAnthropicModels(payload) : normalizeOpenAiModels(payload);

	if (models.length === 0) {
		throw new Error("Model listing returned no usable models");
	}

	return models;
}
