import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
	detectSupportedImageMimeTypeFromFile,
	extensionForImageMimeType,
	readClipboardImage,
	resizeImage,
} from "@mariozechner/pi-coding-agent";
import type { ImageContent } from "@mariozechner/pi-ai";

export interface ChatImageAttachment {
	id: string;
	label: string;
	mimeType: string;
}

export interface ComposerImageAttachment extends ChatImageAttachment {
	image: ImageContent;
	source: "file" | "clipboard";
	filePath?: string;
}

function normalizeMimeType(mimeType: string): string {
	return mimeType.split(";")[0]?.trim().toLowerCase() ?? mimeType.toLowerCase();
}

function stripWrappingQuotes(value: string): string {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

async function finalizeImage(image: ImageContent, autoResize: boolean): Promise<ImageContent> {
	if (!autoResize) {
		return {
			type: "image",
			data: image.data,
			mimeType: normalizeMimeType(image.mimeType),
		};
	}

	const resized = await resizeImage(image);
	return {
		type: "image",
		data: resized.data,
		mimeType: normalizeMimeType(resized.mimeType),
	};
}

export function toChatImageAttachment(attachment: ComposerImageAttachment): ChatImageAttachment {
	return {
		id: attachment.id,
		label: attachment.label,
		mimeType: normalizeMimeType(attachment.mimeType),
	};
}

export function imageLabelForTranscript(index: number, mimeType: string): string {
	const format = normalizeMimeType(mimeType).split("/")[1]?.toUpperCase() ?? "IMAGE";
	return `Image ${index} (${format})`;
}

export function imageAttachmentsFromMessageContent(
	content: Array<{ type?: string; mimeType?: string }>,
): ChatImageAttachment[] {
	let index = 0;

	return content
		.filter((part) => part.type === "image")
		.map((part) => {
			index += 1;
			const mimeType = normalizeMimeType(part.mimeType ?? "image/png");
			return {
				id: `image:${index}`,
				label: imageLabelForTranscript(index, mimeType),
				mimeType,
			};
		});
}

export async function createComposerImageAttachmentFromFile(
	inputPath: string,
	options: {
		cwd?: string;
		autoResize?: boolean;
	} = {},
): Promise<ComposerImageAttachment> {
	const normalizedPath = stripWrappingQuotes(inputPath);
	if (!normalizedPath) {
		throw new Error("Provide an image path after /image add.");
	}

	const resolvedPath = resolve(options.cwd ?? process.cwd(), normalizedPath);
	const mimeType = await detectSupportedImageMimeTypeFromFile(resolvedPath);
	if (!mimeType) {
		throw new Error("Only PNG, JPEG, GIF, and WebP files can be attached as images.");
	}

	const bytes = await readFile(resolvedPath);
	const image = await finalizeImage(
		{
			type: "image",
			data: Buffer.from(bytes).toString("base64"),
			mimeType,
		},
		options.autoResize ?? true,
	);

	return {
		id: randomUUID(),
		label: basename(resolvedPath),
		mimeType: image.mimeType,
		image,
		source: "file",
		filePath: resolvedPath,
	};
}

export async function createComposerImageAttachmentFromClipboard(options: {
	autoResize?: boolean;
} = {}): Promise<ComposerImageAttachment | null> {
	const clipboardImage = await readClipboardImage();
	if (!clipboardImage) {
		return null;
	}

	const image = await finalizeImage(
		{
			type: "image",
			data: Buffer.from(clipboardImage.bytes).toString("base64"),
			mimeType: clipboardImage.mimeType,
		},
		options.autoResize ?? true,
	);

	const extension = extensionForImageMimeType(image.mimeType) ?? "png";
	return {
		id: randomUUID(),
		label: `clipboard-image.${extension}`,
		mimeType: image.mimeType,
		image,
		source: "clipboard",
	};
}
