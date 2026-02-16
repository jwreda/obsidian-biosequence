import { FeatureEntry, SequenceType } from "../types";
import { SEGMENT_PALETTE } from "../parsing/segmentParser";

export type ImportFormat = "tsv" | "fasta";

/** Auto-detect import format from content */
export function detectFormat(text: string): ImportFormat {
	const trimmed = text.trim();
	if (trimmed.startsWith(">")) return "fasta";
	return "tsv";
}

/** Parse import text in either TSV or FASTA format */
export function parseImport(text: string): FeatureEntry[] {
	const format = detectFormat(text);
	return format === "fasta" ? parseFastaImport(text) : parseTsvImport(text);
}

function parseTsvImport(text: string): FeatureEntry[] {
	const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
	const features: FeatureEntry[] = [];

	let startIdx = 0;
	const firstLine = lines[0];
	if (firstLine !== undefined && /name/i.test(firstLine) && /sequence/i.test(firstLine)) {
		startIdx = 1;
	}

	for (let i = startIdx; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;

		const parts = line.split("\t");
		if (parts.length < 2) continue;

		const name = (parts[0] ?? "").trim();
		const sequence = (parts[1] ?? "").replace(/\s/g, "").toUpperCase();
		const typeStr = (parts[2] ?? "aa").trim().toLowerCase();
		const type: SequenceType = (typeStr === "dna" || typeStr === "rna") ? typeStr : "aa";

		if (name.length > 0 && sequence.length > 0) {
			features.push({
				id: crypto.randomUUID(),
				name,
				sequence,
				type,
				color: SEGMENT_PALETTE[features.length % SEGMENT_PALETTE.length] ?? "#7eb8da",
				enabled: true,
			});
		}
	}

	return features;
}

function parseFastaImport(text: string): FeatureEntry[] {
	const lines = text.split("\n");
	const features: FeatureEntry[] = [];
	let currentName = "";
	let currentType: SequenceType = "aa";
	let currentSeqLines: string[] = [];

	function flush(): void {
		const sequence = currentSeqLines.join("").replace(/\s/g, "").toUpperCase();
		if (currentName.length > 0 && sequence.length > 0) {
			features.push({
				id: crypto.randomUUID(),
				name: currentName,
				sequence,
				type: currentType,
				color: SEGMENT_PALETTE[features.length % SEGMENT_PALETTE.length] ?? "#7eb8da",
				enabled: true,
			});
		}
		currentName = "";
		currentType = "aa";
		currentSeqLines = [];
	}

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith(">")) {
			flush();
			const typeMatch = trimmed.match(/\[(aa|dna|rna)\]/i);
			if (typeMatch) {
				const matched = typeMatch[1];
				if (matched !== undefined) {
					currentType = matched.toLowerCase() as SequenceType;
				}
				currentName = trimmed.substring(1).replace(/\[(?:aa|dna|rna)\]/i, "").trim();
			} else {
				currentName = trimmed.substring(1).trim();
			}
		} else if (trimmed.length > 0) {
			currentSeqLines.push(trimmed);
		}
	}
	flush();

	return features;
}
