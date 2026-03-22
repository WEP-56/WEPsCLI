import type { SlashCommandItem } from "./types.js";
import type { Skill } from "../skills/skill-service.js";

export function buildSkillSlashCommands(skills: Skill[]): SlashCommandItem[] {
	return skills.map((skill) => ({
		id: `/skill:${skill.name}`,
		label: `/skill:${skill.name}`,
		description: skill.description,
	}));
}
