import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface WorkspaceStoreState {
	currentWorkspacePath?: string;
	recentWorkspaces: string[];
}

function createDefaultState(): WorkspaceStoreState {
	return {
		recentWorkspaces: [],
	};
}

export class WorkspaceStore {
	constructor(private readonly filePath: string) {}

	load(): WorkspaceStoreState {
		if (!existsSync(this.filePath)) {
			return createDefaultState();
		}

		try {
			const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<WorkspaceStoreState>;
			return {
				currentWorkspacePath:
					typeof parsed.currentWorkspacePath === "string" ? parsed.currentWorkspacePath : undefined,
				recentWorkspaces: Array.isArray(parsed.recentWorkspaces)
					? parsed.recentWorkspaces.filter((value): value is string => typeof value === "string" && value.length > 0)
					: [],
			};
		} catch {
			return createDefaultState();
		}
	}

	save(state: WorkspaceStoreState): void {
		const directory = dirname(this.filePath);
		if (!existsSync(directory)) {
			mkdirSync(directory, { recursive: true });
		}

		writeFileSync(this.filePath, `${JSON.stringify(state, null, 2)}\n`);
	}

	rememberWorkspace(workspacePath: string): WorkspaceStoreState {
		const current = this.load();
		const recentWorkspaces = [workspacePath, ...current.recentWorkspaces.filter((value) => value !== workspacePath)].slice(
			0,
			10,
		);

		const nextState: WorkspaceStoreState = {
			currentWorkspacePath: workspacePath,
			recentWorkspaces,
		};
		this.save(nextState);
		return nextState;
	}
}
