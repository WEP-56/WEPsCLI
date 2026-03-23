export const BRIDGE_CHANNELS = {
	getAppContext: "wepsdesktop:get-app-context",
	chooseWorkspaceDirectory: "wepsdesktop:choose-workspace-directory",
	openExternal: "wepsdesktop:open-external",
} as const;

export interface DesktopAppContext {
	appName: string;
	appVersion: string;
	platform: NodeJS.Platform;
	workingDirectory: string;
	userDataPath: string;
	versions: {
		chrome: string;
		electron: string;
		node: string;
	};
}

export interface WepsDesktopBridge {
	getAppContext(): Promise<DesktopAppContext>;
	chooseWorkspaceDirectory(): Promise<string | null>;
	openExternal(url: string): Promise<void>;
}
