import assert from "node:assert/strict";
import { createShellPromptController } from "../src/WEPSCLI-shell/shell-prompt-controller.ts";

const prompts: string[] = [];
const session = {
	id: "skill-routing-smoke",
	title: "Skill routing smoke",
	lastPrompt: undefined,
	runtimeSessionFile: "runtime.json",
};

const controller = createShellPromptController({
	currentSession: () => session,
	startNewSession: () => session,
	createdTransientSessionId: () => session.id,
	selectionForSession: () => ({ profileId: "provider-1", modelId: "model-1" }),
	ensureSessionTranscript: () => {},
	updatePromptSession: () => {},
	pushChatMessage: () => {},
	setComposerValue: () => {},
	setComposerText: () => {},
	focusComposer: () => {},
	setFocusRegionComposer: () => {},
	requestRender: () => {},
	runtimePrompt: (_sessionId, text) => {
		prompts.push(text);
	},
	reloadCurrentSessionResources: () => {},
	openSkillAdd: () => {
		throw new Error("skill add should not be called");
	},
	openOverlay: () => {
		throw new Error("overlay should not be called");
	},
	openProviderAdd: () => {
		throw new Error("provider add should not be called");
	},
	compactCurrentSession: () => {},
	abortActiveRequest: () => {},
	applyShellMode: () => {},
	getCurrentMode: () => "agent",
	getStatusSummary: () => "",
	showSkillsSummary: () => {},
});

controller.runSlashCommand("/skill:test-skill");

assert.equal(prompts[0], "/skill:test-skill");

console.log("SMOKE_SKILL_COMMAND_ROUTING_OK");
