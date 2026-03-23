import { contextBridge, ipcRenderer } from "electron";
const BRIDGE_CHANNELS = {
  getSnapshot: "wepsdesktop:get-snapshot",
  getWindowState: "wepsdesktop:get-window-state",
  activateWorkspace: "wepsdesktop:activate-workspace",
  chooseWorkspaceDirectory: "wepsdesktop:choose-workspace-directory",
  createProviderProfile: "wepsdesktop:create-provider-profile",
  createSession: "wepsdesktop:create-session",
  openExternal: "wepsdesktop:open-external",
  openSession: "wepsdesktop:open-session",
  refreshProviderModels: "wepsdesktop:refresh-provider-models",
  resolveApproval: "wepsdesktop:resolve-approval",
  sendPrompt: "wepsdesktop:send-prompt",
  setActiveSelection: "wepsdesktop:set-active-selection",
  abortSession: "wepsdesktop:abort-session",
  snapshotUpdated: "wepsdesktop:snapshot-updated",
  windowMinimize: "wepsdesktop:window-minimize",
  windowToggleMaximize: "wepsdesktop:window-toggle-maximize",
  windowClose: "wepsdesktop:window-close",
  windowStateUpdated: "wepsdesktop:window-state-updated"
};
const bridge = {
  getSnapshot: () => ipcRenderer.invoke(BRIDGE_CHANNELS.getSnapshot),
  getWindowState: () => ipcRenderer.invoke(BRIDGE_CHANNELS.getWindowState),
  activateWorkspace: (workspacePath) => ipcRenderer.invoke(BRIDGE_CHANNELS.activateWorkspace, workspacePath),
  chooseWorkspaceDirectory: () => ipcRenderer.invoke(BRIDGE_CHANNELS.chooseWorkspaceDirectory),
  createProviderProfile: (input) => ipcRenderer.invoke(BRIDGE_CHANNELS.createProviderProfile, input),
  createSession: () => ipcRenderer.invoke(BRIDGE_CHANNELS.createSession),
  onSnapshot: (listener) => {
    const wrapped = (_event, snapshot) => {
      listener(snapshot);
    };
    ipcRenderer.on(BRIDGE_CHANNELS.snapshotUpdated, wrapped);
    return () => {
      ipcRenderer.off(BRIDGE_CHANNELS.snapshotUpdated, wrapped);
    };
  },
  onWindowState: (listener) => {
    const wrapped = (_event, state) => {
      listener(state);
    };
    ipcRenderer.on(BRIDGE_CHANNELS.windowStateUpdated, wrapped);
    return () => {
      ipcRenderer.off(BRIDGE_CHANNELS.windowStateUpdated, wrapped);
    };
  },
  openExternal: (url) => ipcRenderer.invoke(BRIDGE_CHANNELS.openExternal, url),
  openSession: (sessionId) => ipcRenderer.invoke(BRIDGE_CHANNELS.openSession, sessionId),
  refreshProviderModels: (profileId) => ipcRenderer.invoke(BRIDGE_CHANNELS.refreshProviderModels, profileId),
  resolveApproval: (requestId, decision) => ipcRenderer.invoke(BRIDGE_CHANNELS.resolveApproval, requestId, decision),
  sendPrompt: (sessionId, text) => ipcRenderer.invoke(BRIDGE_CHANNELS.sendPrompt, sessionId, text),
  setActiveSelection: (profileId, modelId) => ipcRenderer.invoke(BRIDGE_CHANNELS.setActiveSelection, profileId, modelId),
  abortSession: (sessionId) => ipcRenderer.invoke(BRIDGE_CHANNELS.abortSession, sessionId),
  minimizeWindow: () => ipcRenderer.invoke(BRIDGE_CHANNELS.windowMinimize),
  toggleMaximizeWindow: () => ipcRenderer.invoke(BRIDGE_CHANNELS.windowToggleMaximize),
  closeWindow: () => ipcRenderer.invoke(BRIDGE_CHANNELS.windowClose)
};
contextBridge.exposeInMainWorld("wepsDesktop", bridge);
