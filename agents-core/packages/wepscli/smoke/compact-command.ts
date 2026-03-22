import assert from "node:assert/strict";
import { WepsAgentRuntime } from "../src/WEPSCLI-shell/agent-runtime.ts";
import { executeSlashCommand, getSlashCommands } from "../src/WEPSCLI-shell/slash-commands.ts";
import type { RuntimeSessionState } from "../src/WEPSCLI-shell/runtime-status.ts";

const runtimeStates: RuntimeSessionState[] = [];
const systemMessages: string[] = [];
let compactCalls = 0;
let compactHandlerCalls = 0;

const runtime = new WepsAgentRuntime(
	{
		getActiveSelection: () => ({ profileId: "provider-1", modelId: "model-1" }),
		getProfile: () => ({
			id: "provider-1",
			label: "Provider 1",
			family: "openai",
			apiDialect: "openai",
			baseUrl: "https://example.com",
			enabled: true,
			models: [{ id: "model-1", name: "Model 1", family: "openai" }],
			createdAt: "",
			updatedAt: "",
			lastValidationStatus: "ok",
		}),
		getApiKey: () => "test-key",
		listProfiles: () => [],
		setActiveSelection: () => {},
	} as any,
	{
		appendMessage: (_sessionId, message) => {
			systemMessages.push(message.content);
		},
		insertMessageBefore: () => {},
		replaceMessages: () => {},
		patchMessage: () => {},
		openApproval: () => {},
		closeApproval: () => {},
		updateRuntimeState: (_sessionId, state) => {
			runtimeStates.push(state);
		},
		updateSessionBinding: () => {},
	},
);

const sessionId = "compact-command-smoke";
(runtime as any).records.set(sessionId, {
	session: {
		compact: async () => {
			compactCalls += 1;
			return {
				summary: "Compacted summary",
				firstKeptEntryId: "entry-1",
				tokensBefore: 12345,
			};
		},
		abort: async () => {},
		abortCompaction: () => {},
	},
	unsubscribe: () => {},
	removeBeforeToolCallHook: () => {},
	modelRegistry: {},
	authStorage: {},
	activeProfileId: "provider-1",
	activeModelId: "model-1",
	toolMessageIds: new Map(),
	toolStates: new Map(),
	activePrompts: 0,
	runtimeState: {
		phase: "idle",
		label: "Ready",
		interruptible: false,
		canContinue: true,
	},
	sequence: 0,
} as any);

const compacted = await runtime.compact(sessionId, { profileId: "provider-1", modelId: "model-1" });
assert.equal(compacted, true);
assert.equal(compactCalls, 1);
assert.equal(runtimeStates[0]?.phase, "compacting");
assert.equal(runtimeStates.at(-1)?.phase, "idle");
assert.match(systemMessages.at(-1) ?? "", /12,345/);

assert.ok(getSlashCommands("/comp").some((command) => command.id === "/compact"));

executeSlashCommand("/compact", {
	startNewSession: () => {},
	openOverlay: () => {},
	openProviderAdd: () => {},
	compactCurrentSession: () => {
		compactHandlerCalls += 1;
	},
	abortActiveRequest: () => {},
	queuePromptTemplate: () => {},
	pushTimeline: () => {},
});

assert.equal(compactHandlerCalls, 1);

console.log("SMOKE_COMPACT_COMMAND_OK");
