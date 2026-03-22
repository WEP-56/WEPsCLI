import * as Diff from "diff";

export interface GeneratedDiff {
	diff: string;
	firstChangedLine: number | undefined;
}

export function generateDiffString(
	oldContent: string,
	newContent: string,
	contextLines = 4,
): GeneratedDiff {
	const parts = Diff.diffLines(oldContent, newContent);
	const output: string[] = [];

	const oldLines = oldContent.split("\n");
	const newLines = newContent.split("\n");
	const maxLineNum = Math.max(oldLines.length, newLines.length);
	const lineNumWidth = String(maxLineNum).length;

	let oldLineNum = 1;
	let newLineNum = 1;
	let lastWasChange = false;
	let firstChangedLine: number | undefined;

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i]!;
		const raw = part.value.split("\n");
		if (raw[raw.length - 1] === "") {
			raw.pop();
		}

		if (part.added || part.removed) {
			if (firstChangedLine === undefined) {
				firstChangedLine = newLineNum;
			}

			for (const line of raw) {
				if (part.added) {
					const lineNum = String(newLineNum).padStart(lineNumWidth, " ");
					output.push(`+${lineNum} ${line}`);
					newLineNum += 1;
				} else {
					const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
					output.push(`-${lineNum} ${line}`);
					oldLineNum += 1;
				}
			}
			lastWasChange = true;
			continue;
		}

		const nextPartIsChange = i < parts.length - 1 && !!(parts[i + 1]?.added || parts[i + 1]?.removed);

		if (lastWasChange || nextPartIsChange) {
			let linesToShow = raw;
			let skipStart = 0;
			let skipEnd = 0;

			if (!lastWasChange) {
				skipStart = Math.max(0, raw.length - contextLines);
				linesToShow = raw.slice(skipStart);
			}

			if (!nextPartIsChange && linesToShow.length > contextLines) {
				skipEnd = linesToShow.length - contextLines;
				linesToShow = linesToShow.slice(0, contextLines);
			}

			if (skipStart > 0) {
				output.push(` ${"".padStart(lineNumWidth, " ")} ...`);
				oldLineNum += skipStart;
				newLineNum += skipStart;
			}

			for (const line of linesToShow) {
				const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
				output.push(` ${lineNum} ${line}`);
				oldLineNum += 1;
				newLineNum += 1;
			}

			if (skipEnd > 0) {
				output.push(` ${"".padStart(lineNumWidth, " ")} ...`);
				oldLineNum += skipEnd;
				newLineNum += skipEnd;
			}
		} else {
			oldLineNum += raw.length;
			newLineNum += raw.length;
		}

		lastWasChange = false;
	}

	return { diff: output.join("\n"), firstChangedLine };
}
