import { contextBridge, ipcRenderer } from "electron";
import {
	BRIDGE_CHANNELS,
	type CreateDesktopProviderProfileInput,
	type DesktopSnapshot,
	type DesktopSnapshotListener,
	type DesktopToolApprovalDecision,
	type DesktopWindowState,
	type DesktopWindowStateListener,
	type WepsDesktopBridge,
} from "../shared/bridge.js";

const bridge: WepsDesktopBridge = {
	getSnapshot: () => ipcRenderer.invoke(BRIDGE_CHANNELS.getSnapshot) as Promise<DesktopSnapshot>,
	getWindowState: () => ipcRenderer.invoke(BRIDGE_CHANNELS.getWindowState) as Promise<DesktopWindowState>,
	activateWorkspace: (workspacePath: string) =>
		ipcRenderer.invoke(BRIDGE_CHANNELS.activateWorkspace, workspacePath) as Promise<DesktopSnapshot>,
	chooseWorkspaceDirectory: () =>
		ipcRenderer.invoke(BRIDGE_CHANNELS.chooseWorkspaceDirectory) as Promise<string | null>,
	createProviderProfile: (input: CreateDesktopProviderProfileInput) =>
		ipcRenderer.invoke(BRIDGE_CHANNELS.createProviderProfile, input) as Promise<DesktopSnapshot>,
	createSession: () => ipcRenderer.invoke(BRIDGE_CHANNELS.createSession) as Promise<DesktopSnapshot>,
	onSnapshot: (listener: DesktopSnapshotListener) => {
		const wrapped = (_event: Electron.IpcRendererEvent, snapshot: DesktopSnapshot) => {
			listener(snapshot);
		};
		ipcRenderer.on(BRIDGE_CHANNELS.snapshotUpdated, wrapped);
		return () => {
			ipcRenderer.off(BRIDGE_CHANNELS.snapshotUpdated, wrapped);
		};
	},
	onWindowState: (listener: DesktopWindowStateListener) => {
		const wrapped = (_event: Electron.IpcRendererEvent, state: DesktopWindowState) => {
			listener(state);
		};
		ipcRenderer.on(BRIDGE_CHANNELS.windowStateUpdated, wrapped);
		return () => {
			ipcRenderer.off(BRIDGE_CHANNELS.windowStateUpdated, wrapped);
		};
	},
	openExternal: (url: string) => ipcRenderer.invoke(BRIDGE_CHANNELS.openExternal, url) as Promise<void>,
	openSession: (sessionId: string) =>
		ipcRenderer.invoke(BRIDGE_CHANNELS.openSession, sessionId) as Promise<DesktopSnapshot>,
	refreshProviderModels: (profileId: string) =>
		ipcRenderer.invoke(BRIDGE_CHANNELS.refreshProviderModels, profileId) as Promise<DesktopSnapshot>,
	resolveApproval: (requestId: string, decision: DesktopToolApprovalDecision) =>
		ipcRenderer.invoke(BRIDGE_CHANNELS.resolveApproval, requestId, decision) as Promise<DesktopSnapshot>,
	sendPrompt: (sessionId: string, text: string) =>
		ipcRenderer.invoke(BRIDGE_CHANNELS.sendPrompt, sessionId, text) as Promise<void>,
	setActiveSelection: (profileId: string, modelId?: string) =>
		ipcRenderer.invoke(BRIDGE_CHANNELS.setActiveSelection, profileId, modelId) as Promise<DesktopSnapshot>,
	abortSession: (sessionId: string) =>
		ipcRenderer.invoke(BRIDGE_CHANNELS.abortSession, sessionId) as Promise<DesktopSnapshot>,
	minimizeWindow: () => ipcRenderer.invoke(BRIDGE_CHANNELS.windowMinimize) as Promise<DesktopWindowState>,
	toggleMaximizeWindow: () =>
		ipcRenderer.invoke(BRIDGE_CHANNELS.windowToggleMaximize) as Promise<DesktopWindowState>,
	closeWindow: () => ipcRenderer.invoke(BRIDGE_CHANNELS.windowClose) as Promise<void>,
};

contextBridge.exposeInMainWorld("wepsDesktop", bridge);
