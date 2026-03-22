export type ShellFocusRegion = "workspace" | "composer";

export const shellKeymap = {
	switchFocus: "Tab",
	select: "Enter",
	navigate: "Up/Down",
	exit: "Esc or Ctrl+C",
};

export function getFocusLabel(region: ShellFocusRegion): string {
	switch (region) {
		case "workspace":
			return "Workspace";
		case "composer":
			return "Composer";
	}
}
