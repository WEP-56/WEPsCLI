declare module "@opentui/solid" {
	import type { Accessor, JSX } from "solid-js";

	export function render(node: () => JSX.Element, rendererOrConfig?: object): Promise<void>;
	export function useKeyboard(
		callback: (event: {
			name: string;
			ctrl?: boolean;
			meta?: boolean;
			preventDefault: () => void;
			stopPropagation: () => void;
		}) => void,
		options?: object,
	): void;
	export function useRenderer(): {
		setTerminalTitle: (title: string) => void;
		destroy: () => void;
	};
	export function useTerminalDimensions(): Accessor<{ width: number; height: number }>;
}
