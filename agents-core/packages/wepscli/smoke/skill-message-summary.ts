import assert from "node:assert/strict";
import { extractUserText } from "../src/WEPSCLI-shell/agent-runtime-helpers.ts";

const expandedSkillMessage = {
	content: `<skill name="playwright" location="/skills/playwright/SKILL.md">
References are relative to /skills/playwright.

# Playwright

Long instructions here.
</skill>

Take a screenshot of the homepage`,
} as any;

const skillOnlyMessage = {
	content: `<skill name="playwright" location="/skills/playwright/SKILL.md">
References are relative to /skills/playwright.

# Playwright

Long instructions here.
</skill>`,
} as any;

const plainMessage = {
	content: "Normal user prompt",
} as any;

assert.equal(extractUserText(expandedSkillMessage), "/skill:playwright\nTake a screenshot of the homepage");
assert.equal(extractUserText(skillOnlyMessage), "/skill:playwright");
assert.equal(extractUserText(plainMessage), "Normal user prompt");

console.log("SMOKE_SKILL_MESSAGE_SUMMARY_OK");
