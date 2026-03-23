import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import { html, render, type TemplateResult } from "lit";
import "./app.css";
import type {
	CreateDesktopProviderProfileInput,
	DesktopProviderFamily,
	DesktopSessionSnapshot,
	DesktopSnapshot,
	DesktopToolApprovalDecision,
} from "../src/shared/bridge.js";

type ProviderDraft = CreateDesktopProviderProfileInput;

let snapshot: DesktopSnapshot | null = null;
let unsubscribeSnapshot: (() => void) | undefined;
let composerValue = "";
let statusMessage = "";
let isBusy = false;

let providerDraft: ProviderDraft = {
	label: "",
	family: "openai",
	baseUrl: "",
	apiKey: "",
};

function getRoot(): HTMLElement {
	const root = document.getElementById("app");
	if (!root) {
		throw new Error("App root not found");
	}
	return root;
}

function truncate(value: string, maxLength: number): string {
	const normalized = value.trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}
	return `${normalized.slice(0, maxLength - 1)}…`;
}

function setStatus(message: string): void {
	statusMessage = message;
	renderApp();
}

function activeSession(): DesktopSessionSnapshot | undefined {
	return snapshot?.activeSession;
}

function activeProfile() {
	const currentSnapshot = snapshot;
	if (!currentSnapshot?.activeSelection.profileId) {
		return undefined;
	}
	return currentSnapshot.providerProfiles.find(
		(profile) => profile.id === currentSnapshot.activeSelection.profileId,
	);
}

function renderKeyValue(label: string, value: string): TemplateResult {
	return html`
		<div class="card__kv">
			<span class="card__label">${label}</span>
			<span class="card__value">${value}</span>
		</div>
	`;
}

async function runTask(task: () => Promise<void>): Promise<void> {
	if (isBusy) {
		return;
	}

	isBusy = true;
	renderApp();
	try {
		await task();
	} catch (error) {
		setStatus(error instanceof Error ? error.message : String(error));
	} finally {
		isBusy = false;
		renderApp();
	}
}

async function activateWorkspace(workspacePath: string): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.activateWorkspace(workspacePath);
		setStatus(`Workspace ready: ${workspacePath}`);
	});
}

async function chooseWorkspace(): Promise<void> {
	await runTask(async () => {
		const workspacePath = await window.wepsDesktop.chooseWorkspaceDirectory();
		if (!workspacePath) {
			return;
		}
		snapshot = await window.wepsDesktop.activateWorkspace(workspacePath);
		setStatus(`Workspace selected: ${workspacePath}`);
	});
}

async function openSession(sessionId: string): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.openSession(sessionId);
		setStatus("Session loaded.");
	});
}

async function createSession(): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.createSession();
		setStatus("Created a new desktop session.");
	});
}

async function sendPrompt(): Promise<void> {
	const normalized = composerValue.trim();
	if (!normalized) {
		return;
	}

	await runTask(async () => {
		let currentSession = activeSession();
		if (!currentSession) {
			snapshot = await window.wepsDesktop.createSession();
			currentSession = activeSession();
		}

		if (!currentSession) {
			throw new Error("No session is available.");
		}

		const text = normalized;
		composerValue = "";
		renderApp();
		await window.wepsDesktop.sendPrompt(currentSession.record.id, text);
	});
}

async function abortSession(): Promise<void> {
	const currentSession = activeSession();
	if (!currentSession) {
		return;
	}

	await runTask(async () => {
		snapshot = await window.wepsDesktop.abortSession(currentSession.record.id);
		setStatus("Runtime aborted.");
	});
}

async function resolveApproval(decision: DesktopToolApprovalDecision): Promise<void> {
	const request = activeSession()?.pendingApproval;
	if (!request) {
		return;
	}

	await runTask(async () => {
		snapshot = await window.wepsDesktop.resolveApproval(request.id, decision);
		setStatus(`Approval decision recorded: ${decision}.`);
	});
}

async function setProfileSelection(profileId: string): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.setActiveSelection(profileId);
		const profile = snapshot.providerProfiles.find((entry) => entry.id === profileId);
		setStatus(profile ? `Active provider: ${profile.label}` : "Provider selection updated.");
	});
}

async function setModelSelection(modelId: string): Promise<void> {
	const profileId = snapshot?.activeSelection.profileId;
	if (!profileId) {
		return;
	}

	await runTask(async () => {
		snapshot = await window.wepsDesktop.setActiveSelection(profileId, modelId);
		setStatus(`Active model: ${modelId}`);
	});
}

async function refreshActiveProfile(): Promise<void> {
	const profileId = snapshot?.activeSelection.profileId;
	if (!profileId) {
		return;
	}

	await runTask(async () => {
		snapshot = await window.wepsDesktop.refreshProviderModels(profileId);
		setStatus("Provider models refreshed.");
	});
}

async function createProviderProfile(): Promise<void> {
	if (!providerDraft.label.trim() || !providerDraft.baseUrl.trim() || !providerDraft.apiKey.trim()) {
		setStatus("Provider label, base URL, and API key are required.");
		return;
	}

	await runTask(async () => {
		snapshot = await window.wepsDesktop.createProviderProfile({
			...providerDraft,
			label: providerDraft.label.trim(),
			baseUrl: providerDraft.baseUrl.trim(),
			apiKey: providerDraft.apiKey.trim(),
		});
		providerDraft = {
			label: "",
			family: providerDraft.family,
			baseUrl: "",
			apiKey: "",
		};
		setStatus("Provider profile created and synced to shared WEPS storage.");
	});
}

function renderWorkspaceLauncher(): TemplateResult {
	return html`
		<div class="startup">
			<section class="startup__panel">
				<p class="startup__eyebrow">WEPS Desktop</p>
				<h1 class="startup__title">Choose a workspace first</h1>
				<p class="startup__text">
					The desktop app now starts from a real project context. Provider profiles and session metadata are shared
					with the WEPS agent directory, but runtime state is anchored to the selected workspace.
				</p>
				<div class="startup__actions">
					<button class="shell__action" ?disabled=${isBusy} @click=${() => void chooseWorkspace()}>
						Open Workspace
					</button>
				</div>
				${
					snapshot && snapshot.recentWorkspaces.length > 0
						? html`
								<div class="startup__recent">
									<h2 class="card__title">Recent Workspaces</h2>
									${snapshot.recentWorkspaces.map(
										(workspacePath) => html`
											<button
												class="startup__workspace"
												?disabled=${isBusy}
												@click=${() => {
													void activateWorkspace(workspacePath);
												}}
											>
												<span class="startup__workspace-name">${truncate(workspacePath, 72)}</span>
											</button>
										`,
									)}
								</div>
							`
						: html``
				}
			</section>
		</div>
	`;
}

function renderSessionsCard(): TemplateResult {
	return html`
		<section class="card">
			<div class="card__header-row">
				<h2 class="card__title">Workspace Sessions</h2>
				<button class="card__button" ?disabled=${isBusy} @click=${() => void createSession()}>New</button>
			</div>
			<div class="card__body">
				${
					snapshot && snapshot.sessions.length > 0
						? snapshot.sessions.map(
								(session) => html`
									<button
										class="session-row ${activeSession()?.record.id === session.id ? "session-row--active" : ""}"
										?disabled=${isBusy}
										@click=${() => {
											void openSession(session.id);
										}}
									>
										<span class="session-row__title">${truncate(session.title, 42)}</span>
										<span class="session-row__summary">${truncate(session.summary || "No summary yet.", 84)}</span>
									</button>
								`,
							)
						: html`<p class="card__text">No sessions exist for the selected workspace yet.</p>`
				}
			</div>
		</section>
	`;
}

function renderProviderCard(): TemplateResult {
	const profile = activeProfile();
	return html`
		<section class="card">
			<div class="card__header-row">
				<h2 class="card__title">Provider Profiles</h2>
				<button class="card__button" ?disabled=${isBusy || !profile} @click=${() => void refreshActiveProfile()}>
					Refresh
				</button>
			</div>
			<div class="card__body">
				${
					snapshot && snapshot.providerProfiles.length > 0
						? html`
								<label class="form__label">
									<span>Active provider</span>
									<select
										class="form__input"
										?disabled=${isBusy}
										@change=${(event: Event) => {
											const target = event.target as HTMLSelectElement;
											void setProfileSelection(target.value);
										}}
									>
										${snapshot.providerProfiles.map(
											(entry) => html`
												<option
													value=${entry.id}
													?selected=${snapshot?.activeSelection.profileId === entry.id}
												>
													${entry.label}
												</option>
											`,
										)}
									</select>
								</label>
								<label class="form__label">
									<span>Active model</span>
									<select
										class="form__input"
										?disabled=${isBusy || !profile || profile.models.length === 0}
										@change=${(event: Event) => {
											const target = event.target as HTMLSelectElement;
											void setModelSelection(target.value);
										}}
									>
										${profile?.models.map(
											(model) => html`
												<option
													value=${model.id}
													?selected=${snapshot?.activeSelection.modelId === model.id}
												>
													${model.name}
												</option>
											`,
										)}
									</select>
								</label>
								<div class="card__divider"></div>
							`
						: html`<p class="card__text">No shared provider profiles exist yet. Create one below.</p>`
				}
				<div class="form">
					<label class="form__label">
						<span>Label</span>
						<input
							class="form__input"
							.value=${providerDraft.label}
							@input=${(event: Event) => {
								providerDraft = {
									...providerDraft,
									label: (event.target as HTMLInputElement).value,
								};
							}}
						/>
					</label>
					<label class="form__label">
						<span>Family</span>
						<select
							class="form__input"
							@change=${(event: Event) => {
								providerDraft = {
									...providerDraft,
									family: (event.target as HTMLSelectElement).value as DesktopProviderFamily,
								};
							}}
						>
							<option value="openai" ?selected=${providerDraft.family === "openai"}>OpenAI Compatible</option>
							<option value="anthropic" ?selected=${providerDraft.family === "anthropic"}>Anthropic Compatible</option>
						</select>
					</label>
					<label class="form__label">
						<span>Base URL</span>
						<input
							class="form__input"
							.value=${providerDraft.baseUrl}
							@input=${(event: Event) => {
								providerDraft = {
									...providerDraft,
									baseUrl: (event.target as HTMLInputElement).value,
								};
							}}
						/>
					</label>
					<label class="form__label">
						<span>API Key</span>
						<input
							class="form__input"
							type="password"
							.value=${providerDraft.apiKey}
							@input=${(event: Event) => {
								providerDraft = {
									...providerDraft,
									apiKey: (event.target as HTMLInputElement).value,
								};
							}}
						/>
					</label>
					<button class="card__button card__button--wide" ?disabled=${isBusy} @click=${() => void createProviderProfile()}>
						Create Provider
					</button>
				</div>
			</div>
		</section>
	`;
}

function renderContextCard(): TemplateResult {
	return html`
		<section class="card">
			<h2 class="card__title">Project Context</h2>
			<div class="card__body">
				<div class="card__code">${snapshot?.currentWorkspacePath ?? "No workspace selected"}</div>
				${renderKeyValue("Agent Dir", snapshot?.agentDir ?? "Unavailable")}
				${renderKeyValue("App", snapshot?.appContext.appName ?? "WEPS Desktop")}
				${renderKeyValue("Version", snapshot?.appContext.appVersion ?? "0.1.0")}
			</div>
		</section>
	`;
}

function renderTranscript(): TemplateResult {
	const session = activeSession();
	if (!session) {
		return html`
			<div class="chat-stage__empty">
				<h2>Open or create a session</h2>
				<p>
					The renderer is now driven by shared session metadata and a main-process runtime binding instead of local
					IndexedDB chat state.
				</p>
			</div>
		`;
	}

	return html`
		<div class="transcript">
			${session.messages.length === 0
				? html`
						<div class="chat-stage__empty chat-stage__empty--compact">
							<h2>No messages yet</h2>
							<p>Start with a prompt. The runtime session file will be bound on first load/send.</p>
						</div>
					`
				: session.messages.map(
						(message) => html`
							<article class="message message--${message.role} message--${message.kind ?? "default"}">
								<header class="message__header">
									<span class="message__role">${message.role}</span>
									<span class="message__time">${message.time}</span>
								</header>
								<pre class="message__content">${message.content}</pre>
							</article>
						`,
					)}
		</div>
	`;
}

function renderApprovalBanner(): TemplateResult {
	const request = activeSession()?.pendingApproval;
	if (!request) {
		return html``;
	}

	return html`
		<section class="approval-card">
			<div class="approval-card__header">
				<div>
					<p class="approval-card__eyebrow">${request.riskLabel}</p>
					<h2 class="approval-card__title">${request.toolName}</h2>
				</div>
				<span class="approval-card__summary">${truncate(request.summary, 80)}</span>
			</div>
			<p class="approval-card__text">${request.reason}</p>
			<pre class="approval-card__content">${request.argsText}</pre>
			<div class="approval-card__actions">
				<button class="shell__action" ?disabled=${isBusy} @click=${() => void resolveApproval("allow")}>
					Allow
				</button>
				<button class="shell__action shell__action--danger" ?disabled=${isBusy} @click=${() => void resolveApproval("reject")}>
					Reject
				</button>
				<button class="shell__action shell__action--ghost" ?disabled=${isBusy} @click=${() => void resolveApproval("cancel")}>
					Cancel
				</button>
			</div>
		</section>
	`;
}

function renderComposer(): TemplateResult {
	const session = activeSession();
	const runtimeState = session?.runtimeState;
	return html`
		<div class="composer">
			<div class="composer__status">
				<span class="shell__badge">${runtimeState?.label ?? "No active runtime"}</span>
				${runtimeState?.detail ? html`<span class="composer__detail">${runtimeState.detail}</span>` : html``}
			</div>
			<textarea
				class="composer__input"
				placeholder="Ask about the current workspace"
				.value=${composerValue}
				@input=${(event: Event) => {
					composerValue = (event.target as HTMLTextAreaElement).value;
				}}
			></textarea>
			<div class="composer__actions">
				<button class="shell__action" ?disabled=${isBusy} @click=${() => void sendPrompt()}>
					Send
				</button>
				<button
					class="shell__action shell__action--ghost"
					?disabled=${isBusy || !runtimeState?.interruptible}
					@click=${() => void abortSession()}
				>
					Abort
				</button>
			</div>
		</div>
	`;
}

function renderWorkspaceShell(): TemplateResult {
	return html`
		<div class="shell">
			<header class="shell__header">
				<div class="shell__brand">
					<p class="shell__eyebrow">Electron runtime binding prototype</p>
					<div class="shell__title-row">
						<h1 class="shell__title">WEPS Desktop</h1>
						<span class="shell__badge">${snapshot?.activeSession ? "Runtime bound" : "Workspace ready"}</span>
					</div>
					<p class="shell__subtitle">
						Session metadata and provider profiles now come from shared WEPS services. Runtime state is bound to the
						selected project directory.
					</p>
				</div>
				<div class="shell__actions">
					<button class="shell__action" ?disabled=${isBusy} @click=${() => void chooseWorkspace()}>
						Change Workspace
					</button>
					<button class="shell__action" ?disabled=${isBusy} @click=${() => void createSession()}>
						New Session
					</button>
					<theme-toggle></theme-toggle>
				</div>
			</header>

			<div class="shell__body">
				<section class="chat-stage">
					${renderApprovalBanner()}
					${renderTranscript()}
					${renderComposer()}
				</section>

				<aside class="shell__side">
					${renderContextCard()} ${renderSessionsCard()} ${renderProviderCard()}
				</aside>
			</div>
		</div>
	`;
}

function renderApp(): void {
	const root = getRoot();
	render(
		html`
			${
				!snapshot
					? html`
							<div class="startup">
								<section class="startup__panel">
									<p class="startup__eyebrow">WEPS Desktop</p>
									<h1 class="startup__title">Loading desktop runtime</h1>
								</section>
							</div>
						`
					: !snapshot.currentWorkspacePath
						? renderWorkspaceLauncher()
						: renderWorkspaceShell()
			}
			${statusMessage ? html`<div class="toast">${statusMessage}</div>` : html``}
		`,
		root,
	);
}

async function bootstrap(): Promise<void> {
	snapshot = await window.wepsDesktop.getSnapshot();
	unsubscribeSnapshot = window.wepsDesktop.onSnapshot((nextSnapshot) => {
		snapshot = nextSnapshot;
		renderApp();
	});
	renderApp();
}

void bootstrap();

window.addEventListener("beforeunload", () => {
	unsubscribeSnapshot?.();
});
