import assert from "node:assert/strict";
import { WepsAgentRuntime } from "../src/WEPSCLI-shell/agent-runtime.ts";
import { executeSlashCommand, getSlashCommands } from "../src/WEPSCLI-shell/slash-commands.ts";
import { applyShellModePrompt, getShellMode, nextShellMode, shellModeHelpMessage } from "../src/WEPSCLI-shell/shell-modes.ts";

assert.equal(getShellMode("plan").composerLabel, "PLAN");
assert.equal(nextShellMode("agent"), "plan");
assert.match(shellModeHelpMessage("agent"), /\/mode auto-approve/);
assert.match(applyShellModePrompt("plan", "Inspect this bug"), /Plan mode is active/);
assert.match(applyShellModePrompt("plan", "Inspect this bug"), /User request:\nInspect this bug/);
assert.equal(applyShellModePrompt("agent", "Inspect this bug"), "Inspect this bug");

assert.ok(getSlashCommands("/mode").some((command) => command.id === "/mode plan"));

let selectedMode = "";
let timelineMessage = "";
executeSlashCommand("/mode plan", {
	startNewSession: () => {},
	openOverlay: () => {},
	openProviderAdd: () => {},
	compactCurrentSession: () => {},
	abortActiveRequest: () => {},
	setMode: (modeId) => {
		selectedMode = modeId;
	},
	getCurrentMode: () => "agent",
	queuePromptTemplate: () => {},
	pushTimeline: (message) => {
		timelineMessage = message;
	},
});
assert.equal(selectedMode, "plan");

executeSlashCommand("/mode", {
	startNewSession: () => {},
	openOverlay: () => {},
	openProviderAdd: () => {},
	compactCurrentSession: () => {},
	abortActiveRequest: () => {},
	setMode: () => {},
	getCurrentMode: () => "read-only",
	queuePromptTemplate: () => {},
	pushTimeline: (message) => {
		timelineMessage = message;
	},
});
assert.match(timelineMessage, /Current mode: Read Only/);

const messages: string[] = [];
let approvalsOpened = 0;
const runtime = new WepsAgentRuntime(
	{
		getActiveSelection: () => ({}),
		getProfile: () => undefined,
		getApiKey: () => undefined,
		listProfiles: () => [],
		setActiveSelection: () => {},
	} as any,
	{
		appendMessage: (_sessionId, message) => {
			messages.push(message.content);
		},
		insertMessageBefore: () => {},
		replaceMessages: () => {},
		patchMessage: () => {},
		openApproval: () => {
			approvalsOpened += 1;
		},
		closeApproval: () => {},
		updateRuntimeState: () => {},
		updateSessionBinding: () => {},
	},
);

const record = {
	toolMessageIds: new Map<string, string>(),
	toolStates: new Map(),
	activePrompts: 0,
	runtimeState: { phase: "idle", label: "Ready", interruptible: false, canContinue: true },
	sequence: 0,
} as any;

runtime.setMode("auto-approve");
const autoApproved = await (runtime as any).handleApprovalRequest("mode-smoke", record, "call-1", "write", {
	path: "docs/out.md",
	content: "hello",
});
assert.equal(autoApproved, undefined);
assert.equal(approvalsOpened, 0);
assert.match(messages.at(-1) ?? "", /Auto-approved write/);

runtime.setMode("read-only");
const blocked = await (runtime as any).handleApprovalRequest("mode-smoke", record, "call-2", "edit", {
	path: "docs/out.md",
	oldText: "a",
	newText: "b",
});
assert.equal(blocked?.block, true);
assert.match(blocked?.reason ?? "", /read-only mode/);
assert.match(messages.at(-1) ?? "", /blocked because read-only mode is active/i);

console.log("SMOKE_MODE_LAYER_OK");
