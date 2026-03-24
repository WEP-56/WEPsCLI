import DOMPurify from "dompurify";
import { html, render, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { Marked } from "marked";
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
type ComposerMenu = "model" | "provider";

type WorkspaceSummary = {
	path: string;
	name: string;
	isCurrent: boolean;
	sessionCount: number;
	lastUpdated?: string;
	lastTitle?: string;
	providerLabel?: string;
};

type CachedMessageContent = {
	content: string;
	version: number;
};

const markdownParser = new Marked({
	gfm: true,
	breaks: true,
});
const MARKDOWN_ALLOWED_TAGS = [
	"a",
	"blockquote",
	"br",
	"code",
	"del",
	"em",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"input",
	"li",
	"ol",
	"p",
	"pre",
	"strong",
	"table",
	"tbody",
	"td",
	"th",
	"thead",
	"tr",
	"ul",
] as const;
const MARKDOWN_ALLOWED_ATTR = ["checked", "class", "disabled", "href", "rel", "start", "target", "title", "type"] as const;

let snapshot: DesktopSnapshot | null = null;
let unsubscribeSnapshot: (() => void) | undefined;
let unsubscribeWindowState: (() => void) | undefined;
let composerValue = "";
let statusMessage = "";
let statusTimer: number | undefined;
let isBusy = false;
let sidebarOpen = true;
let detailsOpen = false;
let workspaceSwitcherOpen = false;
let composerMenuOpen: ComposerMenu | null = null;
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
const LONG_ASSISTANT_MESSAGE_MIN_LINES = 12;
const LONG_ASSISTANT_MESSAGE_MIN_CHARS = 720;
const RENDER_THROTTLE_MS = 48;

let messageExpansionOverrides = new Map<string, boolean>();
let messageContentCache = new Map<string, CachedMessageContent>();
let markdownRenderCache = new Map<string, string>();
let pendingMessageContentRequests = new Map<string, Promise<void>>();
let renderScheduled = false;
let renderTimer: number | undefined;
let lastRenderAt = 0;

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
		return "未选择工作区";
	}
	const parts = value.split(/[\\/]/).filter(Boolean);
	return parts[parts.length - 1] ?? value;
}

function formatTimestamp(value?: string): string {
	if (!value) {
		return "现在";
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
		requestRender();
	}, 3600);
	requestRender();
}

function flushRender(): void {
	renderScheduled = false;
	renderTimer = undefined;
	lastRenderAt = performance.now();
	renderApp();
}

function scheduleRender(): void {
	if (renderScheduled) {
		return;
	}

	renderScheduled = true;
	const delay = Math.max(0, RENDER_THROTTLE_MS - (performance.now() - lastRenderAt));
	const scheduleFrame = () => {
		window.requestAnimationFrame(() => {
			flushRender();
		});
	};

	if (delay === 0) {
		scheduleFrame();
		return;
	}

	renderTimer = window.setTimeout(scheduleFrame, delay);
}

function requestRender(): void {
	scheduleRender();
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

function workspaceSummaries(): WorkspaceSummary[] {
	const currentWorkspacePath = snapshot?.currentWorkspacePath;
	const paths = Array.from(
		new Set([currentWorkspacePath, ...(snapshot?.recentWorkspaces ?? [])].filter((value): value is string => Boolean(value))),
	);

	return paths.map((workspacePath) => {
		const sessions = (snapshot?.sessions ?? [])
			.filter((session) => session.workspacePath === workspacePath)
			.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
		const latestSession = sessions[0];

		return {
			path: workspacePath,
			name: basenamePath(workspacePath),
			isCurrent: workspacePath === currentWorkspacePath,
			sessionCount: sessions.length,
			lastUpdated: latestSession?.updatedAt,
			lastTitle: latestSession?.title,
			providerLabel: latestSession?.providerLabel,
		};
	});
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
			if (message.role === "user") {
				return "你";
			}
			if (message.role === "assistant") {
				return "WEPS";
			}
			return "系统";
	}
}

function messageAuthorLabel(message: DesktopChatMessage): string {
	if (message.kind === "reasoning") {
		return "WEPS · 思考";
	}
	if (message.kind === "tool") {
		return "工具输出";
	}
	if (message.kind === "status") {
		return "系统状态";
	}
	return message.role === "user" ? "你" : message.role === "assistant" ? "WEPS" : "系统";
}

function messageAvatarLabel(message: DesktopChatMessage): string {
	if (message.kind === "tool") {
		return "T";
	}
	if (message.kind === "status") {
		return "S";
	}
	return message.role === "user" ? "你" : "W";
}

function messageBubbleTone(message: DesktopChatMessage): string {
	if (message.kind === "reasoning") {
		return "message-bubble--reasoning";
	}
	if (message.kind === "tool") {
		return "message-bubble--tool";
	}
	if (message.kind === "status" || message.role === "system") {
		return "message-bubble--system";
	}
	if (message.role === "user") {
		return "message-bubble--user";
	}
	return "message-bubble--assistant";
}

function messageStateKey(sessionId: string, messageId: string): string {
	return `${sessionId}:${messageId}`;
}

function lineCount(value: string): number {
	return value.split(/\r?\n/).length;
}

function isLongAssistantMessage(message: DesktopChatMessage): boolean {
	if (message.role !== "assistant" || message.kind !== "default") {
		return false;
	}

	const normalized = message.content.trim();
	const totalLines = message.lineCount ?? lineCount(normalized);
	return (
		Boolean(message.contentTruncated) ||
		totalLines >= LONG_ASSISTANT_MESSAGE_MIN_LINES ||
		normalized.length >= LONG_ASSISTANT_MESSAGE_MIN_CHARS
	);
}

function isMessageCollapsible(message: DesktopChatMessage): boolean {
	return message.kind === "reasoning" || message.kind === "tool" || isLongAssistantMessage(message);
}

function defaultMessageExpanded(message: DesktopChatMessage): boolean {
	return !isMessageCollapsible(message);
}

function messageCacheKey(sessionId: string, messageId: string): string {
	return `${sessionId}:${messageId}`;
}

function hasDeferredMessageContent(message: DesktopChatMessage): boolean {
	return message.fullContentAvailable === true;
}

function getCachedMessageContent(sessionId: string, message: DesktopChatMessage): string | undefined {
	if (!hasDeferredMessageContent(message)) {
		return message.content;
	}

	const cached = messageContentCache.get(messageCacheKey(sessionId, message.id));
	if (!cached || cached.version !== message.contentVersion) {
		return undefined;
	}

	return cached.content;
}

function ensureMessageContent(sessionId: string, message: DesktopChatMessage): void {
	if (!hasDeferredMessageContent(message)) {
		return;
	}

	const cacheKey = messageCacheKey(sessionId, message.id);
	const cached = messageContentCache.get(cacheKey);
	if (cached && cached.version === message.contentVersion) {
		return;
	}

	if (pendingMessageContentRequests.has(cacheKey)) {
		return;
	}

	const request = window.wepsDesktop
		.getMessageContent(sessionId, message.id)
		.then((content) => {
			if (typeof content !== "string") {
				return;
			}
			messageContentCache.set(cacheKey, {
				content,
				version: message.contentVersion ?? 0,
			});
			requestRender();
		})
		.catch((error) => {
			setStatus(error instanceof Error ? error.message : String(error));
		})
		.finally(() => {
			pendingMessageContentRequests.delete(cacheKey);
		});

	pendingMessageContentRequests.set(cacheKey, request);
}

function isMessageExpanded(sessionId: string, message: DesktopChatMessage): boolean {
	if (!isMessageCollapsible(message)) {
		return true;
	}

	const override = messageExpansionOverrides.get(messageStateKey(sessionId, message.id));
	return override ?? defaultMessageExpanded(message);
}

function toggleMessageExpansion(sessionId: string, message: DesktopChatMessage): void {
	if (!isMessageCollapsible(message)) {
		return;
	}

	const nextExpanded = !isMessageExpanded(sessionId, message);
	const key = messageStateKey(sessionId, message.id);
	if (nextExpanded === defaultMessageExpanded(message)) {
		messageExpansionOverrides.delete(key);
	} else {
		messageExpansionOverrides.set(key, nextExpanded);
	}

	if (nextExpanded) {
		ensureMessageContent(sessionId, message);
	}

	requestRender();
}

function collapsedMessageTitle(message: DesktopChatMessage): string {
	if (message.kind === "reasoning") {
		return "思考";
	}
	if (message.kind === "tool") {
		return "工具输出";
	}
	return "长回复";
}

function previewMessageContent(message: DesktopChatMessage): { text: string; lineCount: number; truncated: boolean } {
	return {
		text: message.content.trim() || "无可显示内容。",
		lineCount: message.lineCount ?? lineCount(message.content),
		truncated: Boolean(message.contentTruncated),
	};
}

function shouldRenderMarkdown(message: DesktopChatMessage): boolean {
	return message.role === "assistant" && message.kind === "default";
}

function canCopyOriginalMessage(message: DesktopChatMessage): boolean {
	return message.role === "assistant" && message.kind !== "status";
}

function renderMarkdown(content: string): string {
	const normalized = content.trim();
	if (!normalized) {
		return "<p>无可显示内容。</p>";
	}

	const cached = markdownRenderCache.get(normalized);
	if (cached) {
		return cached;
	}

	const parsed = markdownParser.parse(normalized, { async: false });
	const sanitized = String(
		DOMPurify.sanitize(parsed, {
			ALLOWED_ATTR: [...MARKDOWN_ALLOWED_ATTR],
			ALLOWED_TAGS: [...MARKDOWN_ALLOWED_TAGS],
			ALLOW_DATA_ATTR: false,
		}),
	);
	const documentFragment = new DOMParser().parseFromString(sanitized, "text/html");

	for (const link of Array.from(documentFragment.body.querySelectorAll("a[href]"))) {
		link.setAttribute("target", "_blank");
		link.setAttribute("rel", "noreferrer noopener");
	}

	for (const checkbox of Array.from(documentFragment.body.querySelectorAll("input[type='checkbox']"))) {
		checkbox.setAttribute("disabled", "");
		checkbox.setAttribute("tabindex", "-1");
	}

	const htmlContent = documentFragment.body.innerHTML || "<p>无可显示内容。</p>";
	markdownRenderCache.set(normalized, htmlContent);
	return htmlContent;
}

function handleRenderedMarkdownClick(event: Event): void {
	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}

	const link = target.closest("a[href]");
	if (!(link instanceof HTMLAnchorElement)) {
		return;
	}

	event.preventDefault();
	void window.wepsDesktop.openExternal(link.href).catch((error) => {
		setStatus(error instanceof Error ? error.message : String(error));
	});
}

async function getRawMessageContent(sessionId: string, message: DesktopChatMessage): Promise<string> {
	if (!hasDeferredMessageContent(message)) {
		return message.content;
	}

	const cached = getCachedMessageContent(sessionId, message);
	if (cached) {
		return cached;
	}

	const content = await window.wepsDesktop.getMessageContent(sessionId, message.id);
	if (typeof content === "string") {
		messageContentCache.set(messageCacheKey(sessionId, message.id), {
			content,
			version: message.contentVersion ?? 0,
		});
		return content;
	}

	return message.content;
}

async function copyMessageOriginal(sessionId: string, message: DesktopChatMessage): Promise<void> {
	try {
		const content = await getRawMessageContent(sessionId, message);
		let copied = false;
		if (navigator.clipboard?.writeText) {
			try {
				await navigator.clipboard.writeText(content);
				copied = true;
			} catch {
				copied = false;
			}
		}
		if (!copied) {
			const textarea = document.createElement("textarea");
			textarea.value = content;
			textarea.setAttribute("readonly", "true");
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			document.body.append(textarea);
			textarea.select();
			copied = document.execCommand("copy");
			textarea.remove();
			if (!copied) {
				throw new Error("复制失败");
			}
		}
		setStatus("已复制原文。");
	} catch (error) {
		setStatus(error instanceof Error ? error.message : String(error));
	}
}

function openDetails(): void {
	detailsOpen = true;
	workspaceSwitcherOpen = false;
	composerMenuOpen = null;
	requestRender();
}

function closeDetails(): void {
	detailsOpen = false;
	requestRender();
}

function openWorkspaceSwitcher(): void {
	workspaceSwitcherOpen = true;
	detailsOpen = false;
	composerMenuOpen = null;
	requestRender();
}

function closeWorkspaceSwitcher(): void {
	workspaceSwitcherOpen = false;
	requestRender();
}

function toggleComposerMenu(menu: ComposerMenu): void {
	composerMenuOpen = composerMenuOpen === menu ? null : menu;
	requestRender();
}

function closeComposerMenu(): void {
	if (!composerMenuOpen) {
		return;
	}
	composerMenuOpen = null;
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
		workspaceSwitcherOpen = false;
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
		workspaceSwitcherOpen = false;
		setStatus(`已选择工作区：${basenamePath(workspacePath)}`);
	});
}

async function activateWorkspaceFromSwitcher(workspacePath: string): Promise<void> {
	closeWorkspaceSwitcher();
	await activateWorkspace(workspacePath);
}

async function chooseWorkspaceFromSwitcher(): Promise<void> {
	closeWorkspaceSwitcher();
	await chooseWorkspace();
}

async function closeCurrentWorkspace(): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.closeWorkspace();
		workspaceSwitcherOpen = false;
		detailsOpen = false;
		composerMenuOpen = null;
		setStatus("已关闭当前工作区。");
	});
}

async function openSession(sessionId: string): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.openSession(sessionId);
		composerMenuOpen = null;
		setStatus("会话已打开。");
	});
}

async function createSession(): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.createSession();
		composerMenuOpen = null;
		setStatus("已创建新会话。");
	});
}

async function archiveSession(sessionId: string): Promise<void> {
	await runTask(async () => {
		snapshot = await window.wepsDesktop.archiveSession(sessionId);
		setStatus("线程已归档。");
	});
}

async function deleteSession(sessionId: string): Promise<void> {
	const confirmed = window.confirm("确认永久删除这个线程吗？该操作会同时移除对应的会话记录。");
	if (!confirmed) {
		return;
	}

	await runTask(async () => {
		snapshot = await window.wepsDesktop.deleteSession(sessionId);
		setStatus("线程已删除。");
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

async function selectProfileFromComposer(profileId: string): Promise<void> {
	composerMenuOpen = null;
	requestRender();
	await setProfileSelection(profileId);
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

async function selectModelFromComposer(modelId: string): Promise<void> {
	composerMenuOpen = null;
	requestRender();
	await setModelSelection(modelId);
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
		setStatus("已创建 Provider，并同步到 CLI 共享目录。");
	});
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

function renderTopbar(): TemplateResult {
	const runtimeState = activeRuntimeState();
	return html`
		<header class="topbar">
			<div class="topbar__drag">
				<div class="topbar__left">
					<button class="icon-button" ?disabled=${isBusy} @click=${() => toggleSidebar()} aria-label="切换侧栏">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 5.75h16.5M3.75 12h16.5M3.75 18.25h10.5" />
						</svg>
					</button>
					<div class="topbar__brand">
						<span class="topbar__app">WEPS Desktop</span>
						<span class="topbar__context">Shared with WEPS CLI</span>
					</div>
				</div>
			</div>

			<div class="topbar__actions">
				<div class="topbar__status">
					<span class="pill pill--tiny ${runtimeTone(runtimeState?.phase)}">${runtimeState?.label ?? "未启动"}</span>
					<span class="topbar__meta">${activeProfile()?.label ?? "未配置 Provider"}</span>
				</div>
				${renderWindowControls()}
			</div>
		</header>
	`;
}

function renderLauncherTopbar(): TemplateResult {
	return html`
		<header class="topbar topbar--launcher">
			<div class="topbar__drag">
				<div class="topbar__left">
					<div class="topbar__brand">
						<span class="topbar__app">WEPS Desktop</span>
						<span class="topbar__context">同步 CLI 的工作台视图</span>
					</div>
				</div>
			</div>
			<div class="topbar__actions">${renderWindowControls()}</div>
		</header>
	`;
}

function renderLoadingState(): TemplateResult {
	return html`
		<div class="launcher-shell">
			${renderLauncherTopbar()}
			<div class="launcher-body launcher-body--loading">
				<div class="loading-panel">
					<div class="loading-panel__spinner"></div>
					<div class="loading-panel__copy">
						<p class="eyebrow">WEPS Desktop</p>
						<h1>正在加载桌面工作台...</h1>
						<p>读取共享的 Provider、Session 和工作区索引。</p>
					</div>
				</div>
			</div>
		</div>
	`;
}

function renderWorkspaceLauncher(): TemplateResult {
	const recentWorkspaces = snapshot?.recentWorkspaces ?? [];
	return html`
		<div class="launcher-shell">
			${renderLauncherTopbar()}
			<div class="launcher-body">
				<section class="launcher-hero">
					<div class="launcher-hero__glow launcher-hero__glow--primary"></div>
					<div class="launcher-hero__glow launcher-hero__glow--secondary"></div>
					<div class="launcher-hero__content">
						<p class="eyebrow">WEPS Desktop</p>
						<h1>继续你的 CLI 工作流，换一种更顺手的桌面交互。</h1>
						<p>
							桌面端不会重造数据层，只把会话、Provider 和工作区切换整理成更接近日常应用的窗口体验。
						</p>
						<div class="launcher-hero__actions">
							<button class="button button--primary" ?disabled=${isBusy} @click=${() => void chooseWorkspace()}>
								打开工作区
							</button>
						</div>
					</div>
				</section>

				<aside class="launcher-aside">
					<section class="panel-card">
						<div class="section-head">
							<h2>共享状态</h2>
							<span>CLI</span>
						</div>
						<div class="metric-grid">
							<div class="metric">
								<span>Provider</span>
								<strong>${snapshot?.providerProfiles.length ?? 0}</strong>
							</div>
							<div class="metric">
								<span>会话</span>
								<strong>${snapshot?.sessions.length ?? 0}</strong>
							</div>
						</div>
					</section>

					<section class="panel-card">
						<div class="section-head">
							<h2>最近工作区</h2>
							<span>${recentWorkspaces.length}</span>
						</div>
						<div class="compact-list">
							${recentWorkspaces.length > 0
								? recentWorkspaces.map(
										(workspacePath) => html`
											<button
												class="compact-list__item"
												?disabled=${isBusy}
												@click=${() => {
													void activateWorkspace(workspacePath);
												}}
											>
												<strong>${basenamePath(workspacePath)}</strong>
												<small>${truncate(workspacePath, 72)}</small>
											</button>
										`,
									)
								: html`<p class="panel-empty">还没有工作区记录。选择一个目录后，这里会出现快捷入口。</p>`}
						</div>
					</section>
				</aside>
			</div>
		</div>
	`;
}

function renderSidebar(): TemplateResult {
	const currentWorkspacePath = snapshot?.currentWorkspacePath;
	const profile = activeProfile();
	return html`
		<aside class="sidebar">
			<div class="sidebar__section sidebar__section--workspace">
				<div class="sidebar-brand">
					<div class="sidebar-brand__mark">W</div>
					<div class="sidebar-brand__copy">
						<strong>WEPS Desktop</strong>
						<small>${basenamePath(currentWorkspacePath)}</small>
					</div>
				</div>
				<div class="sidebar__meta-line">
					<span>${profile?.label ?? "未配置 Provider"}</span>
					<span>${snapshot?.sessions.length ?? 0} 个线程</span>
				</div>
				<button class="button button--subtle button--full" ?disabled=${isBusy} @click=${() => void createSession()}>
					新建线程
				</button>
			</div>

			<div class="sidebar__section sidebar__section--sessions">
				<div class="section-head">
					<h3>线程</h3>
					<span>${basenamePath(currentWorkspacePath)}</span>
				</div>
				<div class="session-nav">
					${snapshot && snapshot.sessions.length > 0
						? snapshot.sessions.map((session) => renderSessionNavItem(session))
						: html`<p class="panel-empty">当前工作区还没有线程，先新建一个或直接在底部输入。</p>`}
				</div>
			</div>

			<div class="sidebar__section sidebar__section--footer">
				<button class="button button--subtle button--full" ?disabled=${isBusy} @click=${() => openWorkspaceSwitcher()}>
					切换工作区
				</button>
				<button class="button button--subtle button--full" ?disabled=${isBusy} @click=${() => openDetails()}>
					打开设置
				</button>
			</div>
		</aside>
	`;
}

function renderSessionNavItem(session: DesktopSessionRecord): TemplateResult {
	const isActive = activeSessionRecord()?.id === session.id;
	return html`
		<div
			class="session-nav__item ${isActive ? "session-nav__item--active" : ""}"
			role="button"
			tabindex=${isBusy ? -1 : 0}
			@click=${() => {
				if (isBusy) {
					return;
				}
				void openSession(session.id);
			}}
			@keydown=${(event: KeyboardEvent) => {
				if (isBusy) {
					return;
				}
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					void openSession(session.id);
				}
			}}
		>
			<div class="session-nav__content">
				<div class="session-nav__titleline">
					<span class="session-nav__title">${truncate(session.title || "未命名线程", 30)}</span>
					<div class="session-nav__actions">
						<time>${formatRelativeTime(session.updatedAt)}</time>
						<button
							class="session-nav__action"
							title="归档线程"
							aria-label="归档线程"
							?disabled=${isBusy}
							@click=${(event: Event) => {
								event.stopPropagation();
								void archiveSession(session.id);
							}}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4 7.5h16M6.5 7.5v9.75A1.75 1.75 0 008.25 19h7.5a1.75 1.75 0 001.75-1.75V7.5M9.5 11.5h5" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 4.5h6" />
							</svg>
						</button>
						<button
							class="session-nav__action session-nav__action--danger"
							title="删除线程"
							aria-label="删除线程"
							?disabled=${isBusy}
							@click=${(event: Event) => {
								event.stopPropagation();
								void deleteSession(session.id);
							}}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 7.5h14M9.5 7.5V5.75A.75.75 0 0110.25 5h3.5a.75.75 0 01.75.75V7.5M8 7.5v10.25A1.25 1.25 0 009.25 19h5.5A1.25 1.25 0 0016 17.75V7.5" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M10 11v4.5M14 11v4.5" />
							</svg>
						</button>
					</div>
				</div>
				<div class="session-nav__summary">${truncate(session.lastPrompt || session.summary || "等待新的任务。", 56)}</div>
				<div class="session-nav__meta">
					<span>${sessionStateLabel(session)}</span>
					<span>${session.providerLabel ?? activeProfile()?.label ?? "未选 Provider"}</span>
				</div>
			</div>
		</div>
	`;
}

function renderConversationEmptyState(): TemplateResult {
	const hasProfiles = (snapshot?.providerProfiles.length ?? 0) > 0;
	return html`
		<div class="empty-state empty-state--hero">
			<div class="empty-state__mark">W</div>
			<p class="eyebrow">${hasProfiles ? "准备继续对话" : "需要先接入模型"}</p>
			<h2>${hasProfiles ? "从左侧切换线程，或直接开始输入。" : "先添加一个 Provider"}</h2>
			<p>
				${hasProfiles
					? `这里现在就是纯聊天画布。会话、模型和工作区仍然沿用 CLI 的共享上下文，但不再打断你的阅读节奏。`
					: "还没有可用的 Provider。打开设置后添加一个 OpenAI Compatible 或 Anthropic Compatible 配置。"}
			</p>
			<div class="empty-state__subline">
				<span>${activeProfile()?.label ?? "未配置 Provider"}</span>
				<span>${activeModelName() ?? "未选择模型"}</span>
				<span>${snapshot?.sessions.length ?? 0} 个线程</span>
			</div>
		</div>
	`;
}

function renderTranscriptSurface(): TemplateResult {
	const session = activeSession();
	if (!session) {
		return html`<section class="conversation-surface conversation-surface--empty">${renderConversationEmptyState()}</section>`;
	}

	return html`
		<section class="conversation-surface ${session.messages.length === 0 ? "conversation-surface--empty" : ""}">
			<div class="transcript">
				${session.messages.length === 0
					? html`
							<div class="empty-state empty-state--compact">
								<div class="empty-state__mark empty-state__mark--small">W</div>
								<p class="eyebrow">线程已创建</p>
								<h2>${truncate(session.record.title || "未命名线程", 40)}</h2>
								<p>从底部输入框发出第一条任务，runtime 会自动绑定到当前工作区并继续写入共享会话目录。</p>
							</div>
						`
					: repeat(
							session.messages,
							(message) => `${session.record.id}:${message.id}`,
							(message) => renderMessage(session.record.id, message),
						)}
			</div>
		</section>
	`;
}

function renderMessage(sessionId: string, message: DesktopChatMessage): TemplateResult {
	const isUser = message.role === "user";
	const collapsible = isMessageCollapsible(message);
	const expanded = isMessageExpanded(sessionId, message);
	const preview = collapsible ? previewMessageContent(message) : undefined;
	const fullContent = expanded ? getCachedMessageContent(sessionId, message) : undefined;
	const renderAsMarkdown = shouldRenderMarkdown(message);
	const bubbleTone = `${messageBubbleTone(message)}${collapsible ? " message-bubble--collapsible" : ""}${
		collapsible && !expanded ? " message-bubble--collapsed" : ""
	}`;

	if (expanded && hasDeferredMessageContent(message) && !fullContent) {
		ensureMessageContent(sessionId, message);
	}

	return html`
		<article class="message-shell ${isUser ? "message-shell--user" : ""}">
			<div class="message-shell__meta ${isUser ? "message-shell__meta--user" : ""}">
				${isUser
					? html`<span class="message-shell__time">${message.time}</span>`
					: html`
							<span class="message-avatar">${messageAvatarLabel(message)}</span>
							<div class="message-shell__authoring">
								<strong>${messageAuthorLabel(message)}</strong>
								<span>${message.time}</span>
							</div>
						`}
				${isUser ? html`<span class="message-avatar message-avatar--user">${messageAvatarLabel(message)}</span>` : html``}
			</div>
			<div class="message-bubble ${bubbleTone}">
				${!collapsible && message.kind && message.kind !== "default"
					? html`<div class="message-bubble__eyebrow">${messageKindLabel(message)}</div>`
					: html``}
				${collapsible
					? html`
							<div class="message-bubble__summary">
								<div class="message-bubble__summary-copy">
									<strong class="message-bubble__summary-title">${collapsedMessageTitle(message)}</strong>
									<span class="message-bubble__summary-meta">
										${preview?.lineCount ?? 0} 行${!expanded && preview?.truncated ? " · 已折叠" : ""}
									</span>
								</div>
								<button
									class="message-bubble__toggle"
									type="button"
									aria-expanded=${expanded ? "true" : "false"}
									@click=${() => toggleMessageExpansion(sessionId, message)}
								>
									${expanded ? "收起" : "展开"}
								</button>
							</div>
							${expanded
								? fullContent
									? renderAsMarkdown
										? html`
												<div class="message-bubble__markdown" @click=${(event: Event) => handleRenderedMarkdownClick(event)}>
													${unsafeHTML(renderMarkdown(fullContent))}
												</div>
											`
										: html`<pre class="message-bubble__content">${fullContent}</pre>`
									: html`<pre class="message-bubble__preview">正在加载完整内容...</pre>`
								: html`<pre class="message-bubble__preview">${preview?.text}</pre>`}
						`
					: renderAsMarkdown
						? html`
								<div class="message-bubble__markdown" @click=${(event: Event) => handleRenderedMarkdownClick(event)}>
									${unsafeHTML(renderMarkdown(message.content))}
								</div>
							`
						: html`<pre class="message-bubble__content">${message.content}</pre>`}
			</div>
			${canCopyOriginalMessage(message)
				? html`
						<div class="message-shell__actions">
							<button class="message-shell__copy" type="button" @click=${() => void copyMessageOriginal(sessionId, message)}>
								复制原文
							</button>
						</div>
					`
				: html``}
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
					<h2>${request.toolName}</h2>
				</div>
				<span>${truncate(request.summary, 96)}</span>
			</div>
			<p class="approval-banner__text">${request.reason}</p>
			<pre class="approval-banner__content">${request.commandText ?? request.argsText}</pre>
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

function renderProviderMenu(): TemplateResult {
	const profiles = snapshot?.providerProfiles ?? [];
	if (profiles.length === 0) {
		return html`
			<div class="floating-menu">
				<div class="floating-menu__header">
					<strong>Provider</strong>
					<span>未配置</span>
				</div>
				<p class="floating-menu__empty">先在设置里添加一个 Provider。</p>
			</div>
		`;
	}

	return html`
		<div class="floating-menu">
			<div class="floating-menu__header">
				<strong>切换 Provider</strong>
				<span>${profiles.length} 个配置</span>
			</div>
			<div class="floating-menu__list">
				${profiles.map(
					(profile) => html`
						<button
							class="floating-menu__item ${snapshot?.activeSelection.profileId === profile.id ? "floating-menu__item--active" : ""}"
							?disabled=${isBusy}
							@click=${() => {
								void selectProfileFromComposer(profile.id);
							}}
						>
							<div>
								<strong>${profile.label}</strong>
								<small>${profile.family}</small>
							</div>
							<span class="pill pill--tiny ${providerValidationTone(profile)}">${providerValidationLabel(profile)}</span>
						</button>
					`,
				)}
			</div>
		</div>
	`;
}

function renderModelMenu(): TemplateResult {
	const profile = activeProfile();
	const models = profile?.models ?? [];
	if (!profile || models.length === 0) {
		return html`
			<div class="floating-menu">
				<div class="floating-menu__header">
					<strong>切换模型</strong>
					<span>不可用</span>
				</div>
				<p class="floating-menu__empty">先选择一个可用 Provider，然后刷新模型列表。</p>
			</div>
		`;
	}

	return html`
		<div class="floating-menu">
			<div class="floating-menu__header">
				<strong>切换模型</strong>
				<span>${profile.label}</span>
			</div>
			<div class="floating-menu__list">
				${models.map(
					(model) => html`
						<button
							class="floating-menu__item ${snapshot?.activeSelection.modelId === model.id ? "floating-menu__item--active" : ""}"
							?disabled=${isBusy}
							@click=${() => {
								void selectModelFromComposer(model.id);
							}}
						>
							<div>
								<strong>${model.name}</strong>
								<small>${model.id}</small>
							</div>
						</button>
					`,
				)}
			</div>
		</div>
	`;
}

function renderComposer(): TemplateResult {
	const runtimeState = activeRuntimeState();
	const canAbort = Boolean(runtimeState?.interruptible);
	return html`
		<section class="composer">
			<textarea
				class="composer__input"
				placeholder="描述你希望在当前工作区里完成的任务。"
				.value=${live(composerValue)}
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

			<div class="composer__footer">
				<div class="composer__meta">
					<div class="composer__menu-anchor">
						<button class="composer__chip" ?disabled=${isBusy} @click=${() => toggleComposerMenu("model")}>
							${activeModelName() ?? "未选择模型"}
						</button>
						${composerMenuOpen === "model" ? renderModelMenu() : html``}
					</div>
					<div class="composer__menu-anchor">
						<button class="composer__chip" ?disabled=${isBusy} @click=${() => toggleComposerMenu("provider")}>
							${activeProfile()?.label ?? "未配置 Provider"}
						</button>
						${composerMenuOpen === "provider" ? renderProviderMenu() : html``}
					</div>
					<span class="composer__caption">${runtimeState?.detail ?? runtimeState?.label ?? "未启动 runtime"}</span>
					<span class="composer__shortcut">Ctrl / ⌘ + Enter 发送</span>
				</div>
				<div class="composer__actions">
					<button class="button button--subtle" ?disabled=${isBusy || !canAbort} @click=${() => void abortSession()}>
						中断
					</button>
					<button class="button button--primary" ?disabled=${isBusy} @click=${() => void sendPrompt()}>
						发送任务
					</button>
				</div>
			</div>
			${composerMenuOpen
				? html`<button class="floating-menu-backdrop" aria-label="关闭菜单" @click=${() => closeComposerMenu()}></button>`
				: html``}
		</section>
	`;
}

function renderWorkspacePane(): TemplateResult {
	return html`
		<section class="workspace-pane">
			<div class="workspace-pane__stage">
				${renderApprovalBanner()} ${renderTranscriptSurface()}
			</div>
			<div class="workspace-pane__composer">${renderComposer()}</div>
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
			<div class="detail-list">
				<div class="detail-list__row">
					<span>Agent Dir</span>
					<span>${truncate(snapshot?.agentDir ?? "Unavailable", 34)}</span>
				</div>
				<div class="detail-list__row">
					<span>应用</span>
					<span>${snapshot?.appContext.appName ?? "WEPS Desktop"}</span>
				</div>
				<div class="detail-list__row">
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
					: html`<p class="panel-empty">还没有 Provider。下方创建后会自动写入 CLI 共享目录。</p>`}
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
									<strong>${basenamePath(workspacePath)}</strong>
									<small>${truncate(workspacePath, 72)}</small>
								</button>
							`,
						)
					: html`<p class="panel-empty">暂无最近工作区记录。</p>`}
			</div>
		</section>
	`;
}

function renderWorkspaceSwitcherOverlay(): TemplateResult {
	if (!workspaceSwitcherOpen) {
		return html``;
	}

	const workspaces = workspaceSummaries();
	return html`
		<div class="settings-overlay settings-overlay--light" @click=${() => closeWorkspaceSwitcher()}>
			<section class="workspace-switcher" @click=${(event: Event) => event.stopPropagation()}>
				<header class="workspace-switcher__header">
					<div>
						<p class="eyebrow">切换工作区</p>
						<h2>选择已接入目录</h2>
					</div>
					<button class="button button--subtle button--small" @click=${() => closeWorkspaceSwitcher()}>关闭</button>
				</header>

				<div class="workspace-switcher__list">
					${workspaces.length > 0
						? workspaces.map(
								(workspace) => html`
									<button
										class="workspace-row ${workspace.isCurrent ? "workspace-row--active" : ""}"
										?disabled=${isBusy || workspace.isCurrent}
										@click=${() => {
											void activateWorkspaceFromSwitcher(workspace.path);
										}}
									>
										<div class="workspace-row__copy">
											<div class="workspace-row__titleline">
												<strong>${workspace.name}</strong>
												${workspace.isCurrent ? html`<span class="pill pill--tiny is-ready">当前</span>` : html``}
											</div>
											<small>${truncate(workspace.path, 84)}</small>
											<div class="workspace-row__meta">
												<span>${workspace.sessionCount} 个线程</span>
												<span>${workspace.providerLabel ?? "未记录 Provider"}</span>
												<span>${workspace.lastUpdated ? formatRelativeTime(workspace.lastUpdated) : "暂无会话"}</span>
											</div>
											${workspace.lastTitle
												? html`<p class="workspace-row__hint">${truncate(workspace.lastTitle, 56)}</p>`
												: html``}
										</div>
									</button>
								`,
							)
						: html`<p class="panel-empty">还没有已接入的工作区，先创建或选择一个文件夹。</p>`}
				</div>

				<div class="workspace-switcher__actions">
					${snapshot?.currentWorkspacePath
						? html`
								<button class="button button--subtle" ?disabled=${isBusy} @click=${() => void closeCurrentWorkspace()}>
									关闭当前工作区
								</button>
							`
						: html``}
					<button class="button button--primary" ?disabled=${isBusy} @click=${() => void chooseWorkspaceFromSwitcher()}>
						创建或打开新工作区
					</button>
				</div>
			</section>
		</div>
	`;
}

function renderDetailsOverlay(): TemplateResult {
	const currentWorkspacePath = snapshot?.currentWorkspacePath;
	if (!detailsOpen || !currentWorkspacePath) {
		return html``;
	}

	return html`
		<div class="settings-overlay" @click=${() => closeDetails()}>
			<section class="settings-sheet" @click=${(event: Event) => event.stopPropagation()}>
				<header class="settings-sheet__header">
					<div>
						<p class="eyebrow">Workspace Settings</p>
						<h2>${basenamePath(currentWorkspacePath)}</h2>
					</div>
					<button class="button button--subtle button--small" @click=${() => closeDetails()}>关闭</button>
				</header>

				<div class="settings-sheet__grid">
					${renderContextCard()} ${renderProviderCard()} ${renderCreateProviderCard()} ${renderRecentWorkspacesCard()}
				</div>
			</section>
		</div>
	`;
}

function renderStatusBar(): TemplateResult {
	const runtimeState = activeRuntimeState();
	return html`
		<footer class="statusbar">
			<span class="statusbar__brand">WEPS Desktop</span>
			<div class="statusbar__pill">
				<span class="statusbar__dot ${runtimeTone(runtimeState?.phase)}"></span>
				<span>${runtimeState?.label ?? "未启动"}</span>
			</div>
			<span class="statusbar__item">${activeProfile()?.label ?? "未配置 Provider"}</span>
			<span class="statusbar__item">${activeModelName() ?? "未选择模型"}</span>
			<span class="statusbar__spacer"></span>
			<span class="statusbar__item">${basenamePath(snapshot?.currentWorkspacePath)}</span>
			<span class="statusbar__item">${snapshot?.sessions.length ?? 0} 个会话</span>
			<span class="statusbar__item">v${snapshot?.appContext.appVersion ?? "0.1.0"}</span>
		</footer>
	`;
}

function renderWorkspaceShell(): TemplateResult {
	const shellClass = sidebarOpen ? "desktop-shell" : "desktop-shell desktop-shell--sidebar-hidden";
	return html`
		<div class=${shellClass}>
			${renderTopbar()}
			<div class="shell-body">
				${sidebarOpen ? renderSidebar() : html``}
				${renderWorkspacePane()}
			</div>
			${renderStatusBar()}
			${renderWorkspaceSwitcherOverlay()} ${renderDetailsOverlay()}
		</div>
	`;
}

function renderRootContent(): TemplateResult {
	if (!snapshot) {
		return renderLoadingState();
	}
	if (!snapshot.currentWorkspacePath) {
		return renderWorkspaceLauncher();
	}
	return renderWorkspaceShell();
}

function renderApp(): void {
	const root = getRoot();
	const frameClass = windowState.isMaximized ? "app-frame app-frame--maximized" : "app-frame";
	render(
		html`
			<div class=${frameClass}>
				${renderRootContent()}
				${statusMessage ? html`<div class="toast">${statusMessage}</div>` : html``}
			</div>
		`,
		root,
	);
}

async function bootstrap(): Promise<void> {
	snapshot = await window.wepsDesktop.getSnapshot();
	windowState = await window.wepsDesktop.getWindowState();
	unsubscribeSnapshot = window.wepsDesktop.onSnapshot((nextSnapshot) => {
		snapshot = nextSnapshot;
		scheduleRender();
	});
	unsubscribeWindowState = window.wepsDesktop.onWindowState((nextState) => {
		windowState = nextState;
		scheduleRender();
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
	if (renderTimer) {
		window.clearTimeout(renderTimer);
	}
});
