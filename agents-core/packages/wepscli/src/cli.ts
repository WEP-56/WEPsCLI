#!/usr/bin/env node
process.title = "wepscli";
process.emitWarning = (() => {}) as typeof process.emitWarning;

import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { main } from "./main.js";

setGlobalDispatcher(new EnvHttpProxyAgent());

main(process.argv.slice(2)).catch((error: unknown) => {
	const message = error instanceof Error ? error.stack ?? error.message : String(error);
	console.error(message);
	process.exit(1);
});
