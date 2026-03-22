import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { getAgentDir, getSkillsDir } from "../config.js";

export interface ResourceDiagnostic {
	type: string;
	message: string;
	path?: string;
}

export interface Skill {
	name: string;
	description: string;
	filePath: string;
	baseDir: string;
	source: string;
	disableModelInvocation: boolean;
}

export interface LoadSkillsResult {
	skills: Skill[];
	diagnostics: ResourceDiagnostic[];
}

export interface InstalledSkillResult {
	skill: Skill;
	sourceDir: string;
	targetDir: string;
	diagnostics: ResourceDiagnostic[];
}

type CodingAgentSkillModule = {
	loadSkillsFromDir(options: { dir: string; source: string }): LoadSkillsResult;
};

let skillModulePromise: Promise<CodingAgentSkillModule> | undefined;

async function loadSkillModule(): Promise<CodingAgentSkillModule> {
	if (!skillModulePromise) {
		skillModulePromise = import("@mariozechner/pi-coding-agent").then((module) => module as unknown as CodingAgentSkillModule);
	}
	return skillModulePromise;
}

function normalizePath(input: string): string {
	const trimmed = input.trim();
	if (trimmed === "~") {
		return homedir();
	}
	if (trimmed.startsWith("~/")) {
		return resolve(homedir(), trimmed.slice(2));
	}
	return trimmed;
}

function resolveInputPath(input: string, cwd: string): string {
	const normalized = normalizePath(input);
	return isAbsolute(normalized) ? normalized : resolve(cwd, normalized);
}

function resolveSkillSourceDir(pathValue: string, cwd: string): string {
	const resolved = resolveInputPath(pathValue, cwd);
	if (!existsSync(resolved)) {
		throw new Error(`Skill path does not exist: ${resolved}`);
	}

	const stats = statSync(resolved);
	if (stats.isDirectory()) {
		if (!existsSync(join(resolved, "SKILL.md"))) {
			throw new Error(`Skill directory must contain SKILL.md: ${resolved}`);
		}
		return resolved;
	}

	if (stats.isFile() && resolved.endsWith("SKILL.md")) {
		return dirname(resolved);
	}

	throw new Error(`Path must point to a skill directory or SKILL.md: ${resolved}`);
}

async function validateSkillSource(sourceDir: string): Promise<{ skill: Skill; diagnostics: ResourceDiagnostic[] }> {
	const result = (await loadSkillModule()).loadSkillsFromDir({ dir: sourceDir, source: "path" });
	const skill = result.skills.find((item) => resolve(item.filePath) === resolve(join(sourceDir, "SKILL.md")));
	if (!skill) {
		const detail = result.diagnostics[0]?.message;
		throw new Error(detail ? `Skill validation failed: ${detail}` : `No valid skill found in ${sourceDir}`);
	}
	return { skill, diagnostics: result.diagnostics };
}

export async function listInstalledSkills(agentDir: string = getAgentDir()): Promise<LoadSkillsResult> {
	return (await loadSkillModule()).loadSkillsFromDir({ dir: getSkillsDir(agentDir), source: "user" });
}

export async function formatInstalledSkillsSummary(agentDir: string = getAgentDir()): Promise<string> {
	const result = await listInstalledSkills(agentDir);
	if (result.skills.length === 0 && result.diagnostics.length === 0) {
		return `No skills are installed in ${getSkillsDir(agentDir)}.`;
	}

	const lines = [`Installed skills (${result.skills.length}):`];
	for (const skill of result.skills) {
		lines.push(`- ${skill.name} | ${skill.filePath}`);
		lines.push(`  ${skill.description}`);
	}
	if (result.diagnostics.length > 0) {
		lines.push("");
		lines.push("Diagnostics:");
		for (const diagnostic of result.diagnostics) {
			lines.push(`- ${diagnostic.type}: ${diagnostic.message}${diagnostic.path ? ` | ${diagnostic.path}` : ""}`);
		}
	}
	return lines.join("\n");
}

export async function installSkillFromPath(
	pathValue: string,
	options: { cwd?: string; agentDir?: string } = {},
): Promise<InstalledSkillResult> {
	const cwd = options.cwd ?? process.cwd();
	const agentDir = options.agentDir ?? getAgentDir();
	const sourceDir = resolveSkillSourceDir(pathValue, cwd);
	const { skill, diagnostics } = await validateSkillSource(sourceDir);
	const skillsDir = getSkillsDir(agentDir);
	const targetDir = join(skillsDir, skill.name);

	mkdirSync(skillsDir, { recursive: true });
	if (existsSync(targetDir)) {
		throw new Error(`A skill named ${skill.name} is already installed at ${targetDir}`);
	}

	let copied = false;
	try {
		cpSync(sourceDir, targetDir, { recursive: true, force: false, errorOnExist: true });
		copied = true;
		const installed = await validateSkillSource(targetDir);
		return {
			skill: installed.skill,
			sourceDir,
			targetDir,
			diagnostics: [...diagnostics, ...installed.diagnostics],
		};
	} catch (error) {
		if (copied) {
			rmSync(targetDir, { recursive: true, force: true });
		}
		throw error;
	}
}
