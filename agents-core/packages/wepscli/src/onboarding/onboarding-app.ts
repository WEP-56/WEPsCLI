import { Container, getKeybindings, type SelectItem, Spacer, Text, type TUI } from "@mariozechner/pi-tui";
import { fetchModelsForProfile, type DiscoveredModel, getDefaultDialect, ProviderProfileService } from "../provider-profiles/index.js";
import type { ProviderFamily, ProviderProfile } from "../provider-profiles/types.js";
import { ActionScreen } from "./action-screen.js";
import { FramedScreen, type WizardScreen } from "./framed-screen.js";
import { SelectScreen } from "./select-screen.js";
import { SummaryScreen } from "./summary-screen.js";
import { onboardingTheme } from "./theme.js";
import { TextInputScreen } from "./text-input-screen.js";

interface OnboardingDraft {
	family?: ProviderFamily;
	label: string;
	baseUrl: string;
	apiKey: string;
	probeModels?: DiscoveredModel[];
	fetchedModels: DiscoveredModel[];
	selectedModel?: DiscoveredModel;
	selectedModelSource?: "fetched" | "manual";
}

export class OnboardingApp extends Container {
	private readonly draft: OnboardingDraft = {
		label: "",
		baseUrl: "",
		apiKey: "",
		fetchedModels: [],
	};
	private currentScreen: WizardScreen | undefined;

	constructor(
		private readonly ui: TUI,
		private readonly profiles: ProviderProfileService,
		private readonly onComplete: (profile: ProviderProfile) => void,
		private readonly onAbort: () => void,
	) {
		super();
		this.showWelcome();
	}

	private setScreen(screen: WizardScreen): void {
		this.clear();
		this.currentScreen = screen;
		this.addChild(screen);
		this.ui.setFocus(screen.getFocusTarget());
		this.ui.requestRender();
	}

	private buildTemporaryProfile(): ProviderProfile {
		if (!this.draft.family) {
			throw new Error("Provider family is not set");
		}

		const now = new Date().toISOString();
		return {
			id: "draft",
			label: this.draft.label || "Draft profile",
			family: this.draft.family,
			apiDialect: getDefaultDialect(this.draft.family),
			baseUrl: this.draft.baseUrl,
			enabled: true,
			models: [],
			createdAt: now,
			updatedAt: now,
			lastValidationStatus: "unknown",
		};
	}

	private showWelcome(): void {
		const screen = new (class extends FramedScreen {
			constructor(onContinue: () => void, onAbort: () => void) {
				super("Step 1/8", "Welcome to WEPSCLI", "A guided first-run setup is required before entering the app.");
				this.content.addChild(new Text(onboardingTheme.text("This wizard will create your first provider profile."), 0, 0));
				this.content.addChild(new Spacer(1));
				this.content.addChild(
					new Text(
						onboardingTheme.muted("You will choose a provider family, enter a base URL and API key, test the endpoint, and select a model."),
						0,
						0,
					),
				);
				this.setFooter("Enter continue | Esc quit");
				this.handleInput = (data: string) => {
					const keybindings = getKeybindings();
					if (keybindings.matches(data, "tui.select.confirm")) {
						onContinue();
						return;
					}
					if (keybindings.matches(data, "tui.select.cancel")) {
						onAbort();
					}
				};
			}
		})(() => this.showFamilySelect(), this.onAbort);

		this.setScreen(screen);
	}

	private showFamilySelect(): void {
		const items: SelectItem[] = [
			{ value: "openai", label: "OpenAI-style", description: "For third-party endpoints that expose an OpenAI-compatible API." },
			{ value: "anthropic", label: "Anthropic-style", description: "For third-party endpoints that expose an Anthropic-compatible API." },
		];

		this.setScreen(
			new SelectScreen({
				stepLabel: "Step 2/8",
				title: "Choose provider family",
				description: "This decides which model-listing request shape WEPSCLI will use.",
				items,
				onSelect: (item) => {
					this.draft.family = item.value as ProviderFamily;
					this.showLabelInput();
				},
				onBack: () => this.showWelcome(),
			}),
		);
	}

	private showLabelInput(): void {
		this.setScreen(
			new TextInputScreen({
				stepLabel: "Step 3/8",
				title: "Provider label",
				description: "This is the friendly name shown inside WEPSCLI when you switch providers.",
				label: "Label",
				initialValue: this.draft.label,
				placeholder: "Example: My OpenAI Proxy",
				validate: (value) => (!value ? "Provider label is required." : undefined),
				onSubmit: (value) => {
					this.draft.label = value;
					this.showBaseUrlInput();
				},
				onBack: () => this.showFamilySelect(),
			}),
		);
	}

	private showBaseUrlInput(): void {
		this.setScreen(
			new TextInputScreen({
				stepLabel: "Step 4/8",
				title: "Base URL",
				description: "WEPSCLI will use this value exactly as entered. No automatic /v1 normalization will be applied.",
				label: "Base URL",
				initialValue: this.draft.baseUrl,
				placeholder: "Example: https://your-provider.example.com/v1",
				validate: (value) => {
					if (!value) return "Base URL is required.";
					try {
						const parsed = new URL(value);
						if (!parsed.protocol.startsWith("http")) {
							return "Base URL must start with http:// or https://";
						}
						return undefined;
					} catch {
						return "Enter a valid absolute URL.";
					}
				},
				onSubmit: (value) => {
					this.draft.baseUrl = value;
					this.showApiKeyInput();
				},
				onBack: () => this.showLabelInput(),
			}),
		);
	}

	private showApiKeyInput(): void {
		this.setScreen(
			new TextInputScreen({
				stepLabel: "Step 5/8",
				title: "API key",
				description: "The key is stored in ~/.wepscli/agent/auth.json in plain text, as previously agreed.",
				label: "API key",
				initialValue: this.draft.apiKey,
				placeholder: "Paste the API key for this provider profile",
				validate: (value) => (!value ? "API key is required." : undefined),
				onSubmit: (value) => {
					this.draft.apiKey = value;
					this.showConnectionTest();
				},
				onBack: () => this.showBaseUrlInput(),
			}),
		);
	}

	private showConnectionTest(): void {
		this.setScreen(
			new ActionScreen({
				stepLabel: "Step 6/8",
				title: "Connection test",
				description: "This checks whether the endpoint responds to the selected provider family and credentials.",
				idleMessage: "WEPSCLI will attempt a model-list request as a connectivity probe.",
				run: async () => {
					try {
						const models = await fetchModelsForProfile(this.buildTemporaryProfile(), this.draft.apiKey);
						this.draft.probeModels = models;
						return {
							ok: true,
							message: `Connection test succeeded. ${models.length} model(s) were discovered during the probe.`,
						};
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						this.draft.probeModels = undefined;
						return {
							ok: false,
							message,
						};
					}
				},
				formatResult: (result) => ({
					message: result.ok ? onboardingTheme.success(result.message) : onboardingTheme.error(result.message),
					detail: result.ok
						? "Press Enter to continue to model fetching."
						: "Press Enter to continue anyway or Esc to go back.",
				}),
				onContinue: () => this.showModelFetch(),
				onBack: () => this.showApiKeyInput(),
				requestRender: () => this.ui.requestRender(),
			}),
		);
	}

	private showModelFetch(): void {
		this.setScreen(
			new ActionScreen({
				stepLabel: "Step 7/8",
				title: "Fetch models",
				description: "This step loads models for selection. If it fails, WEPSCLI will let you enter one manually.",
				idleMessage: "Press Enter to fetch models for this provider profile.",
				run: async () => {
					try {
						const models =
							this.draft.probeModels && this.draft.probeModels.length > 0
								? this.draft.probeModels
								: await fetchModelsForProfile(this.buildTemporaryProfile(), this.draft.apiKey);
						this.draft.fetchedModels = models;
						return {
							ok: true,
							models,
							message: `Fetched ${models.length} model(s).`,
						};
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						this.draft.fetchedModels = [];
						return {
							ok: false,
							models: [] as DiscoveredModel[],
							message,
						};
					}
				},
				formatResult: (result) => ({
					message: result.ok ? onboardingTheme.success(result.message) : onboardingTheme.error(result.message),
					detail: result.ok
						? "Press Enter to pick a model from the list."
						: "Press Enter to switch to manual model entry or Esc to go back.",
				}),
				onContinue: (result) => {
					if (result.ok && result.models.length > 0) {
						this.showModelSelect();
						return;
					}
					this.showManualModelInput();
				},
				onBack: () => this.showConnectionTest(),
				requestRender: () => this.ui.requestRender(),
			}),
		);
	}

	private showModelSelect(): void {
		const items: SelectItem[] = [
			...this.draft.fetchedModels.map((model) => ({
				value: model.id,
				label: model.name,
				description: model.id,
			})),
			{
				value: "__manual__",
				label: "Enter model manually",
				description: "Use this if the fetched list is incomplete or you prefer to type the model id yourself.",
			},
		];

		this.setScreen(
			new SelectScreen({
				stepLabel: "Step 7/8",
				title: "Choose default model",
				description: "Select a discovered model or switch to manual entry.",
				items,
				onSelect: (item) => {
					if (item.value === "__manual__") {
						this.showManualModelInput();
						return;
					}
					const selected = this.draft.fetchedModels.find((model) => model.id === item.value);
					if (!selected) {
						throw new Error(`Unknown model selection: ${item.value}`);
					}
					this.draft.selectedModel = selected;
					this.draft.selectedModelSource = "fetched";
					this.showReview();
				},
				onBack: () => this.showModelFetch(),
			}),
		);
	}

	private showManualModelInput(): void {
		this.setScreen(
			new TextInputScreen({
				stepLabel: "Step 7/8",
				title: "Manual model entry",
				description: "Use this when the provider does not return a model list or you prefer to type the model id directly.",
				label: "Model id",
				initialValue: this.draft.selectedModel?.id,
				placeholder: "Example: gpt-4.1, claude-3-7-sonnet, or your provider-specific model id",
				validate: (value) => (!value ? "Model id is required." : undefined),
				onSubmit: (value) => {
					this.draft.selectedModel = {
						id: value,
						name: value,
						family: this.draft.family!,
					};
					this.draft.selectedModelSource = "manual";
					this.showReview();
				},
				onBack: () => (this.draft.fetchedModels.length > 0 ? this.showModelSelect() : this.showModelFetch()),
			}),
		);
	}

	private showReview(): void {
		const selectedModel = this.draft.selectedModel;
		if (!selectedModel || !this.draft.family) {
			throw new Error("Onboarding review requires a selected provider family and model.");
		}

		this.setScreen(
			new SummaryScreen({
				stepLabel: "Step 8/8",
				title: "Confirm and save",
				description: "This will create the provider profile, store the API key, and make the selected model active.",
				summaryLines: [
					`Label: ${this.draft.label}`,
					`Family: ${this.draft.family}`,
					`Base URL: ${this.draft.baseUrl}`,
					`Model: ${selectedModel.id}`,
					`Fetched models: ${this.draft.fetchedModels.length > 0 ? String(this.draft.fetchedModels.length) : "manual only"}`,
				],
				onConfirm: () => this.finishOnboarding(),
				onBack: () => (this.draft.selectedModelSource === "fetched" ? this.showModelSelect() : this.showManualModelInput()),
			}),
		);
	}

	private finishOnboarding(): void {
		if (!this.draft.family || !this.draft.selectedModel) {
			throw new Error("Onboarding is missing required selections.");
		}

		const profile = this.profiles.createProfile({
			label: this.draft.label,
			family: this.draft.family,
			baseUrl: this.draft.baseUrl,
			apiKey: this.draft.apiKey,
			apiDialect: getDefaultDialect(this.draft.family),
		});

		const modelsToStore =
			this.draft.fetchedModels.length > 0
				? this.draft.fetchedModels
				: [this.draft.selectedModel];

		this.profiles.replaceModels(profile.id, modelsToStore, {
			status: this.draft.fetchedModels.length > 0 ? "ok" : "unknown",
		});
		this.profiles.setActiveSelection(profile.id, this.draft.selectedModel.id);

		const saved = this.profiles.getProfile(profile.id);
		if (!saved) {
			throw new Error("Failed to reload the saved provider profile.");
		}

		this.onComplete(saved);
	}
}
