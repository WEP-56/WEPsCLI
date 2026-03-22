import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import lockfile from "proper-lockfile";

type LockResult<TValue, TResult> = {
	result: TResult;
	next?: TValue;
};

interface LockedJsonFileOptions {
	dirMode?: number;
	fileMode?: number;
}

export class LockedJsonFile<TValue> {
	private readonly dirMode: number;
	private readonly fileMode: number | undefined;

	constructor(
		private readonly filePath: string,
		private readonly defaultValue: TValue,
		options: LockedJsonFileOptions = {},
	) {
		this.dirMode = options.dirMode ?? 0o700;
		this.fileMode = options.fileMode;
	}

	read(): TValue {
		return this.withLock((current) => ({ result: current }));
	}

	write(next: TValue): void {
		this.withLock(() => ({ result: undefined, next }));
	}

	withLock<TResult>(fn: (current: TValue) => LockResult<TValue, TResult>): TResult {
		this.ensureFileExists();

		let release: (() => void) | undefined;
		try {
			release = this.acquireLockSyncWithRetry(this.filePath);
			const currentRaw = readFileSync(this.filePath, "utf-8");
			const current = this.parseValue(currentRaw);
			const { result, next } = fn(current);

			if (next !== undefined) {
				this.writeValue(next);
			}

			return result;
		} finally {
			release?.();
		}
	}

	private ensureFileExists(): void {
		const dir = dirname(this.filePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: this.dirMode });
		}

		if (!existsSync(this.filePath)) {
			this.writeValue(this.defaultValue);
		}
	}

	private writeValue(value: TValue): void {
		writeFileSync(this.filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
		if (this.fileMode !== undefined) {
			chmodSync(this.filePath, this.fileMode);
		}
	}

	private parseValue(content: string): TValue {
		if (!content.trim()) {
			return structuredClone(this.defaultValue);
		}

		return JSON.parse(content) as TValue;
	}

	private acquireLockSyncWithRetry(path: string): () => void {
		const maxAttempts = 10;
		const delayMs = 20;
		let lastError: unknown;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				return lockfile.lockSync(path, { realpath: false });
			} catch (error) {
				const code =
					typeof error === "object" && error !== null && "code" in error
						? String((error as { code?: unknown }).code)
						: undefined;
				if (code !== "ELOCKED" || attempt === maxAttempts) {
					throw error;
				}
				lastError = error;
				const start = Date.now();
				while (Date.now() - start < delayMs) {
					// busy wait to keep API synchronous and match existing repo style
				}
			}
		}

		throw (lastError as Error) ?? new Error("Failed to acquire JSON file lock");
	}
}
