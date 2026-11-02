import { FeatureEntry } from "../types";
import { SEGMENT_PALETTE } from "../parsing/segmentParser";

/*
 * The feature library is kept in a note inside the vault, so that any sync
 * service (Obsidian Sync, iCloud, git) carries it between devices like any
 * other note. The features live in a fenced `tsv` code block; text outside
 * that block belongs to the user and is left alone when the plugin rewrites
 * the library.
 */

export const TSV_HEADER = "Name\tSequence\tType\tColor\tEnabled";

const LIBRARY_BLOCK = /^```tsv[^\S\n]*\n([\s\S]*?)^```[^\S\n]*$/m;

function normalizeHexColor(raw: string): string | null {
	const hex = raw.replace(/^#/, "");
	if (/^[0-9a-fA-F]{6}$/.test(hex)) {
		return "#" + hex.toLowerCase();
	}
	return null;
}

/**
 * Tabs and line breaks would split a TSV row, and a run of backticks could
 * close the code fence, so cells never carry them.
 */
function cleanCell(text: string): string {
	return text.replace(/[\t\r\n]+/g, " ").replace(/`{3,}/g, "``").trim();
}

export function serializeFeaturesToTsv(features: FeatureEntry[]): string {
	const rows = features.map(f =>
		`${cleanCell(f.name)}\t${cleanCell(f.sequence)}\t${f.type}\t${f.color}\t${f.enabled}`
	);
	return [TSV_HEADER, ...rows].join("\n");
}

export function parseTsvEditorContent(text: string): { features: FeatureEntry[]; errors: string[] } {
	const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
	const features: FeatureEntry[] = [];
	const errors: string[] = [];

	let startIdx = 0;
	const firstLine = lines[0];
	if (firstLine !== undefined && /^name\t/i.test(firstLine)) {
		startIdx = 1;
	}

	for (let i = startIdx; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;

		const parts = line.split("\t");
		if (parts.length < 2) {
			errors.push(`Line ${i + 1}: too few columns`);
			continue;
		}

		const name = (parts[0] ?? "").trim();
		const sequence = (parts[1] ?? "").replace(/\s/g, "").toUpperCase();
		const typeStr = (parts[2] ?? "aa").trim().toLowerCase();
		const type: "aa" | "dna" | "rna" = (typeStr === "dna" || typeStr === "rna") ? typeStr : "aa";

		// Parse color
		let color: string;
		const rawColor = (parts[3] ?? "").trim();
		if (rawColor.length > 0) {
			const normalized = normalizeHexColor(rawColor);
			if (normalized) {
				color = normalized;
			} else {
				errors.push(`Line ${i + 1}: invalid color "${rawColor}"`);
				color = SEGMENT_PALETTE[features.length % SEGMENT_PALETTE.length] ?? "#7eb8da";
			}
		} else {
			color = SEGMENT_PALETTE[features.length % SEGMENT_PALETTE.length] ?? "#7eb8da";
		}

		// Parse enabled
		const enabledStr = (parts[4] ?? "true").trim().toLowerCase();
		const enabled = enabledStr !== "false" && enabledStr !== "0";

		if (name.length > 0 && sequence.length > 0) {
			features.push({
				id: crypto.randomUUID(),
				name,
				sequence,
				type,
				color,
				enabled,
			});
		} else {
			errors.push(`Line ${i + 1}: missing name or sequence`);
		}
	}

	return { features, errors };
}

/** The TSV inside the note's library block, or null when the note has none. */
export function extractLibraryBlock(note: string): string | null {
	const match = LIBRARY_BLOCK.exec(note.replace(/\r\n/g, "\n"));
	return match ? (match[1] ?? "") : null;
}

/** A new library note holding the given TSV. */
export function buildLibraryNote(tsv: string): string {
	return [
		"This note holds the feature library for the BioSequence plugin. Because it is an ordinary note, Obsidian Sync (or any other sync) carries it to your other devices.",
		"",
		"Edit the library in Settings → BioSequence → Feature library, or edit the table below directly: one feature per line, with the columns Name, Sequence, Type, Color and Enabled separated by tabs. You can write your own notes above or below the table.",
		"",
		"```tsv",
		tsv,
		"```",
		"",
	].join("\n");
}

/**
 * Put new TSV into an existing note's library block, keeping everything
 * around it. A note without a block gets one appended.
 */
export function replaceLibraryBlock(note: string, tsv: string): string {
	const normalized = note.replace(/\r\n/g, "\n");
	const match = LIBRARY_BLOCK.exec(normalized);
	if (!match) {
		const sep = normalized.length === 0 || normalized.endsWith("\n") ? "" : "\n";
		return `${normalized}${sep}\n\`\`\`tsv\n${tsv}\n\`\`\`\n`;
	}
	const start = match.index;
	const end = start + match[0].length;
	return `${normalized.slice(0, start)}\`\`\`tsv\n${tsv}\n\`\`\`${normalized.slice(end)}`;
}

function featureKey(f: FeatureEntry): string {
	return `${f.name}\u0000${f.sequence.toUpperCase()}\u0000${f.type}`;
}

/**
 * Add the entries of `extra` that `base` does not already hold (same name,
 * sequence and type), keeping `base` order first. Used to fold a device's
 * older library into the shared note without dropping or doubling entries.
 */
export function mergeFeatureLibraries(base: FeatureEntry[], extra: FeatureEntry[]): FeatureEntry[] {
	const seen = new Set(base.map(featureKey));
	const merged = [...base];
	for (const f of extra) {
		const key = featureKey(f);
		if (!seen.has(key)) {
			seen.add(key);
			merged.push(f);
		}
	}
	return merged;
}
