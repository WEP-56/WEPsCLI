import { visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import { computeCenteredRect, computeWorkbenchLayout, fitLines, framePanelFixed, joinColumns, padLine, type Rect } from "./render.js";
import { getPanelStyle, pulseDot, sweepText, workbenchTheme } from "./theme.js";
import type {
	ButtonSpec,
	ClickRegion,
	LocalRegion,
	RenderedButtons,
	RenderWorkbenchResult,
	RenderWorkbenchState,
	WorkbenchCard,
} from "./types.js";

export function renderWorkbench(state: RenderWorkbenchState): RenderWorkbenchResult {
	const layout = computeWorkbenchLayout(state.width, state.height);
	const bodyStartRow = layout.headerHeight + 1;

	const header = renderHeader(state, layout.headerHeight);
	const body = renderBody(state, layout, bodyStartRow);
	const dockStartRow = bodyStartRow + layout.bodyHeight;
	const dock = state.showDock
		? renderDock(state, state.width, layout.dockHeight, dockStartRow)
		: {
				lines: fitLines([padLine(sweepText("Preparing bottom dock...", state.frame + 6), state.width)], state.width, layout.dockHeight),
				dockRegions: [],
				composerRegion: undefined,
			};

	const lines = [...header.lines, ...body.lines, ...dock.lines];
	if (!state.overlay) {
		return {
			lines,
			toolbarRegions: header.toolbarRegions,
			railRegions: body.railRegions,
			mainRegions: body.mainRegions,
			dockRegions: dock.dockRegions,
			overlayRegions: [],
			composerRegion: dock.composerRegion,
		};
	}

	const overlay = compositeOverlay(state, lines);
	return {
		lines: overlay.lines,
		toolbarRegions: header.toolbarRegions,
		railRegions: body.railRegions,
		mainRegions: body.mainRegions,
		dockRegions: dock.dockRegions,
		overlayRegions: overlay.overlayRegions,
		composerRegion: dock.composerRegion,
	};
}

function renderHeader(state: RenderWorkbenchState, height: number): { lines: string[]; toolbarRegions: ClickRegion[] } {
	const toolbar = renderButtons(
		state,
		[
			{ id: "session:new", label: state.width < 96 ? "New" : "New Session", variant: "primary" },
			{ id: "overlay:provider-switch", label: state.width < 96 ? "Provider" : "Providers", variant: "active" },
			{ id: "overlay:model-switch", label: state.width < 96 ? "Model" : "Models", variant: "secondary" },
			{ id: "nav:history", label: state.width < 96 ? "Recent" : "History", variant: "secondary" },
		],
		state.width - 2,
	);

	const toolbarRegions = toolbar.regions.map((region) => ({
		group: "toolbar" as const,
		id: region.id,
		row: 2 + region.row,
		col: 2 + region.col,
		width: region.width,
		height: region.height,
	}));

	const statusLine = [
		sweepText("WEPSCLI WORKBENCH", state.frame),
		workbenchTheme.muted(`view ${state.getViewLabel(state.view)}`),
		workbenchTheme.accent(state.activeProfile?.label ?? "no provider"),
		workbenchTheme.muted(state.activeSelection.modelId ?? "no model"),
	].join(workbenchTheme.muted("  |  "));

	const lines = [
		workbenchTheme.headerBackground(padLine(` ${statusLine} `, state.width)),
		workbenchTheme.headerBackground(padLine(` ${toolbar.lines[0] ?? ""} `, state.width)),
	];

	if (height >= 3) {
		const thirdLine =
			toolbar.lines[1] ??
			workbenchTheme.muted(" Tab focus  |  Enter select  |  h home  p providers  m models  s sessions ");
		lines.push(workbenchTheme.headerBackground(padLine(` ${thirdLine} `, state.width)));
	}

	return {
		lines: fitLines(lines, state.width, height),
		toolbarRegions,
	};
}

function renderBody(
	state: RenderWorkbenchState,
	layout: ReturnType<typeof computeWorkbenchLayout>,
	bodyStartRow: number,
): { lines: string[]; railRegions: ClickRegion[]; mainRegions: ClickRegion[] } {
	const columns: string[][] = [];
	const widths: number[] = [];
	const railRegions: ClickRegion[] = [];
	let mainRegions: ClickRegion[] = [];
	let currentCol = 1;

	if (layout.showRail) {
		const rail = renderRailPanel(state, layout.railWidth, layout.bodyHeight, bodyStartRow, currentCol);
		columns.push(rail.lines);
		widths.push(layout.railWidth);
		railRegions.push(...rail.railRegions);
		currentCol += layout.railWidth + layout.gap;
	}

	const main = state.showBody
		? renderMainPanel(state, layout.mainWidth, layout.bodyHeight, bodyStartRow, currentCol)
		: {
				lines: fitLines([padLine(sweepText("Booting main workbench surface...", state.frame), layout.mainWidth)], layout.mainWidth, layout.bodyHeight),
				mainRegions: [],
			};
	columns.push(main.lines);
	widths.push(layout.mainWidth);
	mainRegions = main.mainRegions;
	currentCol += layout.mainWidth + layout.gap;

	if (layout.showInspector) {
		const inspector = state.showInspector
			? renderInspectorPanel(state, layout.inspectorWidth, layout.bodyHeight)
			: fitLines(
					[padLine(sweepText("Preparing inspector status surfaces...", state.frame + 3), layout.inspectorWidth)],
					layout.inspectorWidth,
					layout.bodyHeight,
				);
		columns.push(inspector);
		widths.push(layout.inspectorWidth);
	}

	let joined = columns[0] ?? [];
	for (let i = 1; i < columns.length; i += 1) {
		joined = joinColumns(joined, widths[i - 1]!, columns[i]!, widths[i]!, layout.gap);
	}

	return {
		lines: fitLines(joined, state.width, layout.bodyHeight),
		railRegions,
		mainRegions,
	};
}

function renderRailPanel(
	state: RenderWorkbenchState,
	width: number,
	height: number,
	startRow: number,
	startCol: number,
): { lines: string[]; railRegions: ClickRegion[] } {
	const innerWidth = Math.max(1, width - 2);
	const body: string[] = [];
	const railRegions: ClickRegion[] = [];

	body.push(workbenchTheme.accent("Navigation"));
	for (const [index, item] of state.railItems.entries()) {
		const isActive = state.view === item.id;
		const isSelected = state.focusRegion === "rail" && state.railSelectionIndex === index;
		const button = state.styleButton(item.label, isActive ? "active" : isSelected ? "primary" : "secondary");
		const buttonRow = body.length;
		body.push(button);
		body.push(workbenchTheme.muted(item.description));
		body.push("");
		railRegions.push({
			group: "rail",
			id: `nav:${item.id}`,
			row: startRow + 1 + buttonRow,
			col: startCol + 1,
			width: visibleWidth(button),
			height: 1,
		});
	}

	body.push(workbenchTheme.accent(`Quick Launch ${workbenchTheme.accentSoft(`[${pulseDot(state.frame)}]`)}`));
	const quickButtons = renderButtons(
		state,
		[
			{ id: "overlay:provider-switch", label: "Provider Dialog", variant: "primary" },
			{ id: "overlay:model-switch", label: "Model Dialog", variant: "secondary" },
			{ id: "session:new", label: "New Task", variant: "success" },
		],
		innerWidth,
	);
	const quickStartRow = body.length;
	body.push(...quickButtons.lines);
	body.push("");
	body.push(workbenchTheme.muted("Use the rail or the toolbar. No hidden panel-sized hit areas."));

	railRegions.push(
		...quickButtons.regions.map((region) => ({
			group: "rail" as const,
			id: region.id,
			row: startRow + 1 + quickStartRow + region.row,
			col: startCol + 1 + region.col,
			width: region.width,
			height: region.height,
		})),
	);

	return {
		lines: framePanelFixed(
			state.focusRegion === "rail" ? "Left Rail [active]" : "Left Rail",
			body.map((line) => padLine(line, innerWidth)),
			width,
			height,
			getPanelStyle("rail", state.focusRegion === "rail", state.focusRegion === "rail"),
		),
		railRegions,
	};
}

function renderMainPanel(
	state: RenderWorkbenchState,
	width: number,
	height: number,
	startRow: number,
	startCol: number,
): { lines: string[]; mainRegions: ClickRegion[] } {
	const innerWidth = Math.max(1, width - 2);
	const body: string[] = [
		workbenchTheme.accent(`Workbench ${workbenchTheme.accentSoft(`[${state.getViewLabel(state.view)}]`)}`),
		workbenchTheme.text(
			state.activeProfile
				? `Provider ${state.activeProfile.label}  |  Model ${state.activeSelection.modelId ?? state.activeProfile.models[0]?.id ?? "none"}`
				: "No active provider selected yet.",
		),
		workbenchTheme.muted("Primary actions live in the cards below. Click a card or move with Up/Down and press Enter."),
		"",
	];
	const mainRegions: ClickRegion[] = [];

	for (const [index, card] of state.mainCards.entries()) {
		const rendered = renderCard(state, card, innerWidth, state.focusRegion === "main" && state.mainSelectionIndex === index);
		const firstRow = body.length;
		body.push(...rendered.lines, "");
		mainRegions.push({
			group: "main",
			id: card.id,
			row: startRow + 1 + firstRow,
			col: startCol + 2,
			width: Math.max(1, innerWidth - 2),
			height: rendered.lines.length,
		});
	}

	const remaining = Math.max(0, height - 2 - body.length);
	if (remaining > 0) {
		body.push(workbenchTheme.accent(`Recent Activity ${workbenchTheme.accentSoft(`[${pulseDot(state.frame)}]`)}`));
		for (const entry of state.timeline.slice(0, Math.max(1, remaining - 1))) {
			body.push(workbenchTheme.text(entry));
		}
	}

	return {
		lines: framePanelFixed(
			state.focusRegion === "main" ? "Main Workbench [active]" : "Main Workbench",
			body.map((line) => padLine(line, innerWidth)),
			width,
			height,
			getPanelStyle("main", state.focusRegion === "main", state.focusRegion === "main" && state.focusPulseActive),
		),
		mainRegions,
	};
}

function renderInspectorPanel(state: RenderWorkbenchState, width: number, height: number): string[] {
	const innerWidth = Math.max(1, width - 2);
	const body = [
		workbenchTheme.accent("Selection"),
		workbenchTheme.text(`View: ${state.getViewLabel(state.view)}`),
		workbenchTheme.text(`Provider: ${state.activeProfile?.label ?? "none"}`),
		workbenchTheme.text(`Model: ${state.activeSelection.modelId ?? "none"}`),
		"",
		workbenchTheme.accent("Task State"),
		workbenchTheme.success(`Workbench rebuild in progress ${pulseDot(state.frame)}`),
		workbenchTheme.text(`Focus: ${state.getFocusLabel(state.focusRegion)}`),
		workbenchTheme.text(`Queued sessions: ${state.sessionsCount}`),
		"",
		workbenchTheme.accent("Context"),
		workbenchTheme.text("Agent dir:"),
		workbenchTheme.muted(state.agentDir),
		workbenchTheme.text(`Profiles loaded: ${state.profiles.length}`),
		workbenchTheme.text(`Timeline entries: ${state.timeline.length}`),
		"",
		workbenchTheme.accent("Todo"),
		workbenchTheme.text("1. Replace stub activity with real session timeline"),
		workbenchTheme.text("2. Add inline tool execution and diff surfaces"),
		workbenchTheme.text("3. Turn picker overlays into richer dialogs"),
	];

	return framePanelFixed(
		"Inspector",
		body.map((line) => padLine(line, innerWidth)),
		width,
		height,
		getPanelStyle("inspector", false, state.focusPulseActive),
	);
}

function renderDock(
	state: RenderWorkbenchState,
	width: number,
	height: number,
	startRow: number,
): { lines: string[]; dockRegions: ClickRegion[]; composerRegion?: Rect } {
	const innerWidth = Math.max(1, width - 2);
	const actionButtons = renderButtons(
		state,
		[
			{
				id: "overlay:provider-switch",
				label: `Provider ${state.truncateLabel(state.activeProfile?.label ?? "none", 14)}`,
				variant: "primary",
			},
			{
				id: "overlay:model-switch",
				label: `Model ${state.truncateLabel(state.activeSelection.modelId ?? "none", 14)}`,
				variant: "secondary",
			},
			{ id: "overlay:session-list", label: "Sessions", variant: "secondary" },
			{ id: "session:new", label: "New Task", variant: "success" },
			{ id: "focus:composer", label: "Focus Composer", variant: "active" },
		],
		innerWidth,
	);
	const composerLines = state.renderComposer(innerWidth);
	const actionStartRow = startRow + 1;
	const dockRegions = actionButtons.regions.map((region) => ({
		group: "dock" as const,
		id: region.id,
		row: actionStartRow + region.row,
		col: 2 + region.col,
		width: region.width,
		height: region.height,
	}));

	const composerRow = actionStartRow + actionButtons.lines.length + 2;
	const composerRegion: Rect = {
		row: composerRow,
		col: 2,
		width: innerWidth,
		height: Math.max(1, composerLines.length),
	};

	const body = [
		...actionButtons.lines,
		"",
		workbenchTheme.accent("Composer"),
		...composerLines,
		workbenchTheme.muted(`Focus ${state.getFocusLabel(state.focusRegion)}  |  /providers /models /sessions also work`),
	];

	return {
		lines: framePanelFixed(
			state.focusRegion === "composer" ? "Bottom Dock [active]" : "Bottom Dock",
			body.map((line) => padLine(line, innerWidth)),
			width,
			height,
			getPanelStyle("dock", state.focusRegion === "composer", state.focusRegion === "composer" && state.focusPulseActive),
		),
		dockRegions,
		composerRegion,
	};
}

function compositeOverlay(state: RenderWorkbenchState, baseLines: string[]): { lines: string[]; overlayRegions: ClickRegion[] } {
	const options = state.overlayOptions;
	const overlayWidth = Math.max(38, Math.min(76, Math.floor(state.width * 0.66)));
	const overlayHeight = Math.max(10, Math.min(state.height - 4, 8 + Math.min(options.length, 5) * 2));
	const rect = computeCenteredRect(state.width, state.height, overlayWidth, overlayHeight);
	const innerWidth = Math.max(1, rect.width - 2);
	const maxVisibleOptions = Math.max(1, Math.floor((rect.height - 6) / 2));
	const selectedIndex = state.overlaySelectionIndex;
	const startIndex = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisibleOptions / 2), Math.max(0, options.length - maxVisibleOptions)));
	const visibleOptions = options.slice(startIndex, startIndex + maxVisibleOptions);

	const body: string[] = [
		workbenchTheme.text(getOverlayDescription(state)),
		workbenchTheme.muted("Use Up/Down, click a row, or press Enter."),
		"",
	];
	const overlayRegions: ClickRegion[] = [];

	for (const [index, option] of visibleOptions.entries()) {
		const absoluteIndex = startIndex + index;
		const isSelected = absoluteIndex === selectedIndex;
		const label = state.styleButton(option.label, option.disabled ? "secondary" : isSelected ? "active" : "primary");
		const firstRow = body.length;
		body.push(`${isSelected ? workbenchTheme.accentStrong(">") : workbenchTheme.muted(" ")} ${label} ${option.badge ? workbenchTheme.success(option.badge) : ""}`.trimEnd());
		body.push(`  ${option.disabled ? workbenchTheme.warning(option.description) : workbenchTheme.muted(option.description)}`);
		overlayRegions.push({
			group: "overlay",
			id: option.id,
			row: rect.row + 1 + firstRow,
			col: rect.col + 2,
			width: Math.max(1, innerWidth - 2),
			height: 2,
		});
	}

	body.push("");
	body.push(
		workbenchTheme.muted(
			options.length > visibleOptions.length
				? `Showing ${startIndex + 1}-${startIndex + visibleOptions.length} of ${options.length}  |  Esc close`
				: `Enter select  |  Esc close  |  ${pulseDot(state.frame)} active dialog`,
		),
	);

	const overlayLines = framePanelFixed(
		getOverlayTitle(state),
		body.map((line) => padLine(line, innerWidth)),
		rect.width,
		rect.height,
		getPanelStyle("overlay", true, true),
	);
	const output = [...baseLines];
	for (let i = 0; i < overlayLines.length; i += 1) {
		const targetIndex = rect.row - 1 + i;
		if (targetIndex < 0 || targetIndex >= output.length) {
			continue;
		}
		const base = output[targetIndex] ?? " ".repeat(state.width);
		const before = base.slice(0, Math.max(0, rect.col - 1));
		const afterStart = Math.max(0, rect.col - 1 + rect.width);
		const after = afterStart < base.length ? base.slice(afterStart) : "";
		output[targetIndex] = `${before}${padLine(overlayLines[i]!, rect.width)}${after}`;
	}

	return { lines: output, overlayRegions };
}

function renderButtons(state: RenderWorkbenchState, items: ButtonSpec[], width: number): RenderedButtons {
	const lines: string[] = [];
	const regions: LocalRegion[] = [];
	let currentLine = "";
	let currentWidth = 0;
	let row = 0;

	for (const item of items) {
		const button = state.styleButton(item.label, item.variant);
		const buttonWidth = visibleWidth(button);
		const gap = currentLine ? 1 : 0;

		if (currentWidth + gap + buttonWidth > width && currentLine) {
			lines.push(currentLine);
			currentLine = "";
			currentWidth = 0;
			row += 1;
		}

		const startCol = currentWidth + (currentLine ? 1 : 0);
		currentLine += `${currentLine ? " " : ""}${button}`;
		currentWidth = visibleWidth(currentLine);
		regions.push({
			id: item.id,
			row,
			col: startCol,
			width: buttonWidth,
			height: 1,
		});
	}

	if (currentLine) {
		lines.push(currentLine);
	}

	return { lines, regions };
}

function renderCard(state: RenderWorkbenchState, card: WorkbenchCard, width: number, selected: boolean): { lines: string[] } {
	const cardWidth = Math.max(18, width - 2);
	const cardInnerWidth = Math.max(10, cardWidth - 2);
	const border = selected ? workbenchTheme.accentStrong : workbenchTheme.accentSoft;
	const title = selected ? workbenchTheme.accentStrong(card.title) : workbenchTheme.text(card.title);
	const descLines = card.description.flatMap((line) => wrapTextWithAnsi(line, Math.max(8, cardInnerWidth - 2))).slice(0, 2);
	const actionLine = state.styleButton(card.actionLabel, selected ? "active" : card.variant);
	const frameLine = (content: string): string => ` ${border("|")}${padLine(content, cardInnerWidth)}${border("|")}`;
	const lines = [
		` ${border(`+${"-".repeat(cardInnerWidth)}+`)}`,
		frameLine(title),
		frameLine(workbenchTheme.muted(descLines[0] ?? "")),
		frameLine(workbenchTheme.muted(descLines[1] ?? "")),
		frameLine(actionLine),
		` ${border(`+${"-".repeat(cardInnerWidth)}+`)}`,
	];

	return { lines: lines.map((line) => padLine(line, width)) };
}

function getOverlayTitle(state: RenderWorkbenchState): string {
	switch (state.overlay) {
		case "provider-switch":
			return "Provider Picker";
		case "model-switch":
			return "Model Picker";
		case "session-list":
			return "Session Picker";
		case undefined:
			return "Dialog";
	}
}

function getOverlayDescription(state: RenderWorkbenchState): string {
	switch (state.overlay) {
		case "provider-switch":
			return "Select the provider card the workbench should use by default.";
		case "model-switch":
			return "Choose the current default model for the active provider.";
		case "session-list":
			return "Pick a staged session surface to continue while history integration is pending.";
		case undefined:
			return "";
	}
}
