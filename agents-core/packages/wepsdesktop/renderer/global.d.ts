import type { WepsDesktopBridge } from "../src/shared/bridge.js";

declare global {
	interface Window {
		wepsDesktop: WepsDesktopBridge;
	}
}

export {};
