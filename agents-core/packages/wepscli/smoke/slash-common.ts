import assert from "node:assert/strict";
import { executeSlashCommand, getSlashCommands, shouldHandleSlashCommandLocally } from "../src/WEPSCLI-shell/slash-commands.ts";

const skillCommands = [{ id: "/skill:test-skill", label: "/skill:test-skill", description: "Test skill command" }];

const openedOverlays: string[] = [];
const pushedMessages: string[] = [];
let newSessionCalls = 0;
let retryCalls = 0;
let skillAddCalls = 0;
let reloadCalls = 0;

assert.ok(getSlashCommands("/h").some((command) => command.id === "/help"));
assert.ok(getSlashCommands("/st").some((command) => command.id === "/status"));
assert.ok(getSlashCommands("/re").some((command) => command.id === "/resume"));
assert.ok(getSlashCommands("/cl").some((command) => command.id === "/clear"));
assert.ok(getSlashCommands("/skills").some((command) => command.id === "/skills"));
assert.ok(getSlashCommands("/skill a").some((command) => command.id === "/skill add"));
assert.ok(getSlashCommands("/provider").some((command) => command.id === "/provider"));
assert.ok(getSlashCommands("/model").some((command) => command.id === "/model"));
assert.ok(getSlashCommands("/session").some((command) => command.id === "/session"));
assert.ok(getSlashCommands("/ret").some((command) => command.id === "/retry"));
assert.ok(getSlashCommands("/skill:t", skillCommands).some((command) => command.id === "/skill:test-skill"));
assert.equal(shouldHandleSlashCommandLocally("/skill:test"), false);
assert.equal(shouldHandleSlashCommandLocally("/skills"), true);

const handlers = {
	startNewSession: () => {
		newSessionCalls += 1;
	},
	retryLastPrompt: () => {
		retryCalls += 1;
	},
	openSkillAdd: () => {
		skillAddCalls += 1;
	},
	openOverlay: (kind: "provider" | "model" | "session") => {
		openedOverlays.push(kind);
	},
	openProviderAdd: () => {},
	compactCurrentSession: () => {},
	reloadCurrentSessionResources: () => {
		reloadCalls += 1;
	},
	abortActiveRequest: () => {},
	setMode: () => {},
	getCurrentMode: () => "agent" as const,
	getStatusSummary: () => "Current shell status:\nProvider: test\nModel: model-1",
	showSkillsSummary: () => {
		pushedMessages.push("Installed skills (1):\n- test-skill | D:\\skills\\test-skill\\SKILL.md");
	},
	queuePromptTemplate: () => {},
	pushTimeline: (message: string) => {
		pushedMessages.push(message);
	},
};

executeSlashCommand("/clear", handlers);
executeSlashCommand("/retry", handlers);
executeSlashCommand("/skills", handlers);
executeSlashCommand("/skills reload", handlers);
executeSlashCommand("/skill add", handlers);
executeSlashCommand("/provider", handlers);
executeSlashCommand("/model", handlers);
executeSlashCommand("/session", handlers);
executeSlashCommand("/resume", handlers);
executeSlashCommand("/status", handlers);
executeSlashCommand("/help", handlers);

assert.equal(newSessionCalls, 1);
assert.equal(retryCalls, 1);
assert.equal(skillAddCalls, 1);
assert.equal(reloadCalls, 1);
assert.deepEqual(openedOverlays, ["provider", "model", "session", "session"]);
assert.match(pushedMessages[0] ?? "", /Installed skills/);
assert.match(pushedMessages[1] ?? "", /Current shell status/);
assert.match(pushedMessages[2] ?? "", /Available slash commands:/);
assert.match(pushedMessages[2] ?? "", /\/help - Show a compact overview/);
assert.match(pushedMessages[2] ?? "", /\/retry - Resend the last prompt/);

console.log("SMOKE_SLASH_COMMON_OK");
