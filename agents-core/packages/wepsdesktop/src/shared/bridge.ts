export const BRIDGE_CHANNELS = {
	getSnapshot: "wepsdesktop:get-snapshot",
	getWindowState: "wepsdesktop:get-window-state",
	activateWorkspace: "wepsdesktop:activate-workspace",
	chooseWorkspaceDirectory: "wepsdesktop:choose-workspace-directory",
	closeWorkspace: "wepsdesktop:close-workspace",
	createProviderProfile: "wepsdesktop:create-provider-profile",
	createSession: "wepsdesktop:create-session",
	deleteSession: "wepsdesktop:delete-session",
	openExternal: "wepsdesktop:open-external",
	openSession: "wepsdesktop:open-session",
	archiveSession: "wepsdesktop:archive-session",
	refreshProviderModels: "wepsdesktop:refresh-provider-models",
	resolveApproval: "wepsdesktop:resolve-approval",
	sendPrompt: "wepsdesktop:send-prompt",
	setActiveSelection: "wepsdesktop:set-active-selection",
	abortSession: "wepsdesktop:abort-session",
	getMessageContent: "wepsdesktop:get-message-content",
	snapshotUpdated: "wepsdesktop:snapshot-updated",
	windowMinimize: "wepsdesktop:window-minimize",
	windowToggleMaximize: "wepsdesktop:window-toggle-maximize",
	windowClose: "wepsdesktop:window-close",
	windowStateUpdated: "wepsdesktop:window-state-updated",
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

export interface DesktopWindowState {
	isFullScreen: boolean;
	isMaximized: boolean;
}

export type DesktopProviderFamily = "openai" | "anthropic";
export type DesktopProviderApiDialect = "openai-responses" | "openai-completions" | "anthropic-messages";
export type DesktopValidationStatus = "unknown" | "ok" | "error";
export type DesktopSessionState = "active" | "ready" | "recent";
export type DesktopChatMessageRole = "system" | "user" | "assistant";
export type DesktopChatMessageKind = "default" | "status" | "tool" | "reasoning";
export type DesktopRuntimePhase = "idle" | "running" | "retrying" | "compacting" | "interrupted" | "error";
export type DesktopToolMessageStatus = "awaiting_approval" | "running" | "completed" | "failed";
export type DesktopToolApprovalDecision = "allow" | "reject" | "cancel";

export interface DesktopDiscoveredModel {
	id: string;
	name: string;
	family: DesktopProviderFamily;
}

export interface DesktopProviderProfile {
	id: string;
	label: string;
	family: DesktopProviderFamily;
	apiDialect: DesktopProviderApiDialect;
	baseUrl: string;
	enabled: boolean;
	models: DesktopDiscoveredModel[];
	createdAt: string;
	updatedAt: string;
	lastValidatedAt?: string;
	lastValidationStatus: DesktopValidationStatus;
	lastValidationMessage?: string;
}

export interface DesktopSessionRecord {
	id: string;
	title: string;
	summary: string;
	state: DesktopSessionState;
	createdAt: string;
	updatedAt: string;
	workspacePath?: string;
	providerProfileId?: string;
	providerLabel?: string;
	modelId?: string;
	lastPrompt?: string;
	runtimeSessionFile?: string;
}

export interface DesktopSelection {
	profileId?: string;
	modelId?: string;
}

export interface DesktopToolDiffStats {
	added: number;
	removed: number;
	context: number;
	meta: number;
}

export interface DesktopToolDiffLine {
	kind: "added" | "removed" | "context" | "meta";
	lineNumber?: string;
	content: string;
	rawText: string;
}

export interface DesktopToolFileChange {
	kind: "edit" | "write";
	path: string;
	summary: string;
	firstChangedLine?: number;
	diffText?: string;
	diffLines?: DesktopToolDiffLine[];
	diffStats?: DesktopToolDiffStats;
	previewText?: string;
}

export interface DesktopToolMessageState {
	toolCallId: string;
	toolName: string;
	status: DesktopToolMessageStatus;
	argsText: string;
	outputText: string;
	fileChanges: DesktopToolFileChange[];
}

export interface DesktopChatMessage {
	id: string;
	role: DesktopChatMessageRole;
	content: string;
	time: string;
	kind?: DesktopChatMessageKind;
	lineCount?: number;
	contentTruncated?: boolean;
	fullContentAvailable?: boolean;
	contentVersion?: number;
	collapsible?: boolean;
	expanded?: boolean;
	tool?: DesktopToolMessageState;
}

export interface DesktopRuntimeState {
	phase: DesktopRuntimePhase;
	label: string;
	detail?: string;
	interruptible: boolean;
	canContinue: boolean;
}

export interface DesktopToolApprovalRequest {
	id: string;
	sessionId: string;
	toolCallId: string;
	toolName: string;
	riskLabel: string;
	reason: string;
	summary: string;
	argsText: string;
	commandText?: string;
	fileChanges: DesktopToolFileChange[];
}

export interface DesktopSessionSnapshot {
	record: DesktopSessionRecord;
	messages: DesktopChatMessage[];
	runtimeState: DesktopRuntimeState;
	selection: DesktopSelection;
	pendingApproval?: DesktopToolApprovalRequest;
}

export interface DesktopSnapshot {
	appContext: DesktopAppContext;
	agentDir: string;
	currentWorkspacePath?: string;
	recentWorkspaces: string[];
	providerProfiles: DesktopProviderProfile[];
	activeSelection: DesktopSelection;
	sessions: DesktopSessionRecord[];
	activeSession?: DesktopSessionSnapshot;
}

export interface CreateDesktopProviderProfileInput {
	label: string;
	family: DesktopProviderFamily;
	baseUrl: string;
	apiKey: string;
	apiDialect?: DesktopProviderApiDialect;
}

export interface DesktopSnapshotListener {
	(snapshot: DesktopSnapshot): void;
}

export interface DesktopWindowStateListener {
	(state: DesktopWindowState): void;
}

export interface WepsDesktopBridge {
	getSnapshot(): Promise<DesktopSnapshot>;
	getWindowState(): Promise<DesktopWindowState>;
	activateWorkspace(workspacePath: string): Promise<DesktopSnapshot>;
	chooseWorkspaceDirectory(): Promise<string | null>;
	closeWorkspace(): Promise<DesktopSnapshot>;
	createProviderProfile(input: CreateDesktopProviderProfileInput): Promise<DesktopSnapshot>;
	createSession(): Promise<DesktopSnapshot>;
	deleteSession(sessionId: string): Promise<DesktopSnapshot>;
	onSnapshot(listener: DesktopSnapshotListener): () => void;
	onWindowState(listener: DesktopWindowStateListener): () => void;
	openExternal(url: string): Promise<void>;
	openSession(sessionId: string): Promise<DesktopSnapshot>;
	archiveSession(sessionId: string): Promise<DesktopSnapshot>;
	refreshProviderModels(profileId: string): Promise<DesktopSnapshot>;
	resolveApproval(requestId: string, decision: DesktopToolApprovalDecision): Promise<DesktopSnapshot>;
	sendPrompt(sessionId: string, text: string): Promise<void>;
	setActiveSelection(profileId: string, modelId?: string): Promise<DesktopSnapshot>;
	abortSession(sessionId: string): Promise<DesktopSnapshot>;
	getMessageContent(sessionId: string, messageId: string): Promise<string | null>;
	minimizeWindow(): Promise<DesktopWindowState>;
	toggleMaximizeWindow(): Promise<DesktopWindowState>;
	closeWindow(): Promise<void>;
}
