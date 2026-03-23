import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { BRIDGE_CHANNELS, type DesktopAppContext } from "../shared/bridge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rendererDistPath = join(__dirname, "../renderer");
const preloadPath = join(__dirname, "../preload/index.js");
const devServerUrl = process.env.VITE_DEV_SERVER_URL;

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

async function createMainWindow(): Promise<BrowserWindow> {
	const window = new BrowserWindow({
		width: 1480,
		height: 960,
		minWidth: 1180,
		minHeight: 760,
		title: "WEPS Desktop",
		backgroundColor: "#09111f",
		autoHideMenuBar: true,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

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

	if (devServerUrl) {
		await window.loadURL(devServerUrl);
		return window;
	}

	await window.loadFile(join(rendererDistPath, "index.html"));
	return window;
}

app.setName("WEPS Desktop");

app.whenReady().then(async () => {
	const mainWindow = await createMainWindow();

	ipcMain.handle(BRIDGE_CHANNELS.getAppContext, () => createDesktopContext());
	ipcMain.handle(BRIDGE_CHANNELS.chooseWorkspaceDirectory, async () => handleChooseWorkspaceDirectory(mainWindow));
	ipcMain.handle(BRIDGE_CHANNELS.openExternal, async (_event, url: string) => handleOpenExternal(url));

	app.on("activate", async () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			await createMainWindow();
		}
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});
