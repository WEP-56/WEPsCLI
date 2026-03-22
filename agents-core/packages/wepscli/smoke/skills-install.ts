import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { formatInstalledSkillsSummary, installSkillFromPath, listInstalledSkills } from "../src/skills/skill-service.ts";

const root = mkdtempSync(join(tmpdir(), "wepscli-skill-"));
const sourceDir = join(root, "test-skill");
const agentDir = join(root, "agent");
mkdirSync(sourceDir, { recursive: true });

writeFileSync(
	join(sourceDir, "SKILL.md"),
	`---
name: test-skill
description: Test skill for install smoke.
---

# Test Skill

Use this skill when testing skill installation.
`,
	"utf8",
);
writeFileSync(join(sourceDir, "helper.txt"), "helper asset", "utf8");

const installed = await installSkillFromPath(sourceDir, { cwd: root, agentDir });
assert.equal(installed.skill.name, "test-skill");

const listed = await listInstalledSkills(agentDir);
assert.equal(listed.skills[0]?.name, "test-skill");
assert.match(await formatInstalledSkillsSummary(agentDir), /test-skill/);

await assert.rejects(() => installSkillFromPath(sourceDir, { cwd: root, agentDir }), /already installed/i);

console.log("SMOKE_SKILLS_INSTALL_OK");
