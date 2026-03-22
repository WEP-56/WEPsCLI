import { createEffect, createSignal } from "solid-js";
import { OverlayNotice, OverlayTextInput } from "./config-overlays.js";
import { OverlayPicker, type ComposerInputRef } from "./chat-components.js";
import { wrapIndex } from "./helpers.js";
import { fetchModelsForProfile, type DiscoveredModel, type ProviderFamily, type ProviderProfile, type ProviderProfileService } from "../provider-profiles/index.js";
import type { OverlayOption } from "./types.js";

export type ProviderAddStep = "family" | "label" | "baseUrl" | "apiKey" | "loading" | "model" | "manualModel";

export interface ProviderAddDraft {
	family?: ProviderFamily;
	label: string;
	baseUrl: string;
	apiKey: string;
	models: DiscoveredModel[];
	manualModel: string;
	error?: string;
}

export interface ProviderAddFlow {
	step: () => ProviderAddStep | undefined;
	draft: () => ProviderAddDraft;
	selectedIndex: () => number;
	open: () => void;
	close: () => void;
	back: () => void;
	isActive: () => boolean;
	isPickerStep: () => boolean;
	moveSelection: (delta: number) => void;
	confirmSelection: () => void;
	render: () => any;
}

function createEmptyProviderAddDraft(): ProviderAddDraft {
	return {
		label: "",
		baseUrl: "",
		apiKey: "",
		models: [],
		manualModel: "",
	};
}

function defaultBaseUrlForFamily(family: ProviderFamily): string {
	return family === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1";
}

export function createProviderAddFlow(options: {
	profileService: ProviderProfileService;
	onCreated: (info: { profile: ProviderProfile; modelId: string }) => void;
	onClose: () => void;
}): ProviderAddFlow {
	const [step, setStep] = createSignal<ProviderAddStep | undefined>(undefined);
	const [draft, setDraft] = createSignal<ProviderAddDraft>(createEmptyProviderAddDraft());
	const [selectedIndex, setSelectedIndex] = createSignal(0);
	const [requestId, setRequestId] = createSignal(0);
	let inputRef: ComposerInputRef | undefined;

	createEffect(() => {
		const currentStep = step();
		if (currentStep === "label" || currentStep === "baseUrl" || currentStep === "apiKey" || currentStep === "manualModel") {
			setTimeout(() => inputRef?.focus(), 0);
		}
	});

	function updateDraft(patch: Partial<ProviderAddDraft>): void {
		setDraft((current) => ({ ...current, ...patch }));
	}

	function pickerOptions(): OverlayOption[] {
		switch (step()) {
			case "family":
				return [
					{
						id: "provider-add-family:openai",
						label: "OpenAI-style",
						description: "For OpenAI-compatible and proxy endpoints.",
						badge: draft().family === "openai" ? "SELECTED" : undefined,
					},
					{
						id: "provider-add-family:anthropic",
						label: "Anthropic-style",
						description: "For Anthropic-compatible and proxy endpoints.",
						badge: draft().family === "anthropic" ? "SELECTED" : undefined,
					},
				];
			case "model":
				return draft().models.map((model) => ({
					id: `provider-add-model:${model.id}`,
					label: model.id,
					description: `${model.family} | ${model.name}`,
				}));
			default:
				return [];
		}
	}

	function close(): void {
		setStep(undefined);
		setDraft(createEmptyProviderAddDraft());
		setSelectedIndex(0);
		options.onClose();
	}

	function open(): void {
		setDraft(createEmptyProviderAddDraft());
		setSelectedIndex(0);
		setStep("family");
	}

	function back(): void {
		switch (step()) {
			case "family":
				close();
				return;
			case "label":
				setStep("family");
				setSelectedIndex(draft().family === "anthropic" ? 1 : 0);
				return;
			case "baseUrl":
				setStep("label");
				return;
			case "apiKey":
				setStep("baseUrl");
				return;
			case "model":
			case "manualModel":
				setStep("apiKey");
				return;
			case "loading":
				return;
			case undefined:
				return;
		}
	}

	function submitLabel(value: string): void {
		const trimmed = value.trim();
		if (!trimmed) {
			updateDraft({ error: "Provider label is required." });
			return;
		}
		updateDraft({ label: trimmed, error: undefined });
		setStep("baseUrl");
	}

	function submitBaseUrl(value: string): void {
		const trimmed = value.trim();
		if (!trimmed) {
			updateDraft({ error: "Base URL is required." });
			return;
		}
		try {
			const parsed = new URL(trimmed);
			if (!parsed.protocol.startsWith("http")) {
				updateDraft({ error: "Base URL must start with http:// or https://" });
				return;
			}
		} catch {
			updateDraft({ error: "Enter a valid absolute URL." });
			return;
		}
		updateDraft({ baseUrl: trimmed, error: undefined });
		setStep("apiKey");
	}

	async function fetchModels(apiKeyValue: string): Promise<void> {
		const currentDraft = draft();
		if (!currentDraft.family) {
			updateDraft({ error: "Choose a provider family first." });
			setStep("family");
			return;
		}

		const trimmedKey = apiKeyValue.trim();
		if (!trimmedKey) {
			updateDraft({ error: "API key is required." });
			return;
		}

		updateDraft({ apiKey: trimmedKey, error: undefined });
		setStep("loading");
		const currentRequestId = requestId() + 1;
		setRequestId(currentRequestId);

		try {
			const models = await fetchModelsForProfile(
				{
					id: "draft",
					label: currentDraft.label || "Draft provider",
					family: currentDraft.family,
					apiDialect: currentDraft.family === "anthropic" ? "anthropic-messages" : "openai-responses",
					baseUrl: currentDraft.baseUrl,
					enabled: true,
					models: [],
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					lastValidationStatus: "unknown",
				},
				trimmedKey,
			);

			if (requestId() !== currentRequestId) {
				return;
			}

			updateDraft({ models, error: undefined, manualModel: "" });
			setSelectedIndex(0);
			setStep("model");
		} catch (error) {
			if (requestId() !== currentRequestId) {
				return;
			}
			updateDraft({
				models: [],
				error: error instanceof Error ? error.message : String(error),
			});
			setStep("manualModel");
		}
	}

	function finalize(modelId: string, source: "fetched" | "manual"): void {
		const currentDraft = draft();
		if (!currentDraft.family) {
			updateDraft({ error: "Choose a provider family first." });
			setStep("family");
			return;
		}

		const normalizedModelId = modelId.trim();
		if (!normalizedModelId) {
			updateDraft({ error: "Model id is required." });
			return;
		}

		const profile = options.profileService.createProfile({
			label: currentDraft.label,
			family: currentDraft.family,
			baseUrl: currentDraft.baseUrl,
			apiKey: currentDraft.apiKey,
		});

		const models =
			source === "fetched"
				? currentDraft.models
				: [
						{
							id: normalizedModelId,
							name: normalizedModelId,
							family: currentDraft.family,
						},
					];

		options.profileService.replaceModels(
			profile.id,
			models,
			source === "fetched" ? { status: "ok" } : { status: "unknown", message: "Added with manual model entry." },
		);
		options.profileService.setActiveSelection(profile.id, normalizedModelId);
		options.onCreated({ profile, modelId: normalizedModelId });
		close();
	}

	function confirmSelection(): void {
		const target = pickerOptions()[selectedIndex()];
		if (!target) {
			return;
		}

		if (target.id.startsWith("provider-add-family:")) {
			const family = target.id.slice("provider-add-family:".length) as ProviderFamily;
			updateDraft({
				family,
				baseUrl: draft().baseUrl || defaultBaseUrlForFamily(family),
				error: undefined,
			});
			setStep("label");
			return;
		}

		if (target.id.startsWith("provider-add-model:")) {
			finalize(target.id.slice("provider-add-model:".length), "fetched");
		}
	}

	function moveSelection(delta: number): void {
		setSelectedIndex((current) => wrapIndex(current, delta, pickerOptions().length));
	}

	function render() {
		switch (step()) {
			case "family":
			case "model":
				return (
					<OverlayPicker
						title={step() === "family" ? "Add Provider: Family" : "Add Provider: Model"}
						description={
							step() === "family"
								? "Choose the provider family to start the guided setup."
								: "Choose one of the discovered models for the new provider."
						}
						options={pickerOptions()}
						selectedIndex={selectedIndex()}
						onClose={back}
						onSelect={(_id, index) => {
							setSelectedIndex(index);
							confirmSelection();
						}}
					/>
				);
			case "label":
				return (
					<OverlayTextInput
						title="Add Provider: Label"
						description="Choose the friendly name shown in provider and model pickers."
						label="Provider label"
						value={draft().label}
						placeholder="Example: My OpenAI Proxy"
						error={draft().error}
						inputRef={(ref) => {
							inputRef = ref;
						}}
						onInput={(value) => updateDraft({ label: value, error: undefined })}
						onSubmit={submitLabel}
						onClose={back}
					/>
				);
			case "baseUrl":
				return (
					<OverlayTextInput
						title="Add Provider: Base URL"
						description="WEPSCLI will use this URL exactly as entered. No silent normalization."
						label="Base URL"
						value={draft().baseUrl}
						placeholder="Example: https://your-provider.example.com/v1"
						error={draft().error}
						inputRef={(ref) => {
							inputRef = ref;
						}}
						onInput={(value) => updateDraft({ baseUrl: value, error: undefined })}
						onSubmit={submitBaseUrl}
						onClose={back}
					/>
				);
			case "apiKey":
				return (
					<OverlayTextInput
						title="Add Provider: API Key"
						description="The key is stored under ~/.wepscli/agent/auth.json and used only for this provider profile."
						label="API key"
						value={draft().apiKey}
						placeholder="Paste the API key for this provider"
						error={draft().error}
						hint="Enter fetch models | Esc back"
						inputRef={(ref) => {
							inputRef = ref;
						}}
						onInput={(value) => updateDraft({ apiKey: value, error: undefined })}
						onSubmit={(value) => {
							void fetchModels(value);
						}}
						onClose={back}
					/>
				);
			case "manualModel":
				return (
					<OverlayTextInput
						title="Add Provider: Manual Model"
						description="Model listing failed. Enter the model id manually to finish creating this provider."
						label="Model id"
						value={draft().manualModel}
						placeholder="Example: gpt-4.1 or claude-sonnet-4"
						error={draft().error}
						hint="Enter create provider | Esc back"
						inputRef={(ref) => {
							inputRef = ref;
						}}
						onInput={(value) => updateDraft({ manualModel: value, error: undefined })}
						onSubmit={(value) => {
							updateDraft({ manualModel: value, error: undefined });
							finalize(value, "manual");
						}}
						onClose={back}
					/>
				);
			case "loading":
				return (
					<OverlayNotice
						title="Add Provider: Fetching Models"
						description="WEPSCLI is probing the endpoint and loading available models for this provider."
						status={`Checking ${draft().label || "provider"} at ${draft().baseUrl}`}
						onClose={() => {}}
					/>
				);
			case undefined:
				return null;
		}
	}

	return {
		step,
		draft,
		selectedIndex,
		open,
		close,
		back,
		isActive: () => step() !== undefined,
		isPickerStep: () => step() === "family" || step() === "model",
		moveSelection,
		confirmSelection,
		render,
	};
}
