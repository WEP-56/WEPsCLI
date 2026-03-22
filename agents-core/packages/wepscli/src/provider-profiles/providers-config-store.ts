import { getProvidersPath } from "../config.js";
import { LockedJsonFile } from "../storage/locked-json-file.js";
import { createDefaultProvidersConfig } from "./defaults.js";
import type { ProvidersConfig } from "./types.js";

export class ProvidersConfigStore {
	private readonly storage: LockedJsonFile<ProvidersConfig>;

	constructor(providersPath: string = getProvidersPath()) {
		this.storage = new LockedJsonFile<ProvidersConfig>(providersPath, createDefaultProvidersConfig());
	}

	load(): ProvidersConfig {
		return this.storage.read();
	}

	save(next: ProvidersConfig): void {
		this.storage.write(next);
	}

	update<TResult>(fn: (current: ProvidersConfig) => { result: TResult; next?: ProvidersConfig }): TResult {
		return this.storage.withLock(fn);
	}
}
