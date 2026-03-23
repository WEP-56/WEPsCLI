import { contextBridge, ipcRenderer } from "electron";
import { BRIDGE_CHANNELS, type DesktopAppContext, type WepsDesktopBridge } from "../shared/bridge.js";

const bridge: WepsDesktopBridge = {
	getAppContext: () => ipcRenderer.invoke(BRIDGE_CHANNELS.getAppContext) as Promise<DesktopAppContext>,
	chooseWorkspaceDirectory: () =>
		ipcRenderer.invoke(BRIDGE_CHANNELS.chooseWorkspaceDirectory) as Promise<string | null>,
	openExternal: (url: string) => ipcRenderer.invoke(BRIDGE_CHANNELS.openExternal, url) as Promise<void>,
};

contextBridge.exposeInMainWorld("wepsDesktop", bridge);
