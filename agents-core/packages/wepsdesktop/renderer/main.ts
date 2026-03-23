import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import {
	ApiKeysTab,
	ApiKeyPromptDialog,
	AppStorage,
	ChatPanel,
	CustomProvidersStore,
	defaultConvertToLlm,
	IndexedDBStorageBackend,
	ProviderKeysStore,
	ProvidersModelsTab,
	ProxyTab,
	SessionListDialog,
	SessionsStore,
	SettingsDialog,
	SettingsStore,
	type UserMessageWithAttachments,
	setAppStorage,
} from "@mariozechner/pi-web-ui";
import { html, render, type TemplateResult } from "lit";
import "./app.css";
import type { DesktopAppContext } from "../src/shared/bridge.js";

const settingsStore = new SettingsStore();
const providerKeysStore = new ProviderKeysStore();
const sessionsStore = new SessionsStore();
const customProvidersStore = new CustomProvidersStore();

const storageBackend = new IndexedDBStorageBackend({
	dbName: "wepsdesktop",
	version: 1,
	stores: [
		settingsStore.getConfig(),
		SessionsStore.getMetadataConfig(),
		providerKeysStore.getConfig(),
		customProvidersStore.getConfig(),
		sessionsStore.getConfig(),
	],
});

settingsStore.setBackend(storageBackend);
providerKeysStore.setBackend(storageBackend);
customProvidersStore.setBackend(storageBackend);
sessionsStore.setBackend(storageBackend);

const storage = new AppStorage(
	settingsStore,
	providerKeysStore,
	sessionsStore,
	customProvidersStore,
	storageBackend,
);
setAppStorage(storage);

let desktopContext: DesktopAppContext | null = null;
let activeWorkspacePath = "";
let activeSessionId: string | undefined;
let agent: Agent | undefined;
let chatPanel: ChatPanel | undefined;
let unsubscribeAgent: (() => void) | undefined;

function getRoot(): HTMLElement {
	const root = document.getElementById("app");
	if (!root) {
		throw new Error("App root not found");
	}
	return root;
}

function truncate(value: string, maxLength: number): string {
	const trimmed = value.trim();
	if (trimmed.length <= maxLength) {
		return trimmed;
	}
	return `${trimmed.slice(0, maxLength - 1)}…`;
}

function getTextFromContent(content: AgentMessage["content"] | UserMessageWithAttachments["content"]): string {
	if (typeof content === "string") {
		return content;
	}

	if (!Array.isArray(content)) {
		return "";
	}

	const textParts: string[] = [];
	for (const item of content) {
		if (
			typeof item === "object" &&
			item !== null &&
			"type" in item &&
			item.type === "text" &&
			"text" in item &&
			typeof item.text === "string"
		) {
			textParts.push(item.text);
		}
	}

	return textParts.join(" ");
}

function getMessageText(message: AgentMessage): string {
	if (message.role === "user" || message.role === "assistant") {
		return getTextFromContent(message.content);
	}

	if ((message as UserMessageWithAttachments).role === "user-with-attachments") {
		return getTextFromContent((message as UserMessageWithAttachments).content);
	}

	return "";
}

function deriveSessionTitle(messages: AgentMessage[]): string {
	const firstPrompt = messages.find(
		(message) => message.role === "user" || (message as UserMessageWithAttachments).role === "user-with-attachments",
	);
	if (!firstPrompt) {
		return "Untitled Session";
	}

	const text = getMessageText(firstPrompt);
	if (!text) {
		return "Untitled Session";
	}

	const firstSentenceIndex = text.search(/[.!?]/);
	if (firstSentenceIndex > 0 && firstSentenceIndex <= 56) {
		return truncate(text.slice(0, firstSentenceIndex + 1), 60);
	}
	return truncate(text, 60);
}

function canPersistSession(messages: AgentMessage[]): boolean {
	const hasUserMessage = messages.some(
		(message) => message.role === "user" || (message as UserMessageWithAttachments).role === "user-with-attachments",
	);
	const hasAssistantMessage = messages.some((message) => message.role === "assistant");
	return hasUserMessage && hasAssistantMessage;
}

async function ensureWorkspacePath(): Promise<void> {
	const savedWorkspacePath = await storage.settings.get<string>("desktop.workspacePath");
	activeWorkspacePath = savedWorkspacePath || desktopContext?.workingDirectory || "";
}

async function saveWorkspacePath(nextWorkspacePath: string): Promise<void> {
	activeWorkspacePath = nextWorkspacePath;
	await storage.settings.set("desktop.workspacePath", nextWorkspacePath);
}

async function saveSessionSnapshot(): Promise<void> {
	if (!agent || !activeSessionId) {
		return;
	}

	const { messages, model, thinkingLevel } = agent.state;
	if (!canPersistSession(messages) || !model) {
		return;
	}

	const now = new Date().toISOString();
	const title = deriveSessionTitle(messages);

	await storage.sessions.save(
		{
			id: activeSessionId,
			title,
			model,
			thinkingLevel,
			messages,
			createdAt: now,
			lastModified: now,
		},
		{
			id: activeSessionId,
			title,
			createdAt: now,
			lastModified: now,
			messageCount: messages.length,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			},
			thinkingLevel,
			preview: truncate(title, 120),
		},
	);
}

async function setAgent(initialMessages: AgentMessage[] = []): Promise<void> {
	unsubscribeAgent?.();

	const nextAgent = new Agent({
		initialState: {
			systemPrompt: [
				"You are the WEPS Desktop prototype assistant.",
				"You are running inside an Electron feasibility build that reuses the pi web UI package.",
				`Current workspace: ${activeWorkspacePath || "not selected"}.`,
				"Prefer practical coding help. Call tools only when useful.",
			].join(" "),
			model: getModel("anthropic", "claude-sonnet-4-5-20250929"),
			thinkingLevel: "off",
			messages: initialMessages,
			tools: [],
		},
		convertToLlm: defaultConvertToLlm,
	});
	agent = nextAgent;

	unsubscribeAgent = nextAgent.subscribe((_event) => {
		if (!activeSessionId && canPersistSession(nextAgent.state.messages)) {
			activeSessionId = crypto.randomUUID();
		}

		if (activeSessionId) {
			void saveSessionSnapshot();
		}

		renderShell();
	});

	if (!chatPanel) {
		chatPanel = new ChatPanel();
	}

	await chatPanel.setAgent(nextAgent, {
		onApiKeyRequired: async (provider: string) => ApiKeyPromptDialog.prompt(provider),
	});
}

async function loadSession(sessionId: string): Promise<void> {
	const data = await storage.sessions.get(sessionId);
	if (!data) {
		return;
	}
	activeSessionId = sessionId;
	await setAgent(data.messages);
	renderShell();
}

async function createFreshSession(): Promise<void> {
	activeSessionId = undefined;
	await setAgent();
	renderShell();
}

async function pickWorkspaceDirectory(): Promise<void> {
	const nextWorkspacePath = await window.wepsDesktop.chooseWorkspaceDirectory();
	if (!nextWorkspacePath) {
		return;
	}
	await saveWorkspacePath(nextWorkspacePath);
	renderShell();
}

function renderKeyValue(label: string, value: string): TemplateResult {
	return html`
		<div class="card__kv">
			<span class="card__label">${label}</span>
			<span class="card__value">${value}</span>
		</div>
	`;
}

function renderShell(): void {
	const root = getRoot();
	const title = activeSessionId ? "Active session loaded" : "Fresh desktop session";

	render(
		html`
			<div class="shell">
				<header class="shell__header">
					<div class="shell__brand">
						<p class="shell__eyebrow">Electron feasibility build</p>
						<div class="shell__title-row">
							<h1 class="shell__title">WEPS Desktop</h1>
							<span class="shell__badge">${title}</span>
						</div>
						<p class="shell__subtitle">
							Renderer is powered by <code>@mariozechner/pi-web-ui</code>; native bridge is exposed through preload.
						</p>
					</div>
					<div class="shell__actions">
						<button
							class="shell__action"
							@click=${() => {
								void createFreshSession();
							}}
						>
							New Session
						</button>
						<button
							class="shell__action"
							@click=${() => {
								SessionListDialog.open(
									async (sessionId: string) => {
										await loadSession(sessionId);
									},
									(deletedId: string) => {
										if (deletedId === activeSessionId) {
											void createFreshSession();
										}
									},
								);
							}}
						>
							Sessions
						</button>
						<button
							class="shell__action"
							@click=${() => {
								void pickWorkspaceDirectory();
							}}
						>
							Workspace
						</button>
						<button
							class="shell__action"
							@click=${() => {
								SettingsDialog.open([new ApiKeysTab(), new ProvidersModelsTab(), new ProxyTab()]);
							}}
						>
							Settings
						</button>
						<theme-toggle></theme-toggle>
					</div>
				</header>

				<div class="shell__body">
					<section class="chat-stage">${chatPanel}</section>

					<aside class="shell__side">
						<section class="card">
							<h2 class="card__title">Workspace</h2>
							<div class="card__body">
								<p class="card__text">
									The desktop shell already owns workspace selection through the native dialog. This is the first bridge
									point we need before sharing runtime/session services with <code>wepscli</code>.
								</p>
								<div class="card__code">${activeWorkspacePath || "No workspace selected yet."}</div>
							</div>
						</section>

						<section class="card">
							<h2 class="card__title">Desktop Context</h2>
							<div class="card__body">
								${renderKeyValue("App", desktopContext?.appName ?? "WEPS Desktop")}
								${renderKeyValue("Version", desktopContext?.appVersion ?? "0.1.0")}
								${renderKeyValue("Platform", desktopContext?.platform ?? "unknown")}
								${renderKeyValue("Electron", desktopContext?.versions.electron ?? "unknown")}
								${renderKeyValue("Chrome", desktopContext?.versions.chrome ?? "unknown")}
								${renderKeyValue("Node", desktopContext?.versions.node ?? "unknown")}
							</div>
						</section>

						<section class="card">
							<h2 class="card__title">Interop Next</h2>
							<div class="card__body">
								<ul class="card__list">
									<li>Extract provider profile services out of <code>packages/wepscli</code>.</li>
									<li>Extract session metadata and runtime binding services into a shared WEPS core layer.</li>
									<li>Keep Electron-specific logic confined to <code>main</code> and <code>preload</code>.</li>
								</ul>
								<a
									class="card__link"
									href="https://github.com/electron/electron"
									@click=${async (event: MouseEvent) => {
										event.preventDefault();
										await window.wepsDesktop.openExternal("https://github.com/electron/electron");
									}}
								>
									Open Electron project page
								</a>
							</div>
						</section>

						<section class="card">
							<h2 class="card__title">Native Data Path</h2>
							<div class="card__body">
								<div class="card__code">${desktopContext?.userDataPath ?? "Unavailable"}</div>
							</div>
						</section>
					</aside>
				</div>
			</div>
		`,
		root,
	);
}

async function bootstrap(): Promise<void> {
	desktopContext = await window.wepsDesktop.getAppContext();
	await ensureWorkspacePath();
	await createFreshSession();
}

void bootstrap();
