import { randomUUID } from "crypto";
import { getSessionsPath } from "../config.js";
import { LockedJsonFile } from "../storage/locked-json-file.js";

export type ShellSessionState = "active" | "ready" | "recent";

export interface ShellSessionRecord {
	id: string;
	title: string;
	summary: string;
	state: ShellSessionState;
	createdAt: string;
	updatedAt: string;
	providerProfileId?: string;
	providerLabel?: string;
	modelId?: string;
	lastPrompt?: string;
	runtimeSessionFile?: string;
}

interface SessionsConfig {
	version: 1;
	sessions: ShellSessionRecord[];
}

interface CreateShellSessionInput {
	title: string;
	summary: string;
	state?: ShellSessionState;
	providerProfileId?: string;
	providerLabel?: string;
	modelId?: string;
	lastPrompt?: string;
	runtimeSessionFile?: string;
}

interface UpdateShellSessionInput {
	title?: string;
	summary?: string;
	state?: ShellSessionState;
	providerProfileId?: string;
	providerLabel?: string;
	modelId?: string;
	lastPrompt?: string;
	runtimeSessionFile?: string;
}

function nowIso(): string {
	return new Date().toISOString();
}

function createDefaultSessionsConfig(): SessionsConfig {
	return {
		version: 1,
		sessions: [],
	};
}

function cloneSession(record: ShellSessionRecord): ShellSessionRecord {
	return structuredClone(record);
}

export class SessionHistoryService {
	private readonly storage: LockedJsonFile<SessionsConfig>;

	constructor(filePath: string = getSessionsPath()) {
		this.storage = new LockedJsonFile<SessionsConfig>(filePath, createDefaultSessionsConfig());
	}

	listSessions(): ShellSessionRecord[] {
		const config = this.storage.read();
		return config.sessions
			.slice()
			.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
			.map(cloneSession);
	}

	ensureSeed(seed: CreateShellSessionInput[]): ShellSessionRecord[] {
		return this.storage.withLock((current) => {
			if (current.sessions.length > 0) {
				return {
					result: current.sessions
						.slice()
						.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
						.map(cloneSession),
				};
			}

			const timestamp = nowIso();
			const sessions = seed.map((item) => ({
				id: randomUUID(),
				title: item.title,
				summary: item.summary,
				state: item.state ?? "ready",
				createdAt: timestamp,
				updatedAt: timestamp,
				providerProfileId: item.providerProfileId,
				providerLabel: item.providerLabel,
				modelId: item.modelId,
				lastPrompt: item.lastPrompt,
				runtimeSessionFile: item.runtimeSessionFile,
			}));

			return {
				result: sessions.map(cloneSession),
				next: {
					...current,
					sessions,
				},
			};
		});
	}

	createSession(input: CreateShellSessionInput): ShellSessionRecord {
		return this.storage.withLock((current) => {
			const timestamp = nowIso();
			const session: ShellSessionRecord = {
				id: randomUUID(),
				title: input.title,
				summary: input.summary,
				state: input.state ?? "ready",
				createdAt: timestamp,
				updatedAt: timestamp,
				providerProfileId: input.providerProfileId,
				providerLabel: input.providerLabel,
				modelId: input.modelId,
				lastPrompt: input.lastPrompt,
				runtimeSessionFile: input.runtimeSessionFile,
			};

			return {
				result: cloneSession(session),
				next: {
					...current,
					sessions: [session, ...current.sessions].slice(0, 50),
				},
			};
		});
	}

	updateSession(sessionId: string, input: UpdateShellSessionInput): ShellSessionRecord | undefined {
		return this.storage.withLock((current) => {
			const index = current.sessions.findIndex((session) => session.id === sessionId);
			if (index === -1) {
				return { result: undefined };
			}

			const existing = current.sessions[index]!;
			const nextRecord: ShellSessionRecord = {
				...existing,
				title: input.title ?? existing.title,
				summary: input.summary ?? existing.summary,
				state: input.state ?? existing.state,
				providerProfileId: input.providerProfileId ?? existing.providerProfileId,
				providerLabel: input.providerLabel ?? existing.providerLabel,
				modelId: input.modelId ?? existing.modelId,
				lastPrompt: input.lastPrompt ?? existing.lastPrompt,
				runtimeSessionFile: input.runtimeSessionFile ?? existing.runtimeSessionFile,
				updatedAt: nowIso(),
			};

			const sessions = current.sessions.slice();
			sessions[index] = nextRecord;

			return {
				result: cloneSession(nextRecord),
				next: {
					...current,
					sessions,
				},
			};
		});
	}

	markActive(sessionId: string): ShellSessionRecord | undefined {
		return this.storage.withLock((current) => {
			let activeRecord: ShellSessionRecord | undefined;
			const timestamp = nowIso();
			const sessions: ShellSessionRecord[] = current.sessions.map((session): ShellSessionRecord => {
				if (session.id === sessionId) {
					activeRecord = {
						...session,
						state: "active",
						updatedAt: timestamp,
					};
					return activeRecord;
				}

				if (session.state === "active") {
					return {
						...session,
						state: "recent",
						updatedAt: session.updatedAt,
					};
				}

				return session;
			});

			return {
				result: activeRecord ? cloneSession(activeRecord) : undefined,
				next: activeRecord
					? {
							...current,
							sessions,
						}
					: undefined,
			};
		});
	}
}
