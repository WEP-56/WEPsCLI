import { existsSync, rmSync, watchFile, unwatchFile } from "fs";
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
	workspacePath?: string;
	providerProfileId?: string;
	providerLabel?: string;
	modelId?: string;
	lastPrompt?: string;
	runtimeSessionFile?: string;
	archivedAt?: string;
}

interface SessionsConfig {
	version: 1;
	sessions: ShellSessionRecord[];
}

type SessionHistoryListener = (sessions: ShellSessionRecord[]) => void;

interface CreateShellSessionInput {
	title: string;
	summary: string;
	state?: ShellSessionState;
	workspacePath?: string;
	providerProfileId?: string;
	providerLabel?: string;
	modelId?: string;
	lastPrompt?: string;
	runtimeSessionFile?: string;
	archivedAt?: string;
}

interface UpdateShellSessionInput {
	title?: string;
	summary?: string;
	state?: ShellSessionState;
	workspacePath?: string;
	providerProfileId?: string;
	providerLabel?: string;
	modelId?: string;
	lastPrompt?: string;
	runtimeSessionFile?: string;
	archivedAt?: string;
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

	constructor(private readonly filePath: string = getSessionsPath()) {
		this.storage = new LockedJsonFile<SessionsConfig>(filePath, createDefaultSessionsConfig());
	}

	subscribe(listener: SessionHistoryListener): () => void {
		const callback = () => {
			listener(this.listSessions());
		};

		this.storage.read();
		const watcher = (current: { mtimeMs: number; size: number }, previous: { mtimeMs: number; size: number }) => {
			if (current.mtimeMs === previous.mtimeMs && current.size === previous.size) {
				return;
			}
			callback();
		};
		watchFile(this.filePath, { persistent: false, interval: 300 }, watcher);

		return () => {
			unwatchFile(this.filePath, watcher);
		};
	}

	listSessions(workspacePath?: string, options: { includeArchived?: boolean } = {}): ShellSessionRecord[] {
		const config = this.storage.read();
		const sessions = (workspacePath
			? config.sessions.filter((session) => session.workspacePath === workspacePath)
			: config.sessions
		).filter((session) => options.includeArchived || !session.archivedAt);
		return sessions
			.slice()
			.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
			.map(cloneSession);
	}

	getSession(sessionId: string): ShellSessionRecord | undefined {
		const config = this.storage.read();
		const session = config.sessions.find((record) => record.id === sessionId);
		return session ? cloneSession(session) : undefined;
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
				workspacePath: item.workspacePath,
				providerProfileId: item.providerProfileId,
				providerLabel: item.providerLabel,
				modelId: item.modelId,
				lastPrompt: item.lastPrompt,
				runtimeSessionFile: item.runtimeSessionFile,
				archivedAt: item.archivedAt,
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
				workspacePath: input.workspacePath,
				providerProfileId: input.providerProfileId,
				providerLabel: input.providerLabel,
				modelId: input.modelId,
				lastPrompt: input.lastPrompt,
				runtimeSessionFile: input.runtimeSessionFile,
				archivedAt: input.archivedAt,
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
				workspacePath: input.workspacePath ?? existing.workspacePath,
				providerProfileId: input.providerProfileId ?? existing.providerProfileId,
				providerLabel: input.providerLabel ?? existing.providerLabel,
				modelId: input.modelId ?? existing.modelId,
				lastPrompt: input.lastPrompt ?? existing.lastPrompt,
				runtimeSessionFile: input.runtimeSessionFile ?? existing.runtimeSessionFile,
				archivedAt: input.archivedAt ?? existing.archivedAt,
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

	archiveSession(sessionId: string): ShellSessionRecord | undefined {
		return this.storage.withLock((current) => {
			const index = current.sessions.findIndex((session) => session.id === sessionId);
			if (index === -1) {
				return { result: undefined };
			}

			const existing = current.sessions[index]!;
			const nextRecord: ShellSessionRecord = {
				...existing,
				state: existing.state === "active" ? "recent" : existing.state,
				archivedAt: nowIso(),
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

	deleteSession(sessionId: string): ShellSessionRecord | undefined {
		return this.storage.withLock((current) => {
			const index = current.sessions.findIndex((session) => session.id === sessionId);
			if (index === -1) {
				return { result: undefined };
			}

			const existing = current.sessions[index]!;
			if (existing.runtimeSessionFile && existsSync(existing.runtimeSessionFile)) {
				try {
					rmSync(existing.runtimeSessionFile, { force: true });
				} catch {
					// Ignore cleanup failures; removing the history record is still useful.
				}
			}

			const sessions = current.sessions.filter((session) => session.id !== sessionId);
			return {
				result: cloneSession(existing),
				next: {
					...current,
					sessions,
				},
			};
		});
	}
}
