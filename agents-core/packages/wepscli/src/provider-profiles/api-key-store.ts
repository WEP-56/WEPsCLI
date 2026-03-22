import { getAuthPath } from "../config.js";
import { LockedJsonFile } from "../storage/locked-json-file.js";

type ApiKeyCredential = {
	type: "api_key";
	key: string;
};

type AuthRecord = Record<string, unknown>;

function isApiKeyCredential(value: unknown): value is ApiKeyCredential {
	return (
		typeof value === "object" &&
		value !== null &&
		"type" in value &&
		"valueOf" in Object.prototype &&
		(value as { type?: unknown }).type === "api_key" &&
		"key" in value &&
		typeof (value as { key?: unknown }).key === "string"
	);
}

export class ApiKeyStore {
	private readonly storage: LockedJsonFile<AuthRecord>;

	constructor(authPath: string = getAuthPath()) {
		this.storage = new LockedJsonFile<AuthRecord>(authPath, {}, { fileMode: 0o600 });
	}

	ensureFile(): void {
		this.storage.write(this.storage.read());
	}

	getApiKey(profileId: string): string | undefined {
		const value = this.storage.read()[profileId];
		return isApiKeyCredential(value) ? value.key : undefined;
	}

	hasApiKey(profileId: string): boolean {
		return this.getApiKey(profileId) !== undefined;
	}

	setApiKey(profileId: string, apiKey: string): void {
		this.storage.withLock((current) => ({
			result: undefined,
			next: {
				...current,
				[profileId]: {
					type: "api_key",
					key: apiKey,
				},
			},
		}));
	}

	removeApiKey(profileId: string): void {
		this.storage.withLock((current) => {
			if (!(profileId in current)) {
				return { result: undefined };
			}

			const next = { ...current };
			delete next[profileId];
			return { result: undefined, next };
		});
	}
}
