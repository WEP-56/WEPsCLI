import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	BRIDGE_CHANNELS,
	type CreateDesktopProviderProfileInput,
	type DesktopAppContext,
	type DesktopSnapshot,
	type DesktopToolApprovalDecision,
	type DesktopWindowState,
} from "../shared/bridge.js";
import { DesktopController } from "./desktop-controller.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rendererDistPath = join(__dirname, "../renderer");
const preloadPath = join(__dirname, "../preload/index.mjs");
const devServerUrl = process.env.ELECTRON_RENDERER_URL;

let mainWindow: BrowserWindow | null = null;
let controller: DesktopController | null = null;
let pendingSnapshot: DesktopSnapshot | null = null;

function createDesktopContext(): DesktopAppContext {
	return {
		appName: app.getName(),
		appVersion: app.getVersion(),
		platform: process.platform,
		workingDirectory: process.cwd(),
		userDataPath: app.getPath("userData"),
		versions: {
			chrome: process.versions.chrome ?? "",
			electron: process.versions.electron ?? "",
			node: process.versions.node,
		},
	};
}

async function handleOpenExternal(url: string): Promise<void> {
	const parsed = new URL(url);
	if (!["http:", "https:"].includes(parsed.protocol)) {
		throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
	}
	await shell.openExternal(parsed.toString());
}

async function handleChooseWorkspaceDirectory(window: BrowserWindow): Promise<string | null> {
	const result = await dialog.showOpenDialog(window, {
		properties: ["openDirectory", "createDirectory"],
		title: "Choose Workspace Directory",
	});
	if (result.canceled) {
		return null;
	}
	return result.filePaths[0] ?? null;
}

async function loadWindowContent(window: BrowserWindow): Promise<void> {
	if (devServerUrl) {
		await window.loadURL(devServerUrl);
		return;
	}

	await window.loadFile(join(rendererDistPath, "index.html"));
}

function flushPendingSnapshot(): void {
	if (!pendingSnapshot || !mainWindow || mainWindow.isDestroyed()) {
		pendingSnapshot = null;
		return;
	}

	if (mainWindow.webContents.isLoadingMainFrame()) {
		return;
	}

	const snapshot = pendingSnapshot;
	pendingSnapshot = null;
	mainWindow.webContents.send(BRIDGE_CHANNELS.snapshotUpdated, snapshot);
}

function scheduleSnapshotEmit(snapshot: DesktopSnapshot): void {
	pendingSnapshot = snapshot;
	if (!mainWindow || mainWindow.isDestroyed()) {
		return;
	}

	if (mainWindow.webContents.isLoadingMainFrame()) {
		return;
	}

	flushPendingSnapshot();
}

function getWindowState(window: BrowserWindow): DesktopWindowState {
	return {
		isFullScreen: window.isFullScreen(),
		isMaximized: window.isMaximized(),
	};
}

function emitWindowState(): void {
	if (!mainWindow || mainWindow.isDestroyed()) {
		return;
	}
	mainWindow.webContents.send(BRIDGE_CHANNELS.windowStateUpdated, getWindowState(mainWindow));
}

async function createMainWindow(): Promise<BrowserWindow> {
	const window = new BrowserWindow({
		width: 1480,
		height: 960,
		minWidth: 1180,
		minHeight: 760,
		title: "WEPS Desktop",
		frame: false,
		backgroundColor: "#0f0f0f",
		autoHideMenuBar: true,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	if (devServerUrl) {
		window.webContents.openDevTools({ mode: "detach" });
	}

	window.webContents.setWindowOpenHandler(({ url }) => {
		void handleOpenExternal(url).catch(() => {});
		return { action: "deny" };
	});

	window.webContents.on("will-navigate", (event, url) => {
		if (devServerUrl && url.startsWith(devServerUrl)) {
			return;
		}
		event.preventDefault();
		void handleOpenExternal(url).catch(() => {});
	});

	window.on("maximize", () => emitWindowState());
	window.on("unmaximize", () => emitWindowState());
	window.on("enter-full-screen", () => emitWindowState());
	window.on("leave-full-screen", () => emitWindowState());
	return window;
}

function registerIpcHandlers(): void {
	ipcMain.removeHandler(BRIDGE_CHANNELS.getSnapshot);
	ipcMain.handle(BRIDGE_CHANNELS.getSnapshot, () => controller?.getSnapshot());

	ipcMain.removeHandler(BRIDGE_CHANNELS.getWindowState);
	ipcMain.handle(BRIDGE_CHANNELS.getWindowState, () => {
		if (!mainWindow) {
			throw new Error("Main window is not available.");
		}
		return getWindowState(mainWindow);
	});

	ipcMain.removeHandler(BRIDGE_CHANNELS.activateWorkspace);
	ipcMain.handle(BRIDGE_CHANNELS.activateWorkspace, async (_event, workspacePath: string) =>
		controller?.activateWorkspace(workspacePath),
	);

	ipcMain.removeHandler(BRIDGE_CHANNELS.chooseWorkspaceDirectory);
	ipcMain.handle(BRIDGE_CHANNELS.chooseWorkspaceDirectory, async () => {
		if (!mainWindow) {
			throw new Error("Main window is not available.");
		}
		return handleChooseWorkspaceDirectory(mainWindow);
	});

	ipcMain.removeHandler(BRIDGE_CHANNELS.closeWorkspace);
	ipcMain.handle(BRIDGE_CHANNELS.closeWorkspace, async () => controller?.closeWorkspace());

	ipcMain.removeHandler(BRIDGE_CHANNELS.createProviderProfile);
	ipcMain.handle(BRIDGE_CHANNELS.createProviderProfile, async (_event, input: CreateDesktopProviderProfileInput) =>
		controller?.createProviderProfile(input),
	);

	ipcMain.removeHandler(BRIDGE_CHANNELS.createSession);
	ipcMain.handle(BRIDGE_CHANNELS.createSession, async () => controller?.createSession());

	ipcMain.removeHandler(BRIDGE_CHANNELS.deleteSession);
	ipcMain.handle(BRIDGE_CHANNELS.deleteSession, async (_event, sessionId: string) =>
		controller?.deleteSession(sessionId),
	);

	ipcMain.removeHandler(BRIDGE_CHANNELS.openExternal);
	ipcMain.handle(BRIDGE_CHANNELS.openExternal, async (_event, url: string) => handleOpenExternal(url));

	ipcMain.removeHandler(BRIDGE_CHANNELS.openSession);
	ipcMain.handle(BRIDGE_CHANNELS.openSession, async (_event, sessionId: string) => controller?.openSession(sessionId));

	ipcMain.removeHandler(BRIDGE_CHANNELS.archiveSession);
	ipcMain.handle(BRIDGE_CHANNELS.archiveSession, async (_event, sessionId: string) =>
		controller?.archiveSession(sessionId),
	);

	ipcMain.removeHandler(BRIDGE_CHANNELS.refreshProviderModels);
	ipcMain.handle(BRIDGE_CHANNELS.refreshProviderModels, async (_event, profileId: string) =>
		controller?.refreshProviderModels(profileId),
	);

	ipcMain.removeHandler(BRIDGE_CHANNELS.resolveApproval);
	ipcMain.handle(
		BRIDGE_CHANNELS.resolveApproval,
		async (_event, requestId: string, decision: DesktopToolApprovalDecision) =>
			controller?.resolveApproval(requestId, decision),
	);

	ipcMain.removeHandler(BRIDGE_CHANNELS.sendPrompt);
	ipcMain.handle(BRIDGE_CHANNELS.sendPrompt, async (_event, sessionId: string, text: string) =>
		controller?.sendPrompt(sessionId, text),
	);

	ipcMain.removeHandler(BRIDGE_CHANNELS.setActiveSelection);
	ipcMain.handle(BRIDGE_CHANNELS.setActiveSelection, async (_event, profileId: string, modelId?: string) =>
		controller?.setActiveSelection(profileId, modelId),
	);

	ipcMain.removeHandler(BRIDGE_CHANNELS.abortSession);
	ipcMain.handle(BRIDGE_CHANNELS.abortSession, async (_event, sessionId: string) =>
		controller?.abortSession(sessionId),
	);

	ipcMain.removeHandler(BRIDGE_CHANNELS.getMessageContent);
	ipcMain.handle(BRIDGE_CHANNELS.getMessageContent, async (_event, sessionId: string, messageId: string) =>
		controller?.getMessageContent(sessionId, messageId) ?? null,
	);

	ipcMain.removeHandler(BRIDGE_CHANNELS.windowMinimize);
	ipcMain.handle(BRIDGE_CHANNELS.windowMinimize, async () => {
		if (!mainWindow) {
			throw new Error("Main window is not available.");
		}
		mainWindow.minimize();
		return getWindowState(mainWindow);
	});

	ipcMain.removeHandler(BRIDGE_CHANNELS.windowToggleMaximize);
	ipcMain.handle(BRIDGE_CHANNELS.windowToggleMaximize, async () => {
		if (!mainWindow) {
			throw new Error("Main window is not available.");
		}
		if (mainWindow.isMaximized()) {
			mainWindow.unmaximize();
		} else {
			mainWindow.maximize();
		}
		return getWindowState(mainWindow);
	});

	ipcMain.removeHandler(BRIDGE_CHANNELS.windowClose);
	ipcMain.handle(BRIDGE_CHANNELS.windowClose, async () => {
		if (!mainWindow) {
			throw new Error("Main window is not available.");
		}
		mainWindow.close();
	});
}

app.setName("WEPS Desktop");

app.whenReady()
	.then(async () => {
		controller = new DesktopController(
			createDesktopContext(),
			join(app.getPath("userData"), "workspace-state.json"),
			(snapshot) => scheduleSnapshotEmit(snapshot),
		);
		registerIpcHandlers();
		mainWindow = await createMainWindow();
		await loadWindowContent(mainWindow);
		mainWindow.webContents.once("did-finish-load", () => {
			emitWindowState();
			flushPendingSnapshot();
		});

		app.on("activate", async () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				mainWindow = await createMainWindow();
				await loadWindowContent(mainWindow);
				mainWindow.webContents.once("did-finish-load", () => {
					emitWindowState();
					flushPendingSnapshot();
				});
			}
		});
	})
	.catch((error) => {
		console.error("Failed to start WEPS Desktop:", error);
		app.quit();
	});

app.on("window-all-closed", () => {
	controller?.dispose();
	controller = null;
	pendingSnapshot = null;
	mainWindow = null;
	if (process.platform !== "darwin") {
		app.quit();
	}
});
