import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid";
import { batch, createEffect, createMemo, createSignal, onMount } from "solid-js";
import type { ProviderProfile, ProviderProfileService } from "../provider-profiles/index.js";
import { SessionHistoryService } from "../session-history/session-history-service.js";
import { getAgentDir } from "../config.js";
import { ApprovalOverlay } from "./approval-overlay.js";
import { WepsAgentRuntime, type RuntimeSelection } from "./agent-runtime.js";
import { writeShellDebugLog } from "./debug-log.js";
import { executeSlashCommand, getSlashCommands } from "./slash-commands.js";
import { createIdleRuntimeState, runtimeStateTone, type RuntimeSessionState } from "./runtime-status.js";
import { applyShellModePrompt, getShellMode, nextShellMode, shellModeSwitchMessage, type ShellModeId } from "./shell-modes.js";
import { providerFamilyColor, wepscliShellTheme as theme } from "./theme.js";
import type { ToolApprovalDecision, ToolApprovalRequest } from "./tool-approval.js";
import type { OverlayKind, OverlayOption, ShellFocus, ShellView } from "./types.js";
import { formatTimestamp, INITIAL_SESSIONS, overlayDescription, overlayTitle, truncate, wrapIndex } from "./helpers.js";
import { createProviderAddFlow } from "./provider-add-flow.js";
import {
	appendSessionMessage,
	insertSessionMessageBefore,
	patchSessionMessage,
	toggleSessionMessage as toggleSessionMessageState,
	type TranscriptMessagePatch,
} from "./transcript-state.js";
import { TranscriptPanel } from "./transcript-panel.js";
import {
	ChatComposer,
	OverlayPicker,
	type ChatMessage,
	type ComposerInputRef,
} from "./chat-components.js";

const LOGO = "WEPsCLI";

export function WEPSCLIShellApp(props: { profileService: ProviderProfileService; onExit: () => void }) {
	const renderer = useRenderer();
	const dimensions = useTerminalDimensions();
	const sessionHistory = new SessionHistoryService();

	const [view, setView] = createSignal<ShellView>("home");
	const [focusRegion, setFocusRegionState] = createSignal<ShellFocus>("composer");
	const [overlay, setOverlay] = createSignal<OverlayKind | undefined>(undefined);
	const [profiles, setProfiles] = createSignal<ProviderProfile[]>(props.profileService.listProfiles());
	const [selection, setSelection] = createSignal(props.profileService.getActiveSelection());
	const [overlayIndex, setOverlayIndex] = createSignal(0);
	const [modelPickerProfileId, setModelPickerProfileId] = createSignal<string | undefined>(selection().profileId);
	const [sessions, setSessions] = createSignal(sessionHistory.ensureSeed(INITIAL_SESSIONS));
	const [composerValue, setComposerValue] = createSignal("");
	const [shellMode, setShellMode] = createSignal<ShellModeId>("agent");
	const [activeSessionId, setActiveSessionId] = createSignal<string | undefined>(undefined);
	const [messagesBySession, setMessagesBySession] = createSignal<Record<string, ChatMessage[]>>({});
	const [runtimeStateBySession, setRuntimeStateBySession] = createSignal<Record<string, RuntimeSessionState>>({});
	const [approvalRequests, setApprovalRequests] = createSignal<ToolApprovalRequest[]>([]);
	const [approvalDecisionIndex, setApprovalDecisionIndex] = createSignal(0);
	const runtime = new WepsAgentRuntime(props.profileService, {
		appendMessage: (sessionId, message) => appendTranscriptMessage(sessionId, message),
		insertMessageBefore: (sessionId, beforeMessageId, message) => insertTranscriptMessageBefore(sessionId, beforeMessageId, message),
		replaceMessages: (sessionId, messages) => replaceTranscriptMessages(sessionId, messages),
		patchMessage: (sessionId, messageId, patch) => patchTranscriptMessage(sessionId, messageId, patch),
		openApproval: (_sessionId, request) => openApprovalRequest(request),
		closeApproval: (_sessionId, requestId) => closeApprovalRequest(requestId),
		updateRuntimeState: (sessionId, state) => updateRuntimeState(sessionId, state),
		updateSessionBinding: (sessionId, binding) => persistRuntimeSessionBinding(sessionId, binding),
	});

	let composerRef: ComposerInputRef | undefined;
	let transcriptScroll:
		| {
				scrollTo(position: number): void;
				scrollHeight: number;
				isDestroyed?: boolean;
		  }
		| undefined;
	let closed = false;
	let transcriptScrollTimer: ReturnType<typeof setTimeout> | undefined;
	const providerAddFlow = createProviderAddFlow({
		profileService: props.profileService,
		onCreated: ({ profile, modelId }) => {
			reloadProviderState();
			if (currentSession()) {
				sessionHistory.updateSession(currentSession()!.id, {
					providerProfileId: profile.id,
					providerLabel: profile.label,
					modelId,
				});
				setSessions(sessionHistory.listSessions());
				void runtime.syncSelection(currentSession()!.id, { profileId: profile.id, modelId });
			}
			pushChatMessage(currentSession()?.id ?? createdTransientSessionId(), {
				id: `provider-add:${profile.id}:${Date.now()}`,
				role: "system",
				content: `Added provider ${profile.label} / ${modelId}`,
				time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
			});
		},
		onClose: () => setFocusRegion("composer"),
	});

	const viewport = createMemo(() => ({
		width: dimensions().width || 120,
		height: dimensions().height || 32,
	}));
	const showSidebar = createMemo(() => false);
	const shellReady = createMemo(() => profiles().length > 0);
	const activeShellMode = createMemo(() => getShellMode(shellMode()));

	const activeProfile = createMemo(() => {
		const current = selection().profileId;
		return current ? profiles().find((profile) => profile.id === current) : profiles()[0];
	});

	const activeModel = createMemo(() => selection().modelId ?? activeProfile()?.models[0]?.id);
	const currentSession = createMemo(() => {
		const currentId = activeSessionId();
		const list = sessions();
		return currentId ? list.find((item) => item.id === currentId) : list.find((item) => item.state === "active") ?? list[0];
	});
	const currentMessages = createMemo(() => {
		const session = currentSession();
		return session ? messagesBySession()[session.id] ?? [] : [];
	});
	const currentRuntimeState = createMemo(() => {
		const session = currentSession();
		return session ? runtimeStateBySession()[session.id] ?? createIdleRuntimeState() : createIdleRuntimeState();
	});
	const activeApproval = createMemo(() => approvalRequests()[0]);
	const recentSessions = createMemo(() => sessions().slice(0, 5));
	const sessionSummary = createMemo(() => currentSession()?.summary ?? "No session selected yet.");

	const overlayOptions = createMemo<OverlayOption[]>(() => {
		switch (overlay()) {
			case "provider":
				return [
					...profiles().map((profile) => ({
						id: `provider:${profile.id}`,
						label: profile.label,
						description: `${profile.family} | ${profile.models.length} model${profile.models.length === 1 ? "" : "s"} | ${profile.lastValidationStatus}`,
						badge: selection().profileId === profile.id ? "ACTIVE" : undefined,
					})),
					{
						id: "provider:add",
						label: "Add provider",
						description: "Create a new provider profile with a guided setup flow.",
						badge: "NEW",
					},
				];
			case "model-provider":
				return profiles().map((profile) => ({
					id: `model-provider:${profile.id}`,
					label: profile.label,
					description: `${profile.family} | ${profile.models.length} model${profile.models.length === 1 ? "" : "s"} available`,
					badge: modelPickerProfileId() === profile.id ? "OPEN" : selection().profileId === profile.id ? "ACTIVE" : undefined,
				}));
			case "model":
				return (profiles().find((profile) => profile.id === modelPickerProfileId())?.models ?? []).map((model) => ({
					id: `model:${modelPickerProfileId()}:${model.id}`,
					label: model.id,
					description: `${model.family} | ${model.name}`,
					badge: selection().profileId === modelPickerProfileId() && activeModel() === model.id ? "CURRENT" : undefined,
				}));
			case "session":
				return sessions().map((session) => ({
					id: `session:${session.id}`,
					label: session.title,
					description: `${session.state} | ${formatTimestamp(session.updatedAt)} | ${session.summary}`,
					badge: session.id === currentSession()?.id ? "OPEN" : undefined,
				}));
			case undefined:
				return [];
		}
	});

	onMount(() => {
		writeShellDebugLog(`mounted chat shell profiles=${profiles().length} sessions=${sessionHistory.listSessions().length}`);
		setTimeout(() => composerRef?.focus(), 10);
	});

	createEffect(() => {
		runtime.setMode(shellMode());
	});

	createEffect(() => {
		const session = currentSession();
		if (!session) {
			writeShellDebugLog("effect session=none messages=0");
			return;
		}
		if (!activeSessionId()) {
			setActiveSessionId(session.id);
			syncActiveSelectionFromSession(session.id);
		}
		ensureSessionTranscript(session.id);
		if (session.runtimeSessionFile) {
			void runtime.loadSession(session.id, selectionForSession(session), {
				runtimeSessionFile: session.runtimeSessionFile,
			});
		}
		writeShellDebugLog(`effect session=${session.id} messages=${currentMessages().length}`);
	});

	useKeyboard((evt) => {
		writeShellDebugLog(`key name=${evt.name} focus=${focusRegion()} overlay=${overlay() ?? "none"}`);

		if (evt.ctrl && evt.name === "c") {
			evt.preventDefault();
			exitShell();
			return;
		}

		if (evt.ctrl && evt.name === ".") {
			evt.preventDefault();
			void abortActiveRequest();
			return;
		}

		if (activeApproval()) {
			if (evt.name === "escape") {
				evt.preventDefault();
				resolveActiveApproval("cancel");
				return;
			}
			if (evt.name === "left" || evt.name === "up") {
				evt.preventDefault();
				setApprovalDecisionIndex((current) => wrapIndex(current, -1, 3));
				return;
			}
			if (evt.name === "right" || evt.name === "down") {
				evt.preventDefault();
				setApprovalDecisionIndex((current) => wrapIndex(current, 1, 3));
				return;
			}
			if (evt.name === "return") {
				evt.preventDefault();
				resolveActiveApproval((["allow", "reject", "cancel"] as ToolApprovalDecision[])[approvalDecisionIndex()] ?? "cancel");
				return;
			}
			return;
		}

		if (providerAddFlow.isActive()) {
			if (evt.name === "escape") {
				evt.preventDefault();
				providerAddFlow.back();
				return;
			}

			if (providerAddFlow.isPickerStep()) {
				if (evt.name === "up") {
					evt.preventDefault();
					providerAddFlow.moveSelection(-1);
					return;
				}
				if (evt.name === "down") {
					evt.preventDefault();
					providerAddFlow.moveSelection(1);
					return;
				}
				if (evt.name === "return") {
					evt.preventDefault();
					providerAddFlow.confirmSelection();
					return;
				}
			}

			return;
		}

		if (overlay()) {
			if (evt.name === "escape") {
				evt.preventDefault();
				closeOverlay();
				return;
			}
			if (evt.name === "up") {
				evt.preventDefault();
				setOverlayIndex(wrapIndex(overlayIndex(), -1, overlayOptions().length));
				return;
			}
			if (evt.name === "down") {
				evt.preventDefault();
				setOverlayIndex(wrapIndex(overlayIndex(), 1, overlayOptions().length));
				return;
			}
			if (evt.name === "return") {
				evt.preventDefault();
				const target = overlayOptions()[overlayIndex()];
				if (target) activateAction(target.id);
				return;
			}
			return;
		}

		if (evt.option && evt.name === "m") {
			evt.preventDefault();
			applyShellMode(nextShellMode(shellMode()));
			return;
		}

		if (evt.option && ["1", "2", "3", "4"].includes(evt.name)) {
			evt.preventDefault();
			const nextMode = ({
				"1": "agent",
				"2": "plan",
				"3": "read-only",
				"4": "auto-approve",
			} as Record<string, ShellModeId>)[evt.name];
			if (nextMode) {
				applyShellMode(nextMode);
			}
			return;
		}

		if (evt.name === "tab") {
			evt.preventDefault();
			cycleFocus();
			return;
		}

		if (focusRegion() === "main") {
			if (evt.name === "up") {
				evt.preventDefault();
				return;
			}
			if (evt.name === "down") {
				evt.preventDefault();
				return;
			}
			if (evt.name === "escape") {
				evt.preventDefault();
				setFocusRegion("composer");
				return;
			}
		}

		if (focusRegion() === "composer" && evt.name === "escape" && !(composerRef?.value ?? "").trim()) {
			evt.preventDefault();
			exitShell();
		}
	});

	function exitShell(): void {
		if (closed) return;
		closed = true;
		writeShellDebugLog("exit shell");
		if (transcriptScrollTimer) {
			clearTimeout(transcriptScrollTimer);
			transcriptScrollTimer = undefined;
		}
		runtime.dispose();
		renderer.setTerminalTitle("");
		renderer.destroy();
		props.onExit();
	}

	function requestRender(): void {
		(renderer as { requestRender?: () => void }).requestRender?.();
	}

	function cancelTranscriptAutoScroll(): void {
		if (!transcriptScrollTimer) {
			return;
		}
		clearTimeout(transcriptScrollTimer);
		transcriptScrollTimer = undefined;
	}

	function scheduleTranscriptScrollToBottom(): void {
		cancelTranscriptAutoScroll();
		transcriptScrollTimer = setTimeout(() => {
			transcriptScrollTimer = undefined;
			if (!transcriptScroll || transcriptScroll.isDestroyed) {
				return;
			}
			transcriptScroll.scrollTo(transcriptScroll.scrollHeight);
		}, 50);
	}

	function reloadProviderState(): void {
		setProfiles(props.profileService.listProfiles());
		setSelection(props.profileService.getActiveSelection());
	}

	function updateRuntimeState(sessionId: string, state: RuntimeSessionState): void {
		setRuntimeStateBySession((current) => ({
			...current,
			[sessionId]: state,
		}));
		requestRender();
	}

	async function abortActiveRequest(): Promise<void> {
		const session = currentSession();
		if (!session) {
			return;
		}
		const aborted = await runtime.abort(session.id);
		if (!aborted) {
			pushChatMessage(session.id, {
				id: `${session.id}:system:${Date.now()}`,
				role: "system",
				content: "No active request to interrupt.",
				time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
				kind: "status",
			});
		}
	}

	async function compactCurrentSession(): Promise<void> {
		const session = currentSession();
		if (!session) {
			const sessionId = createdTransientSessionId();
			pushChatMessage(sessionId, {
				id: `${sessionId}:system:${Date.now()}`,
				role: "system",
				content: "No active session is ready to compact yet.",
				time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
				kind: "status",
			});
			return;
		}

		await runtime.compact(session.id, selectionForSession(session), {
			runtimeSessionFile: session.runtimeSessionFile,
		});
	}

	function applyShellMode(nextMode: ShellModeId): void {
		if (shellMode() === nextMode) {
			const sessionId = currentSession()?.id ?? createdTransientSessionId();
			pushChatMessage(sessionId, {
				id: `${sessionId}:system:${Date.now()}`,
				role: "system",
				content: `Already in ${getShellMode(nextMode).label} mode.`,
				time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
				kind: "status",
			});
			return;
		}

		setShellMode(nextMode);
		const sessionId = currentSession()?.id ?? createdTransientSessionId();
		pushChatMessage(sessionId, {
			id: `${sessionId}:system:${Date.now()}`,
			role: "system",
			content: shellModeSwitchMessage(nextMode),
			time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
			kind: "status",
		});
		composerRef?.focus();
		setFocusRegion("composer");
		requestRender();
	}

	function openApprovalRequest(request: ToolApprovalRequest): void {
		writeShellDebugLog(`approval open tool=${request.toolName} id=${request.id}`);
		setOverlay(undefined);
		setApprovalRequests((current) => [...current, request]);
		setApprovalDecisionIndex(0);
		setFocusRegion("overlay");
		requestRender();
	}

	function closeApprovalRequest(requestId: string): void {
		writeShellDebugLog(`approval close id=${requestId}`);
		setApprovalRequests((current) => current.filter((request) => request.id !== requestId));
		setApprovalDecisionIndex(0);
		if (!providerAddFlow.isActive() && !overlay() && approvalRequests().filter((request) => request.id !== requestId).length === 0) {
			setFocusRegion("composer");
		}
		requestRender();
	}

	function resolveActiveApproval(decision: ToolApprovalDecision): void {
		const request = activeApproval();
		if (!request) {
			return;
		}
		writeShellDebugLog(`approval decision tool=${request.toolName} decision=${decision}`);
		runtime.resolveApproval(request.id, decision);
	}

	function setFocusRegion(region: ShellFocus): void {
		setFocusRegionState(region);
		if (region === "composer") {
			setTimeout(() => composerRef?.focus(), 0);
			return;
		}
		composerRef?.blur();
	}

	function cycleFocus(): void {
		if (activeApproval() || overlay()) {
			setFocusRegion("overlay");
			return;
		}
		const order: ShellFocus[] = ["main", "composer"];
		const index = order.indexOf(focusRegion());
		setFocusRegion(order[(index + 1) % order.length] ?? "composer");
	}

	function setShellView(next: ShellView): void {
		batch(() => {
			setView(next);
		});
		setFocusRegion("composer");
	}

	function openOverlay(kind: OverlayKind): void {
		if (kind === "model" && profiles().length === 0) {
			return;
		}
		if (kind === "model") {
			const activeProviderId = selection().profileId ?? profiles()[0]?.id;
			if (!activeProviderId) {
				return;
			}
			setModelPickerProfileId(activeProviderId);
			if (profiles().length > 1) {
				setOverlay("model-provider");
				setOverlayIndex(Math.max(0, profiles().findIndex((profile) => profile.id === activeProviderId)));
				setFocusRegion("overlay");
				return;
			}
		}
		setOverlay(kind);
		setOverlayIndex(0);
		setFocusRegion("overlay");
	}

	function closeOverlay(): void {
		setOverlay(undefined);
		setFocusRegion("composer");
	}

	function openProviderAdd(): void {
		setOverlay(undefined);
		providerAddFlow.open();
		setFocusRegion("overlay");
	}

	function ensureSessionTranscript(sessionId: string): void {
		setMessagesBySession((current) => {
			if (current[sessionId]) return current;
			const session = sessions().find((item) => item.id === sessionId);
			const initial: ChatMessage[] = [
				{
					id: `${sessionId}:system:0`,
					role: "system",
					content: session ? `Opened ${session.title}` : "Opened session",
					time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
				},
			];
			return { ...current, [sessionId]: initial };
		});
		setRuntimeStateBySession((current) => (current[sessionId] ? current : { ...current, [sessionId]: createIdleRuntimeState() }));
		requestRender();
		scheduleTranscriptScrollToBottom();
	}

	function appendTranscriptMessage(sessionId: string, message: ChatMessage): void {
		setMessagesBySession((current) => appendSessionMessage(current, sessionId, message));
		requestRender();
		scheduleTranscriptScrollToBottom();
	}

	function replaceTranscriptMessages(sessionId: string, messages: ChatMessage[]): void {
		setMessagesBySession((current) => ({
			...current,
			[sessionId]: messages.slice(-200),
		}));
		requestRender();
		scheduleTranscriptScrollToBottom();
	}

	function insertTranscriptMessageBefore(sessionId: string, beforeMessageId: string, message: ChatMessage): void {
		setMessagesBySession((current) => insertSessionMessageBefore(current, sessionId, beforeMessageId, message));
		requestRender();
		scheduleTranscriptScrollToBottom();
	}

	function patchTranscriptMessage(sessionId: string, messageId: string, patch: TranscriptMessagePatch): void {
		setMessagesBySession((current) => {
			const next = patchSessionMessage(current, sessionId, messageId, patch);
			return next.messagesBySession;
		});
		requestRender();
		scheduleTranscriptScrollToBottom();
	}

	function toggleTranscriptMessage(sessionId: string, messageId: string): void {
		cancelTranscriptAutoScroll();
		setMessagesBySession((current) => toggleSessionMessageState(current, sessionId, messageId));
		requestRender();
	}

	function selectionForSession(session = currentSession()): RuntimeSelection {
		return {
			profileId: session?.providerProfileId ?? selection().profileId,
			modelId: session?.modelId ?? selection().modelId,
		};
	}

	function persistRuntimeSessionBinding(sessionId: string, binding: { runtimeSessionFile?: string }): void {
		if (!binding.runtimeSessionFile) {
			return;
		}
		const existing = sessions().find((session) => session.id === sessionId);
		if (existing?.runtimeSessionFile === binding.runtimeSessionFile) {
			return;
		}
		sessionHistory.updateSession(sessionId, {
			runtimeSessionFile: binding.runtimeSessionFile,
		});
		setSessions(sessionHistory.listSessions());
	}

	function syncActiveSelectionFromSession(sessionId: string): void {
		const session = sessions().find((item) => item.id === sessionId);
		if (!session?.providerProfileId) {
			return;
		}
		const profile = profiles().find((item) => item.id === session.providerProfileId);
		if (!profile) {
			return;
		}
		props.profileService.setActiveSelection(profile.id, session.modelId ?? profile.models[0]?.id);
		reloadProviderState();
	}

	function activateSession(sessionId: string): void {
		setActiveSessionId(sessionId);
		ensureSessionTranscript(sessionId);
		syncActiveSelectionFromSession(sessionId);
		const session = sessions().find((item) => item.id === sessionId);
		if (session) {
			sessionHistory.markActive(sessionId);
			setSessions(sessionHistory.listSessions());
			setShellView("home");
			void runtime.syncSelection(sessionId, selectionForSession(session));
			if (session.runtimeSessionFile) {
				void runtime.loadSession(sessionId, selectionForSession(session), {
					runtimeSessionFile: session.runtimeSessionFile,
				});
			}
		}
		closeOverlay();
	}

	function startNewSession() {
		const provider = activeProfile();
		const created = sessionHistory.createSession({
			title: "New WEPsCLI chat",
			summary: provider ? `Chat ready with ${provider.label}.` : "Chat ready before provider selection.",
			state: "active",
			providerProfileId: provider?.id,
			providerLabel: provider?.label,
			modelId: activeModel(),
		});
		setSessions(sessionHistory.listSessions());
		setActiveSessionId(created.id);
		ensureSessionTranscript(created.id);
		setMessagesBySession((current) => ({
			...current,
			[created.id]: [
				{
					id: `${created.id}:system:0`,
					role: "system",
					content: provider ? `Ready with ${provider.label}${activeModel() ? ` / ${activeModel()}` : ""}` : "Connect a provider to start sending prompts.",
					time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
				},
			],
		}));
		setComposerValue("");
		composerRef?.focus();
		setFocusRegion("composer");
		requestRender();
		scheduleTranscriptScrollToBottom();
		return created;
	}

	function pushChatMessage(sessionId: string, message: ChatMessage): void {
		writeShellDebugLog(`pushChatMessage session=${sessionId} role=${message.role} content=${JSON.stringify(message.content)}`);
		setMessagesBySession((current) => {
			const next = appendSessionMessage(current, sessionId, message);
			writeShellDebugLog(`pushChatMessage nextCount=${next[sessionId]?.length ?? 0}`);
			return next;
		});
		requestRender();
	}

	function handleComposerSubmit(value: string): void {
		const trimmed = value.trim();
		writeShellDebugLog(`handleComposerSubmit raw=${JSON.stringify(value)} trimmed=${JSON.stringify(trimmed)}`);
		if (!trimmed) return;

		const session = currentSession() ?? startNewSession();
		writeShellDebugLog(`handleComposerSubmit currentSession=${session?.id ?? "none"}`);
		if (!session) {
			writeShellDebugLog("handleComposerSubmit no current session available");
			return;
		}

		if (trimmed.startsWith("/")) {
			writeShellDebugLog(`handleComposerSubmit slash=${trimmed}`);
			runSlashCommand(trimmed);
			return;
		}

		ensureSessionTranscript(session.id);
		sessionHistory.updateSession(session.id, {
			title: `Chat: ${truncate(trimmed, 24)}`,
			summary: `Last prompt: ${truncate(trimmed, 60)}`,
			providerProfileId: selectionForSession(session).profileId,
			providerLabel: activeProfile()?.label,
			modelId: selectionForSession(session).modelId,
			lastPrompt: trimmed,
			state: "active",
		});
		setSessions(sessionHistory.listSessions());
		writeShellDebugLog(`handleComposerSubmit sessionUpdated=${session.id}`);
		setComposerValue("");
		composerRef?.setText?.("");
		composerRef?.focus();
		void runtime.prompt(session.id, applyShellModePrompt(shellMode(), trimmed), selectionForSession(session), {
			runtimeSessionFile: session.runtimeSessionFile,
		});
		requestRender();
	}

	function runSlashCommand(commandId: string): void {
		executeSlashCommand(commandId, {
			startNewSession,
			openOverlay,
			openProviderAdd,
			compactCurrentSession,
			abortActiveRequest: () => {
				void abortActiveRequest();
			},
			setMode: (modeId) => applyShellMode(modeId),
			getCurrentMode: () => shellMode(),
			getStatusSummary: () => {
				const session = currentSession();
				const runtimeState = currentRuntimeState();
				return [
					"Current shell status:",
					`Session: ${session?.title ?? "none"}`,
					`Mode: ${activeShellMode().label}`,
					`Provider: ${activeProfile()?.label ?? "none"}`,
					`Model: ${activeModel() ?? "none"}`,
					`Runtime: ${runtimeState.label}`,
					`Agent dir: ${getAgentDir()}`,
				].join("\n");
			},
			queuePromptTemplate: (title: string, prompt: string, summary: string) => {
				const session = currentSession() ?? startNewSession();
				pushChatMessage(session.id, {
					id: `${session.id}:system:${Date.now()}`,
					role: "system",
					content: `${title}: ${summary}`,
					time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
				});
				setComposerValue(prompt);
				composerRef?.setText?.(prompt);
				composerRef?.focus();
				setFocusRegion("composer");
			},
			pushTimeline: (message: string) => {
				const session = currentSession() ?? startNewSession();
				pushChatMessage(session.id, {
					id: `${session.id}:system:${Date.now()}`,
					role: "system",
					content: message,
					time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
				});
			},
		});
	}

	function activateAction(actionId: string): void {
		if (actionId === "session:new") {
			startNewSession();
			return;
		}
		if (actionId === "overlay:provider") {
			openOverlay("provider");
			return;
		}
		if (actionId === "overlay:model") {
			openOverlay("model");
			return;
		}
		if (actionId === "overlay:session") {
			openOverlay("session");
			return;
		}
		if (actionId === "command-menu") {
			setComposerValue("/");
			composerRef?.setText?.("/");
			composerRef?.focus();
			setFocusRegion("composer");
			return;
		}
		if (actionId === "provider:add") {
			openProviderAdd();
			return;
		}
		if (actionId.startsWith("provider:")) {
			const profile = profiles().find((item) => item.id === actionId.slice(9));
			if (!profile) return;
			const nextModel = selection().profileId === profile.id ? selection().modelId ?? profile.models[0]?.id : profile.models[0]?.id;
			props.profileService.setActiveSelection(profile.id, nextModel);
			reloadProviderState();
			if (currentSession()) {
				sessionHistory.updateSession(currentSession()!.id, {
					providerProfileId: profile.id,
					providerLabel: profile.label,
					modelId: nextModel,
				});
				setSessions(sessionHistory.listSessions());
				void runtime.syncSelection(currentSession()!.id, selectionForSession(currentSession()!));
			}
			pushChatMessage(currentSession()?.id ?? createdTransientSessionId(), {
				id: `provider:${profile.id}:${Date.now()}`,
				role: "system",
				content: `Provider switched to ${profile.label}${nextModel ? ` / ${nextModel}` : ""}`,
				time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
			});
			closeOverlay();
			return;
		}
		if (actionId.startsWith("model-provider:")) {
			const profileId = actionId.slice("model-provider:".length);
			setModelPickerProfileId(profileId);
			setOverlay("model");
			setOverlayIndex(0);
			setFocusRegion("overlay");
			return;
		}
		if (actionId.startsWith("model:")) {
			const payload = actionId.slice(6);
			const separator = payload.indexOf(":");
			const profileId = separator === -1 ? selection().profileId ?? activeProfile()?.id : payload.slice(0, separator);
			const modelId = separator === -1 ? payload : payload.slice(separator + 1);
			const profile = profiles().find((item) => item.id === profileId);
			if (!profile) return;
			props.profileService.setActiveSelection(profile.id, modelId);
			reloadProviderState();
			if (currentSession()) {
				sessionHistory.updateSession(currentSession()!.id, {
					providerProfileId: profile.id,
					providerLabel: profile.label,
					modelId,
				});
				setSessions(sessionHistory.listSessions());
				void runtime.syncSelection(currentSession()!.id, selectionForSession(currentSession()!));
			}
			pushChatMessage(currentSession()?.id ?? createdTransientSessionId(), {
				id: `model:${modelId}:${Date.now()}`,
				role: "system",
				content: `Model switched to ${profile.label} / ${modelId}`,
				time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
			});
			closeOverlay();
			return;
		}
		if (actionId.startsWith("session:")) {
			activateSession(actionId.slice(8));
			return;
		}
	}

	function createdTransientSessionId(): string {
		const current = currentSession();
		if (current) return current.id;
		const created = sessionHistory.createSession({
			title: "Transient chat",
			summary: "Temporary chat session created while initializing.",
			state: "active",
			providerProfileId: activeProfile()?.id,
			providerLabel: activeProfile()?.label,
			modelId: activeModel(),
		});
		setSessions(sessionHistory.listSessions());
		setActiveSessionId(created.id);
		ensureSessionTranscript(created.id);
		return created.id;
	}

	const topStatus = createMemo(() => {
		const profile = activeProfile();
		const runtimeState = currentRuntimeState();
		if (!profile) return runtimeState.label;
		return `${profile.label} · ${activeModel() ?? "no model"} · ${runtimeState.label}`;
	});

	const sidebarSummary = createMemo(() => {
		if (!shellReady()) return "Complete onboarding to connect a provider.";
		return activeProfile()?.baseUrl ?? "Provider ready.";
	});

	function runtimeStatusColor(state: RuntimeSessionState): string {
		switch (runtimeStateTone(state)) {
			case "accent":
				return theme.accent;
			case "warning":
				return theme.warning;
			case "danger":
				return theme.danger;
			case "success":
				return theme.success;
			case "muted":
				return theme.muted;
		}
	}

	return (
		<box flexGrow={1} flexDirection="column" backgroundColor={theme.background}>
			<box flexShrink={0} backgroundColor={theme.header} paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1} flexDirection="row" justifyContent="space-between" gap={1}>
				<box flexDirection="row" gap={1} minWidth={0} flexGrow={1}>
					<text fg={theme.accentStrong}>{LOGO}</text>
					<text fg={theme.text}>{truncate(currentSession()?.title ?? "WEPsCLI", 28)}</text>
				</box>
				<box flexDirection="row" gap={1} alignItems="center">
					{currentRuntimeState().interruptible ? (
						<box backgroundColor={theme.danger} paddingLeft={1} paddingRight={1} onMouseUp={() => void abortActiveRequest()}>
							<text fg={theme.background}>Stop</text>
						</box>
					) : null}
					<text fg={runtimeStatusColor(currentRuntimeState())}>{truncate(topStatus(), 36)}</text>
				</box>
			</box>

			<box flexGrow={1} minHeight={0} flexDirection="row" gap={1} paddingLeft={1} paddingRight={1} paddingTop={1}>
				<TranscriptPanel
					messages={currentMessages()}
					activeModelLabel={`${activeProfile()?.label ?? "none"} / ${activeModel() ?? "none"}`}
					width={viewport().width}
					scrollRef={(ref) => {
						transcriptScroll = ref as typeof transcriptScroll;
					}}
					onToggleMessage={(messageId) => toggleTranscriptMessage(currentSession()!.id, messageId)}
				/>
			</box>

			<ChatComposer
				focused={focusRegion() === "composer"}
				value={composerValue()}
				providerLabel={activeProfile()?.label ?? "No provider"}
				modelLabel={activeModel() ?? "No model"}
				modeLabel={activeShellMode().composerLabel}
				modeTone={activeShellMode().tone}
				inputRef={(ref) => {
					composerRef = ref;
				}}
				onAction={activateAction}
				onFocus={() => setFocusRegion("composer")}
				onInput={(value) => setComposerValue(value)}
				onModeClick={() => applyShellMode(nextShellMode(shellMode()))}
				onSubmit={handleComposerSubmit}
				onSelectSlashCommand={runSlashCommand}
			/>

			{overlay() ? (
				<OverlayPicker
					title={overlayTitle(overlay())}
					description={overlayDescription(overlay())}
					options={overlayOptions()}
					selectedIndex={overlayIndex()}
					onClose={closeOverlay}
					onSelect={(id, index) => {
						setOverlayIndex(index);
						activateAction(id);
					}}
				/>
			) : null}

			{activeApproval() ? (
				<ApprovalOverlay
					request={activeApproval()!}
					selectedIndex={approvalDecisionIndex()}
					onSelectIndex={setApprovalDecisionIndex}
					onResolve={resolveActiveApproval}
				/>
			) : null}

			{providerAddFlow.render()}

			<box flexShrink={0} paddingLeft={1} paddingRight={1} paddingBottom={0} paddingTop={0} flexDirection="row">
				<text fg={theme.muted}>{truncate(getAgentDir(), 36)}</text>
			</box>
		</box>
	);
}
