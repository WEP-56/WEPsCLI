import { createEffect, createSignal } from "solid-js";
import { OverlayNotice, OverlayTextInput } from "../WEPSCLI-shell/config-overlays.js";
import type { ComposerInputRef } from "../WEPSCLI-shell/chat-components.js";
import type { ResourceDiagnostic, Skill } from "./skill-service.js";
import { installSkillFromPath } from "./skill-service.js";

export interface SkillAddFlow {
	open: () => void;
	close: () => void;
	isActive: () => boolean;
	render: () => any;
}

export function createSkillAddFlow(options: {
	cwd?: string;
	agentDir?: string;
	onInstalled: (result: { skill: Skill; targetDir: string; diagnostics: ResourceDiagnostic[] }) => Promise<void> | void;
	onClose: () => void;
}): SkillAddFlow {
	const [active, setActive] = createSignal(false);
	const [pathValue, setPathValue] = createSignal("");
	const [error, setError] = createSignal<string | undefined>(undefined);
	const [installing, setInstalling] = createSignal(false);
	let inputRef: ComposerInputRef | undefined;

	createEffect(() => {
		if (active() && !installing()) {
			setTimeout(() => inputRef?.focus(), 0);
		}
	});

	function reset(): void {
		setPathValue("");
		setError(undefined);
		setInstalling(false);
	}

	function close(): void {
		setActive(false);
		reset();
		options.onClose();
	}

	function open(): void {
		setActive(true);
		reset();
	}

	async function submit(value: string): Promise<void> {
		const trimmed = value.trim();
		if (!trimmed) {
			setError("Enter a skill directory path or a SKILL.md path.");
			return;
		}

			setInstalling(true);
		setError(undefined);
		try {
			const result = await installSkillFromPath(trimmed, { cwd: options.cwd, agentDir: options.agentDir });
			await options.onInstalled({
				skill: result.skill,
				targetDir: result.targetDir,
				diagnostics: result.diagnostics,
			});
			close();
		} catch (installError) {
			setInstalling(false);
			setError(installError instanceof Error ? installError.message : String(installError));
		}
	}

	return {
		open,
		close,
		isActive: active,
		render: () =>
			!active() ? null : installing() ? (
				<OverlayNotice
					title="Install Skill"
					description="Copying the skill into the WEPSCLI skills directory and validating it."
					status="Installing skill..."
					onClose={() => {}}
				/>
			) : (
				<OverlayTextInput
					title="Install Skill"
					description="Enter a skill directory or SKILL.md path. WEPSCLI will copy the whole skill directory into ~/.wepscli/agent/skills."
					label="Skill path"
					value={pathValue()}
					placeholder="Example: D:\\skills\\my-skill or D:\\skills\\my-skill\\SKILL.md"
					error={error()}
					hint="Enter install | Esc cancel"
					inputRef={(ref) => {
						inputRef = ref;
					}}
					onInput={(nextValue) => {
						setPathValue(nextValue);
						setError(undefined);
					}}
					onSubmit={(nextValue) => {
						void submit(nextValue);
					}}
					onClose={close}
				/>
			),
	};
}
