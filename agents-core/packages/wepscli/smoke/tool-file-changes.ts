import assert from "node:assert/strict";
import { createToolMessageState, toolCardPreview, toolDetailText, updateToolMessageState } from "../src/WEPSCLI-shell/tool-messages.ts";

let editTool = createToolMessageState("call-edit", "edit", {
	path: "src/app.ts",
	oldText: "const value = 1;\n",
	newText: "const value = 2;\n",
});

assert.equal(editTool.fileChanges[0]?.path, "src/app.ts");
assert.match(toolCardPreview(editTool), /Running: edit/);

editTool = updateToolMessageState(editTool, {
	status: "completed",
	output: {
		content: [{ type: "text", text: "Successfully replaced text in src/app.ts." }],
		details: {
			diff: ["  10 export function run() {", "-  11   return 1;", "+  11   return 2;", "  12 }"].join("\n"),
			firstChangedLine: 11,
		},
	},
});

assert.equal(editTool.fileChanges[0]?.firstChangedLine, 11);
assert.equal(editTool.fileChanges[0]?.diffStats?.added, 1);
assert.equal(editTool.fileChanges[0]?.diffStats?.removed, 1);
assert.match(toolCardPreview(editTool), /src\/app\.ts:11/);
assert.match(toolCardPreview(editTool), /\+1 -1/);
assert.match(toolDetailText(editTool), /File Changes:/);
assert.match(toolDetailText(editTool), /Diff:/);
assert.match(toolDetailText(editTool), /\+  11   return 2;/);
assert.doesNotMatch(toolDetailText(editTool), /Arguments:/);
assert.doesNotMatch(toolDetailText(editTool), /Output:/);

let writeTool = createToolMessageState("call-write", "write", {
	path: "docs/out.md",
	content: "# Title\n\nBody line\n",
});

assert.equal(writeTool.fileChanges[0]?.path, "docs/out.md");
assert.equal(writeTool.fileChanges[0]?.previewText, "# Title\n\nBody line");
assert.ok((writeTool.fileChanges[0]?.diffStats?.added ?? 0) > 0);
assert.match(toolCardPreview(writeTool), /Running: write/);

writeTool = updateToolMessageState(writeTool, {
	status: "completed",
	output: {
		content: [{ type: "text", text: "Successfully wrote 19 bytes to docs/out.md" }],
	},
});

assert.match(toolCardPreview(writeTool), /write docs\/out\.md/);
assert.match(toolCardPreview(writeTool), /\+\d/);
assert.match(toolDetailText(writeTool), /Diff:/);
assert.match(toolDetailText(writeTool), /# Title/);
assert.doesNotMatch(toolDetailText(writeTool), /Arguments:/);
assert.doesNotMatch(toolDetailText(writeTool), /Output:/);

console.log("SMOKE_TOOL_FILE_CHANGES_OK");
