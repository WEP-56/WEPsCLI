import { html, render, type TemplateResult } from "lit";
import "./app.css";
import type {
	CreateDesktopProviderProfileInput,
	DesktopChatMessage,
	DesktopProviderFamily,
	DesktopProviderProfile,
	DesktopRuntimeState,
	DesktopSessionRecord,
	DesktopSessionSnapshot,
	DesktopSnapshot,
	DesktopToolApprovalDecision,
	DesktopWindowState,
} from "../src/shared/bridge.js";

type ProviderDraft = CreateDesktopProviderProfileInput;

let snapshot: DesktopSnapshot | null = null;
let unsubscribeSnapshot: (() => void) | undefined;
let unsubscribeWindowState: (() => void) | undefined;
let composerValue = "";
let statusMessage = "";
let statusTimer: number | undefined;
let isBusy = false;
let sidebarOpen = true;
let detailsOpen = false;
let windowState: DesktopWindowState = {
	isFullScreen: false,
	isMaximized: false,
};

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
	if (maxLength <= 3) {
		return normalized.slice(0, maxLength);
	}
	return `${normalized.slice(0, maxLength - 3)}...`;
}

function basenamePath(value?: string): string {
	if (!value) {
		return "No workspace";
	}
	const parts = value.split(/[\\/]/).filter(Boolean);
	return parts[parts.length - 1] ?? value;
}

function formatTimestamp(value?: string): string {
	if (!value) {
		return "Now";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return date.toLocaleString("zh-CN", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatRelativeTime(value?: string): string {
	if (!value) {
		return "刚刚";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	const deltaMs = Date.now() - date.getTime();
	const deltaMinutes = Math.max(1, Math.floor(deltaMs / 60_000));
	if (deltaMinutes < 60) {
		return `${deltaMinutes} 分钟前`;
	}

	const deltaHours = Math.floor(deltaMinutes / 60);
	if (deltaHours < 24) {
		return `${deltaHours} 小时前`;
	}

	const deltaDays = Math.floor(deltaHours / 24);
	if (deltaDays < 7) {
		return `${deltaDays} 天前`;
	}

	return formatTimestamp(value);
}

function setStatus(message: string): void {
	statusMessage = message;
	if (statusTimer) {
		window.clearTimeout(statusTimer);
	}
	statusTimer = window.setTimeout(() => {
		statusMessage = "";
		renderApp();
	}, 3600);
	renderApp();
}

function requestRender(): void {
	renderApp();
}

function activeSession(): DesktopSessionSnapshot | undefined {
	return snapshot?.activeSession;
}

function activeSessionRecord(): DesktopSessionRecord | undefined {
	return activeSession()?.record;
}

function activeRuntimeState(): DesktopRuntimeState | undefined {
	return activeSession()?.runtimeState;
}

function activeProfile(): DesktopProviderProfile | undefined {
	const currentSnapshot = snapshot;
	if (!currentSnapshot?.activeSelection.profileId) {
		return undefined;
	}
	return currentSnapshot.providerProfiles.find(
		(profile) => profile.id === currentSnapshot.activeSelection.profileId,
	);
}

function activeModelName(): string | undefined {
	const profile = activeProfile();
	const modelId = snapshot?.activeSelection.modelId;
	return profile?.models.find((model) => model.id === modelId)?.name ?? modelId;
}

function runtimeTone(phase?: DesktopRuntimeState["phase"]): string {
	switch (phase) {
		case "running":
		case "retrying":
		case "compacting":
			return "is-busy";
		case "error":
			return "is-danger";
		case "interrupted":
			return "is-warning";
		default:
			return "is-ready";
	}
}

function sessionStateLabel(session?: DesktopSessionRecord): string {
	switch (session?.state) {
		case "active":
			return "当前";
		case "ready":
			return "就绪";
		case "recent":
			return "最近";
		default:
			return "会话";
	}
}

function providerValidationLabel(profile: DesktopProviderProfile): string {
	switch (profile.lastValidationStatus) {
		case "ok":
			return "已验证";
		case "error":
			return "异常";
		default:
			return "未校验";
	}
}

function providerValidationTone(profile: DesktopProviderProfile): string {
	switch (profile.lastValidationStatus) {
		case "ok":
			return "is-ready";
		case "error":
			return "is-danger";
		default:
			return "is-muted";
	}
}

function messageKindLabel(message: DesktopChatMessage): string {
	switch (message.kind) {
		case "reasoning":
			return "思考";
		case "tool":
			return "工具";
		case "status":
			return "状态";
		default:
			return message.role === "user" ? "你" : message.role === "assistant" ? "WEPS" : "系统";
	}
}

function openDetails(): void {
	detailsOpen = true;
	requestRender();
}

function closeDetails(): void {
	detailsOpen = false;
	requestRender();
}

function toggleSidebar(): void {
	sidebarOpen = !sidebarOpen;
	requestRender();
}

async function minimizeWindow(): Promise<void> {
	await window.wepsDesktop.minimizeWindow();
}

async function toggleMaximizeWindow(): Promise<void> {
	windowState = await window.wepsDesktop.toggleMaximizeWindow();
	requestRender();
}

async function closeWindow(): Promise<void> {
	await window.wepsDesktop.closeWindow();
}

async function runTask(task: () => Promise<void>): Promise<void> {
	if (isBusy) {
		return;
	}

	isBusy = true;
	requestRender();
	try {
		await task();
	} catch (error) {
		setStatus(error instanceof Error ? error.message : String(error));
	} finally {
		isBusy = false;
		requestRender();
	}
}

async function activateWorkspace(workspacePath: string): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.activateWorkspace(workspacePath);
		detailsOpen = false;
		setStatus(`已切换到工作区：${basenamePath(workspacePath)}`);
	});
}

async function chooseWorkspace(): Promise<void> {
	await runTask(async () => {
		const workspacePath = await window.wepsDesktop.chooseWorkspaceDirectory();
		if (!workspacePath) {
			return;
		}
		snapshot = await window.wepsDesktop.activateWorkspace(workspacePath);
		detailsOpen = false;
		setStatus(`已选择工作区：${basenamePath(workspacePath)}`);
	});
}

async function openSession(sessionId: string): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.openSession(sessionId);
		setStatus("会话已打开。");
	});
}

async function createSession(): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.createSession();
		setStatus("已创建新会话。");
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
			throw new Error("当前没有可用会话。");
		}

		const text = normalized;
		composerValue = "";
		requestRender();
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
		setStatus("已中断当前运行。");
	});
}

async function resolveApproval(decision: DesktopToolApprovalDecision): Promise<void> {
	const request = activeSession()?.pendingApproval;
	if (!request) {
		return;
	}

	await runTask(async () => {
		snapshot = await window.wepsDesktop.resolveApproval(request.id, decision);
		setStatus(`已记录审批结果：${decision}`);
	});
}

async function setProfileSelection(profileId: string): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.setActiveSelection(profileId);
		const profile = snapshot.providerProfiles.find((entry) => entry.id === profileId);
		setStatus(profile ? `当前 Provider：${profile.label}` : "已更新 Provider 选择。");
	});
}

async function setModelSelection(modelId: string): Promise<void> {
	const profileId = snapshot?.activeSelection.profileId;
	if (!profileId) {
		return;
	}

	await runTask(async () => {
		snapshot = await window.wepsDesktop.setActiveSelection(profileId, modelId);
		setStatus(`当前模型：${modelId}`);
	});
}

async function refreshActiveProfile(): Promise<void> {
	const profileId = snapshot?.activeSelection.profileId;
	if (!profileId) {
		return;
	}

	await runTask(async () => {
		snapshot = await window.wepsDesktop.refreshProviderModels(profileId);
		setStatus("已刷新当前 Provider 的模型列表。");
	});
}

async function createProviderProfile(): Promise<void> {
	if (!providerDraft.label.trim() || !providerDraft.baseUrl.trim() || !providerDraft.apiKey.trim()) {
		setStatus("请填写 Provider 名称、Base URL 和 API Key。");
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
		setStatus("已创建 Provider，并同步到 CLI 共享数据目录。");
	});
}

function renderWorkspaceLauncher(): TemplateResult {
	const frameClass = windowState.isMaximized ? "app-frame app-frame--maximized" : "app-frame";
	return html`
		<div class=${frameClass}>
			<div class="launcher">
				<div class="launcher__windowbar">
					<div class="launcher__windowbar-title">WEPS Desktop</div>
					${renderWindowControls()}
				</div>
				<div class="launcher__halo launcher__halo--left"></div>
				<div class="launcher__halo launcher__halo--right"></div>
				<section class="launcher__panel">
					<div class="launcher__copy">
						<p class="launcher__eyebrow">WEPS Desktop</p>
						<h1 class="launcher__title">从工作区进入，再把 CLI 数据继续用起来。</h1>
						<p class="launcher__text">
							桌面端保持和 wepscli 的 Provider、会话元数据互通，只把界面整理成更适合日常使用的桌面工作台。
						</p>
						<div class="launcher__chips">
							<span class="pill is-ready">共享 Provider</span>
							<span class="pill is-ready">共享 Sessions</span>
							<span class="pill is-muted">Electron Desktop</span>
						</div>
						<div class="launcher__actions">
							<button class="button button--primary" ?disabled=${isBusy} @click=${() => void chooseWorkspace()}>
								打开工作区
							</button>
						</div>
					</div>

					<div class="launcher__rail">
						<section class="panel-card">
							<div class="section-head">
								<h2>最近使用</h2>
								<span>${snapshot?.recentWorkspaces.length ?? 0}</span>
							</div>
							${
								snapshot && snapshot.recentWorkspaces.length > 0
									? html`
											<div class="launcher__recent-list">
												${snapshot.recentWorkspaces.map(
													(workspacePath) => html`
														<button
															class="recent-workspace"
															?disabled=${isBusy}
															@click=${() => {
																void activateWorkspace(workspacePath);
															}}
														>
															<span class="recent-workspace__title">${basenamePath(workspacePath)}</span>
															<span class="recent-workspace__path">${truncate(workspacePath, 84)}</span>
														</button>
													`,
												)}
											</div>
										`
									: html`<p class="panel-card__empty">还没有工作区记录。选择一个项目目录后，这里会出现快捷入口。</p>`
							}
						</section>
					</div>
				</section>
			</div>
		</div>
	`;
}

function renderWindowControls(): TemplateResult {
	return html`
		<div class="window-controls">
			<button class="window-control" @click=${() => void minimizeWindow()} aria-label="最小化"><span></span></button>
			<button class="window-control" @click=${() => void toggleMaximizeWindow()} aria-label="最大化或还原">
				${windowState.isMaximized
					? html`<span class="window-control__restore"></span>`
					: html`<span class="window-control__maximize"></span>`}
			</button>
			<button class="window-control window-control--close" @click=${() => void closeWindow()} aria-label="关闭">
				<span class="window-control__close"></span>
			</button>
		</div>
	`;
}

function renderSidebar(): TemplateResult {
	const currentWorkspacePath = snapshot?.currentWorkspacePath;
	return html`
		<aside class="shell-sidebar">
			<div class="shell-sidebar__top">
				<div class="brand-lockup">
					<p class="brand-lockup__eyebrow">WEPS Desktop</p>
					<h2 class="brand-lockup__title">${basenamePath(currentWorkspacePath)}</h2>
					<p class="brand-lockup__text">延续 CLI 数据层，改成更安静的桌面工作台。</p>
				</div>

				<div class="workspace-summary__path">${currentWorkspacePath ?? "尚未选择工作区"}</div>

				<div class="sidebar-actions">
					<button class="button button--primary" ?disabled=${isBusy} @click=${() => void createSession()}>
						新建会话
					</button>
					<button class="button button--subtle" ?disabled=${isBusy} @click=${() => openDetails()}>
						设置
					</button>
				</div>
			</div>

			<div class="sidebar-section">
				<div class="section-head">
					<h3>会话</h3>
					<span>${snapshot?.sessions.length ?? 0}</span>
				</div>

				<div class="session-list">
					${
						snapshot && snapshot.sessions.length > 0
							? snapshot.sessions.map((session) => renderSessionRow(session))
							: html`<p class="panel-card__empty">当前工作区还没有会话，点击上方按钮即可开始。</p>`
					}
				</div>
			</div>
		</aside>
	`;
}

function renderSessionRow(session: DesktopSessionRecord): TemplateResult {
	const isActive = activeSessionRecord()?.id === session.id;
	return html`
		<button
			class="session-row ${isActive ? "session-row--active" : ""}"
			?disabled=${isBusy}
			@click=${() => {
				void openSession(session.id);
			}}
		>
			<div class="session-row__topline">
				<span class="session-row__title">${truncate(session.title || "未命名会话", 38)}</span>
				<span class="session-row__state">${sessionStateLabel(session)}</span>
			</div>
			<div class="session-row__summary">${truncate(session.summary || "等待新任务。", 92)}</div>
			<div class="session-row__meta">
				<span>${session.providerLabel ?? "未选 Provider"}</span>
				<span>${formatRelativeTime(session.updatedAt)}</span>
			</div>
		</button>
	`;
}

function renderConversationHeader(): TemplateResult {
	const session = activeSessionRecord();
	const runtimeState = activeRuntimeState();
	const profile = activeProfile();
	const modelName = activeModelName();

	return html`
		<header class="conversation-header conversation-header--hero">
			<div class="conversation-header__copy">
				<p class="conversation-header__eyebrow">${session ? "当前会话" : "工作区已就绪"}</p>
				<h1 class="conversation-header__title">
					${session ? truncate(session.title, 68) : "开始一个新的桌面会话"}
				</h1>
				<p class="conversation-header__text">
					${session
						? session.summary || "继续这个会话，数据会同步回共享的 CLI 会话目录。"
						: "会话、Provider 和模型选择都沿用 CLI 共享数据；桌面端只负责把操作组织得更易用。"}
				</p>
				<div class="hero-meta">
					<span class="pill ${runtimeTone(runtimeState?.phase)}">${runtimeState?.label ?? "未启动"}</span>
					<span class="hero-meta__item">${profile?.label ?? "未配置 Provider"}</span>
					<span class="hero-meta__item">${modelName ?? "未选择模型"}</span>
				</div>
			</div>

			<div class="conversation-header__actions">
				<button class="button button--subtle" ?disabled=${isBusy} @click=${() => openDetails()}>
					查看设置
				</button>
			</div>
		</header>
	`;
}

function renderConversationEmptyState(): TemplateResult {
	const hasProfiles = (snapshot?.providerProfiles.length ?? 0) > 0;
	return html`
		<div class="conversation-empty">
			<h2>${hasProfiles ? "开始一个工作区对话" : "先配置一个 Provider"}</h2>
			<p>
				${hasProfiles
					? "点击“新建会话”或直接输入问题即可开始。桌面端会继续沿用 CLI 的共享 Provider 和 Session 元数据。"
					: "当前还没有可用 Provider。打开右侧设置面板添加一个 OpenAI Compatible 或 Anthropic Compatible Provider。"}
			</p>
			<div class="conversation-empty__actions">
				<button class="button button--primary" ?disabled=${isBusy} @click=${() => void createSession()}>
					新建会话
				</button>
				<button class="button button--subtle" ?disabled=${isBusy} @click=${() => openDetails()}>
					打开设置
				</button>
			</div>
		</div>
	`;
}

function renderTranscript(): TemplateResult {
	const session = activeSession();
	if (!session) {
		return renderConversationEmptyState();
	}

	return html`
		<div class="transcript">
			${session.messages.length === 0
				? html`
						<div class="conversation-empty conversation-empty--compact">
							<h2>会话已创建</h2>
							<p>输入一个任务开始。首次发送后，runtime 会自动绑定到当前工作区。</p>
						</div>
					`
				: session.messages.map((message) => renderMessage(message))}
		</div>
	`;
}

function renderMessage(message: DesktopChatMessage): TemplateResult {
	const label = messageKindLabel(message);
	return html`
		<article class="message-card message-card--${message.role} message-card--${message.kind ?? "default"}">
			<header class="message-card__header">
				<span class="message-card__label">${label}</span>
				<span class="message-card__time">${message.time}</span>
			</header>
			<pre class="message-card__content">${message.content}</pre>
		</article>
	`;
}

function renderApprovalBanner(): TemplateResult {
	const request = activeSession()?.pendingApproval;
	if (!request) {
		return html``;
	}

	return html`
		<section class="approval-banner">
			<div class="approval-banner__header">
				<div>
					<p class="approval-banner__eyebrow">${request.riskLabel}</p>
					<h2 class="approval-banner__title">${request.toolName}</h2>
				</div>
				<span class="approval-banner__summary">${truncate(request.summary, 80)}</span>
			</div>
			<p class="approval-banner__text">${request.reason}</p>
			<pre class="approval-banner__content">${request.argsText}</pre>
			<div class="approval-banner__actions">
				<button class="button button--primary" ?disabled=${isBusy} @click=${() => void resolveApproval("allow")}>
					允许
				</button>
				<button class="button button--danger" ?disabled=${isBusy} @click=${() => void resolveApproval("reject")}>
					拒绝
				</button>
				<button class="button button--subtle" ?disabled=${isBusy} @click=${() => void resolveApproval("cancel")}>
					取消
				</button>
			</div>
		</section>
	`;
}

function renderComposer(): TemplateResult {
	const runtimeState = activeRuntimeState();
	const profile = activeProfile();
	const canAbort = Boolean(runtimeState?.interruptible);
	return html`
		<div class="composer-panel">
			<div class="composer-panel__status">
				<span class="pill ${runtimeTone(runtimeState?.phase)}">${runtimeState?.label ?? "未启动 runtime"}</span>
				${runtimeState?.detail ? html`<span class="composer-panel__detail">${runtimeState.detail}</span>` : html``}
				${profile ? html`<span class="composer-panel__detail">Provider：${profile.label}</span>` : html``}
			</div>

			<textarea
				class="composer-panel__input"
				placeholder="描述你想在当前工作区里完成的事情。支持 Ctrl+Enter 快速发送。"
				.value=${composerValue}
				@input=${(event: Event) => {
					composerValue = (event.target as HTMLTextAreaElement).value;
				}}
				@keydown=${(event: KeyboardEvent) => {
					if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
						event.preventDefault();
						void sendPrompt();
					}
				}}
			></textarea>

			<div class="composer-panel__footer">
				<p class="composer-panel__hint">Provider 和 Session 会持续写回 CLI 的共享目录。</p>
				<div class="composer-panel__actions">
					<button class="button button--primary" ?disabled=${isBusy} @click=${() => void sendPrompt()}>
						发送
					</button>
					<button class="button button--subtle" ?disabled=${isBusy || !canAbort} @click=${() => void abortSession()}>
						中断
					</button>
				</div>
			</div>
		</div>
	`;
}

function renderMainArea(): TemplateResult {
	return html`
		<section class="conversation-shell">
			${renderConversationHeader()}
			<div class="main-stage">
				${renderApprovalBanner()} ${renderTranscript()} ${renderComposer()}
			</div>
		</section>
	`;
}

function renderContextCard(): TemplateResult {
	return html`
		<section class="panel-card">
			<div class="section-head">
				<h2>工作区上下文</h2>
				<span>${snapshot?.appContext.appVersion ?? "0.1.0"}</span>
			</div>
			<div class="field-block">
				<span class="field-block__label">当前工作区</span>
				<div class="field-code">${snapshot?.currentWorkspacePath ?? "未选择"}</div>
			</div>
			<div class="field-grid">
				<div class="field-grid__row">
					<span>Agent Dir</span>
					<span>${truncate(snapshot?.agentDir ?? "Unavailable", 34)}</span>
				</div>
				<div class="field-grid__row">
					<span>App</span>
					<span>${snapshot?.appContext.appName ?? "WEPS Desktop"}</span>
				</div>
				<div class="field-grid__row">
					<span>平台</span>
					<span>${snapshot?.appContext.platform ?? "unknown"}</span>
				</div>
			</div>
		</section>
	`;
}

function renderProviderCard(): TemplateResult {
	const profile = activeProfile();
	return html`
		<section class="panel-card">
			<div class="section-head">
				<h2>Provider 与模型</h2>
				<button class="button button--subtle button--small" ?disabled=${isBusy || !profile} @click=${() => void refreshActiveProfile()}>
					刷新模型
				</button>
			</div>

			<div class="form-grid">
				<label class="field-label">
					<span>当前 Provider</span>
					<select
						class="field-input"
						?disabled=${isBusy || (snapshot?.providerProfiles.length ?? 0) === 0}
						@change=${(event: Event) => {
							const target = event.target as HTMLSelectElement;
							void setProfileSelection(target.value);
						}}
					>
						${(snapshot?.providerProfiles ?? []).map(
							(entry) => html`
								<option value=${entry.id} ?selected=${snapshot?.activeSelection.profileId === entry.id}>
									${entry.label}
								</option>
							`,
						)}
					</select>
				</label>

				<label class="field-label">
					<span>当前模型</span>
					<select
						class="field-input"
						?disabled=${isBusy || !profile || profile.models.length === 0}
						@change=${(event: Event) => {
							const target = event.target as HTMLSelectElement;
							void setModelSelection(target.value);
						}}
					>
						${profile?.models.map(
							(model) => html`
								<option value=${model.id} ?selected=${snapshot?.activeSelection.modelId === model.id}>
									${model.name}
								</option>
							`,
						)}
					</select>
				</label>
			</div>

			<div class="provider-list">
				${(snapshot?.providerProfiles ?? []).length > 0
					? snapshot?.providerProfiles.map(
							(entry) => html`
								<button
									class="provider-chip ${snapshot?.activeSelection.profileId === entry.id ? "provider-chip--active" : ""}"
									?disabled=${isBusy}
									@click=${() => {
										void setProfileSelection(entry.id);
									}}
								>
									<div class="provider-chip__topline">
										<span>${entry.label}</span>
										<span class="pill pill--tiny ${providerValidationTone(entry)}">${providerValidationLabel(entry)}</span>
									</div>
									<div class="provider-chip__meta">
										<span>${entry.family}</span>
										<span>${entry.models.length} 个模型</span>
									</div>
								</button>
							`,
						)
					: html`<p class="panel-card__empty">还没有 Provider。下方创建后会自动写入 CLI 共享目录。</p>`}
			</div>
		</section>
	`;
}

function renderCreateProviderCard(): TemplateResult {
	return html`
		<section class="panel-card">
			<div class="section-head">
				<h2>新增 Provider</h2>
				<span>共享到 CLI</span>
			</div>

			<div class="form-grid">
				<label class="field-label">
					<span>名称</span>
					<input
						class="field-input"
						.value=${providerDraft.label}
						@input=${(event: Event) => {
							providerDraft = {
								...providerDraft,
								label: (event.target as HTMLInputElement).value,
							};
						}}
					/>
				</label>

				<label class="field-label">
					<span>Family</span>
					<select
						class="field-input"
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

				<label class="field-label field-label--full">
					<span>Base URL</span>
					<input
						class="field-input"
						.value=${providerDraft.baseUrl}
						@input=${(event: Event) => {
							providerDraft = {
								...providerDraft,
								baseUrl: (event.target as HTMLInputElement).value,
							};
						}}
					/>
				</label>

				<label class="field-label field-label--full">
					<span>API Key</span>
					<input
						class="field-input"
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
			</div>

			<div class="panel-card__actions">
				<button class="button button--primary" ?disabled=${isBusy} @click=${() => void createProviderProfile()}>
					创建 Provider
				</button>
			</div>
		</section>
	`;
}

function renderRecentWorkspacesCard(): TemplateResult {
	return html`
		<section class="panel-card">
			<div class="section-head">
				<h2>最近工作区</h2>
				<span>${snapshot?.recentWorkspaces.length ?? 0}</span>
			</div>
			<div class="compact-list">
				${(snapshot?.recentWorkspaces ?? []).length > 0
					? snapshot?.recentWorkspaces.map(
							(workspacePath) => html`
								<button
									class="compact-list__item"
									?disabled=${isBusy}
									@click=${() => {
										void activateWorkspace(workspacePath);
									}}
								>
									<span>${basenamePath(workspacePath)}</span>
									<small>${truncate(workspacePath, 60)}</small>
								</button>
							`,
						)
					: html`<p class="panel-card__empty">暂无最近工作区记录。</p>`}
			</div>
		</section>
	`;
}

function renderDetailsOverlay(): TemplateResult {
	const currentWorkspacePath = snapshot?.currentWorkspacePath;
	if (!detailsOpen || !currentWorkspacePath) {
		return html``;
	}

	return html`
		<div class="overlay" @click=${() => closeDetails()}>
			<section class="drawer" @click=${(event: Event) => event.stopPropagation()}>
				<header class="drawer__header">
					<div>
						<p class="drawer__eyebrow">Workspace Settings</p>
						<h2 class="drawer__title">${basenamePath(currentWorkspacePath)}</h2>
					</div>
					<button class="button button--subtle button--small" @click=${() => closeDetails()}>关闭</button>
				</header>

				<div class="drawer__grid">
					${renderContextCard()} ${renderProviderCard()} ${renderCreateProviderCard()} ${renderRecentWorkspacesCard()}
				</div>
			</section>
		</div>
	`;
}

function renderStatusBar(): TemplateResult {
	const runtimeState = activeRuntimeState();
	const profile = activeProfile();
	return html`
		<footer class="statusbar">
			<span class="statusbar__brand">WEPS Desktop</span>
			<span class="pill pill--tiny ${runtimeTone(runtimeState?.phase)}">${runtimeState?.label ?? "未启动"}</span>
			<span class="statusbar__item">${profile?.label ?? "未配置 Provider"}</span>
			<span class="statusbar__spacer"></span>
			<span class="statusbar__item">${activeModelName() ?? "未选择模型"}</span>
			<span class="statusbar__item">${snapshot?.sessions.length ?? 0} 个会话</span>
			<span class="statusbar__item">v${snapshot?.appContext.appVersion ?? "0.1.0"}</span>
		</footer>
	`;
}

function renderWorkspaceShell(): TemplateResult {
	const shellClass = sidebarOpen
		? "desktop-shell"
		: "desktop-shell desktop-shell--sidebar-hidden";
	const frameClass = windowState.isMaximized ? "app-frame app-frame--maximized" : "app-frame";
	const title = activeSessionRecord()?.title ?? basenamePath(snapshot?.currentWorkspacePath);
	return html`
		<div class=${frameClass}>
			<div class=${shellClass}>
				<header class="topbar">
					<div class="topbar__drag">
						<div class="topbar__left">
							<button class="icon-button" ?disabled=${isBusy} @click=${() => toggleSidebar()} aria-label="切换侧栏">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
									<path stroke-linecap="round" stroke-linejoin="round" d="M4 5.5h16M4 12h16M4 18.5h10" />
								</svg>
							</button>
							<span class="topbar__app">WEPS</span>
						</div>
						<div class="topbar__title">
							<span class="topbar__eyebrow">Shared with WEPS CLI</span>
							<strong>${truncate(title, 42)}</strong>
						</div>
					</div>

					<div class="topbar__actions">
						<button class="button button--subtle button--small" ?disabled=${isBusy} @click=${() => void chooseWorkspace()}>
							切换工作区
						</button>
						<button class="button button--subtle button--small" ?disabled=${isBusy} @click=${() => openDetails()}>
							设置
						</button>
						${renderWindowControls()}
					</div>
				</header>

				<div class="shell-body">
					${sidebarOpen ? renderSidebar() : html``}
					${renderMainArea()}
				</div>

				${renderStatusBar()} ${renderDetailsOverlay()}
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
							<div class=${windowState.isMaximized ? "app-frame app-frame--maximized" : "app-frame"}>
								<div class="launcher">
									<div class="launcher__windowbar">
										<div class="launcher__windowbar-title">WEPS Desktop</div>
										${renderWindowControls()}
									</div>
									<section class="launcher__panel launcher__panel--loading">
										<p class="launcher__eyebrow">WEPS Desktop</p>
										<h1 class="launcher__title">正在加载桌面工作台...</h1>
									</section>
								</div>
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
	windowState = await window.wepsDesktop.getWindowState();
	unsubscribeSnapshot = window.wepsDesktop.onSnapshot((nextSnapshot) => {
		snapshot = nextSnapshot;
		renderApp();
	});
	unsubscribeWindowState = window.wepsDesktop.onWindowState((nextState) => {
		windowState = nextState;
		renderApp();
	});
	renderApp();
}

void bootstrap();

window.addEventListener("beforeunload", () => {
	unsubscribeSnapshot?.();
	unsubscribeWindowState?.();
	if (statusTimer) {
		window.clearTimeout(statusTimer);
	}
});
