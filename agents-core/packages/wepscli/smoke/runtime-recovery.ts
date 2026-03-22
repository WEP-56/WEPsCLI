import assert from "node:assert/strict";
import { getRuntimeRecoveryHint } from "../src/WEPSCLI-shell/runtime-recovery.ts";

assert.match(getRuntimeRecoveryHint("No API key configured for Test Provider")?.label ?? "", /Provider auth issue/);
assert.match(getRuntimeRecoveryHint("Model foo is unavailable for Test Provider")?.nextStep ?? "", /\/models/);
assert.match(getRuntimeRecoveryHint("fetch failed: ECONNRESET")?.label ?? "", /Provider connection issue/);
assert.match(getRuntimeRecoveryHint("rate limit exceeded")?.nextStep ?? "", /wait and retry/i);
assert.match(getRuntimeRecoveryHint("unexpected failure")?.nextStep ?? "", /\/debug/);

console.log("SMOKE_RUNTIME_RECOVERY_OK");
