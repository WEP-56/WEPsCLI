import { randomUUID } from "crypto";
import { getDefaultDialect } from "./defaults.js";
import { fetchModelsForProfile } from "./fetch-models.js";
import { ApiKeyStore } from "./api-key-store.js";
import { ProvidersConfigStore } from "./providers-config-store.js";
import type {
	CreateProviderProfileInput,
	DiscoveredModel,
	FailedRefreshModelsResult,
	ProviderProfile,
	RefreshModelsResult,
	UpdateProviderProfileInput,
} from "./types.js";

function slugify(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function createProfileId(label: string): string {
	const slug = slugify(label) || "provider";
	return `${slug}-${randomUUID().slice(0, 8)}`;
}

function nowIso(): string {
	return new Date().toISOString();
}

function cloneProfile(profile: ProviderProfile): ProviderProfile {
	return structuredClone(profile);
}

export class ProviderProfileService {
	constructor(
		private readonly configStore: ProvidersConfigStore = new ProvidersConfigStore(),
		private readonly apiKeyStore: ApiKeyStore = new ApiKeyStore(),
	) {}

	ensureStorage(): void {
		this.configStore.save(this.configStore.load());
		this.apiKeyStore.ensureFile();
	}

	listProfiles(): ProviderProfile[] {
		return this.configStore.load().profiles.map(cloneProfile);
	}

	getActiveSelection(): { profileId?: string; modelId?: string } {
		const config = this.configStore.load();
		return {
			profileId: config.activeProfileId,
			modelId: config.activeModelId,
		};
	}

	getProfile(profileId: string): ProviderProfile | undefined {
		const profile = this.configStore.load().profiles.find((item) => item.id === profileId);
		return profile ? cloneProfile(profile) : undefined;
	}

	createProfile(input: CreateProviderProfileInput): ProviderProfile {
		const timestamp = nowIso();
		const profile: ProviderProfile = {
			id: createProfileId(input.label),
			label: input.label.trim(),
			family: input.family,
			apiDialect: input.apiDialect ?? getDefaultDialect(input.family),
			baseUrl: input.baseUrl.trim(),
			enabled: input.enabled ?? true,
			models: [],
			createdAt: timestamp,
			updatedAt: timestamp,
			lastValidationStatus: "unknown",
		};

		this.configStore.update((current) => ({
			result: undefined,
			next: {
				...current,
				activeProfileId: current.activeProfileId ?? profile.id,
				profiles: [...current.profiles, profile],
			},
		}));

		if (input.apiKey) {
			this.apiKeyStore.setApiKey(profile.id, input.apiKey);
		}

		return cloneProfile(profile);
	}

	updateProfile(profileId: string, input: UpdateProviderProfileInput): ProviderProfile {
		const updated = this.configStore.update((current) => {
			const index = current.profiles.findIndex((item) => item.id === profileId);
			if (index === -1) {
				throw new Error(`Unknown provider profile: ${profileId}`);
			}

			const existing = current.profiles[index];
			const nextProfile: ProviderProfile = {
				...existing,
				label: input.label?.trim() ?? existing.label,
				baseUrl: input.baseUrl?.trim() ?? existing.baseUrl,
				apiDialect: input.apiDialect ?? existing.apiDialect,
				enabled: input.enabled ?? existing.enabled,
				updatedAt: nowIso(),
			};

			const nextProfiles = [...current.profiles];
			nextProfiles[index] = nextProfile;

			return {
				result: nextProfile,
				next: {
					...current,
					profiles: nextProfiles,
				},
			};
		});

		if (input.apiKey) {
			this.apiKeyStore.setApiKey(profileId, input.apiKey);
		}

		return cloneProfile(updated);
	}

	removeProfile(profileId: string): void {
		this.configStore.update((current) => {
			const nextProfiles = current.profiles.filter((item) => item.id !== profileId);
			const activeProfileId = current.activeProfileId === profileId ? nextProfiles[0]?.id : current.activeProfileId;
			const activeModelId = activeProfileId === current.activeProfileId ? current.activeModelId : undefined;

			return {
				result: undefined,
				next: {
					...current,
					activeProfileId,
					activeModelId,
					profiles: nextProfiles,
				},
			};
		});

		this.apiKeyStore.removeApiKey(profileId);
	}

	setActiveSelection(profileId: string, modelId?: string): void {
		this.configStore.update((current) => {
			const profile = current.profiles.find((item) => item.id === profileId);
			if (!profile) {
				throw new Error(`Unknown provider profile: ${profileId}`);
			}

			return {
				result: undefined,
				next: {
					...current,
					activeProfileId: profileId,
					activeModelId: modelId,
				},
			};
		});
	}

	getApiKey(profileId: string): string | undefined {
		return this.apiKeyStore.getApiKey(profileId);
	}

	replaceModels(
		profileId: string,
		models: DiscoveredModel[],
		validation: { status: "unknown" | "ok" | "error"; message?: string } = { status: "unknown" },
	): ProviderProfile {
		const updated = this.configStore.update((current) => {
			const index = current.profiles.findIndex((item) => item.id === profileId);
			if (index === -1) {
				throw new Error(`Unknown provider profile: ${profileId}`);
			}

			const existing = current.profiles[index];
			const nextProfile: ProviderProfile = {
				...existing,
				models: structuredClone(models),
				lastValidatedAt: nowIso(),
				lastValidationStatus: validation.status,
				lastValidationMessage: validation.message,
				updatedAt: nowIso(),
			};

			const nextProfiles = [...current.profiles];
			nextProfiles[index] = nextProfile;

			const nextActiveModelId =
				current.activeProfileId === profileId
					? current.activeModelId ?? models[0]?.id
					: current.activeModelId;

			return {
				result: nextProfile,
				next: {
					...current,
					activeModelId: nextActiveModelId,
					profiles: nextProfiles,
				},
			};
		});

		return cloneProfile(updated);
	}

	async refreshModels(
		profileId: string,
		fetchImpl: typeof fetch = fetch,
	): Promise<RefreshModelsResult | FailedRefreshModelsResult> {
		const profile = this.getProfile(profileId);
		if (!profile) {
			throw new Error(`Unknown provider profile: ${profileId}`);
		}

		const apiKey = this.apiKeyStore.getApiKey(profileId);
		if (!apiKey) {
			throw new Error(`No API key configured for provider profile: ${profileId}`);
		}

		try {
			const models = await fetchModelsForProfile(profile, apiKey, fetchImpl);
			const updatedProfile = this.configStore.update((current) => {
				const nextProfiles = current.profiles.map((item) =>
					item.id === profileId
						? {
								...item,
								models,
								lastValidatedAt: nowIso(),
								lastValidationStatus: "ok" as const,
								lastValidationMessage: undefined,
								updatedAt: nowIso(),
							}
						: item,
				);

				return {
					result: nextProfiles.find((item) => item.id === profileId)!,
					next: {
						...current,
						activeModelId:
							current.activeProfileId === profileId && !current.activeModelId ? models[0]?.id : current.activeModelId,
						profiles: nextProfiles,
					},
				};
			});

			return {
				profile: cloneProfile(updatedProfile),
				models: structuredClone(models),
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const updatedProfile = this.configStore.update((current) => {
				const nextProfiles = current.profiles.map((item) =>
					item.id === profileId
						? {
								...item,
								lastValidatedAt: nowIso(),
								lastValidationStatus: "error" as const,
								lastValidationMessage: message,
								updatedAt: nowIso(),
							}
						: item,
				);

				return {
					result: nextProfiles.find((item) => item.id === profileId)!,
					next: {
						...current,
						profiles: nextProfiles,
					},
				};
			});

			return {
				profile: cloneProfile(updatedProfile),
				error: message,
			};
		}
	}
}
