import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const rendererRoot = resolve(__dirname, "renderer");

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
	},
	renderer: {
		root: rendererRoot,
		build: {
			rollupOptions: {
				input: resolve(rendererRoot, "index.html"),
			},
		},
		resolve: {
			alias: {
				"@renderer": rendererRoot,
				"@shared": resolve(__dirname, "src/shared"),
			},
		},
	},
});
