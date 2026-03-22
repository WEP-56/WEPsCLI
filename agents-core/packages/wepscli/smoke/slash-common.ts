import assert from "node:assert/strict";
import { executeSlashCommand, getSlashCommands } from "../src/WEPSCLI-shell/slash-commands.ts";

const openedOverlays: string[] = [];
const pushedMessages: string[] = [];
let newSessionCalls = 0;

assert.ok(getSlashCommands("/h").some((command) => command.id === "/help"));
assert.ok(getSlashCommands("/st").some((command) => command.id === "/status"));
assert.ok(getSlashCommands("/re").some((command) => command.id === "/resume"));
assert.ok(getSlashCommands("/cl").some((command) => command.id === "/clear"));

const handlers = {
	startNewSession: () => {
		newSessionCalls += 1;
	},
	openOverlay: (kind: "provider" | "model" | "session") => {
		openedOverlays.push(kind);
	},
	openProviderAdd: () => {},
	compactCurrentSession: () => {},
	abortActiveRequest: () => {},
	setMode: () => {},
	getCurrentMode: () => "agent" as const,
	getStatusSummary: () => "Current shell status:\nProvider: test\nModel: model-1",
	queuePromptTemplate: () => {},
	pushTimeline: (message: string) => {
		pushedMessages.push(message);
	},
};

executeSlashCommand("/clear", handlers);
executeSlashCommand("/resume", handlers);
executeSlashCommand("/status", handlers);
executeSlashCommand("/help", handlers);

assert.equal(newSessionCalls, 1);
assert.equal(openedOverlays[0], "session");
assert.match(pushedMessages[0] ?? "", /Current shell status/);
assert.match(pushedMessages[1] ?? "", /Available slash commands:/);
assert.match(pushedMessages[1] ?? "", /\/help - Show a compact overview/);

console.log("SMOKE_SLASH_COMMON_OK");
