import { FastaEntry } from "../types";

/**
 * Parse a multi-FASTA formatted string into an array of entries.
 * Handles standard FASTA with `>header` lines followed by sequence lines.
 * Preserves gap characters (`-`) in aligned output.
 */
export function parseFasta(text: string): FastaEntry[] {
	const entries: FastaEntry[] = [];
	const lines = text.split("\n");
	let currentHeader = "";
	let currentSeqLines: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.length === 0) {
			continue;
		}
		if (trimmed.startsWith(">")) {
			// Save previous entry if one exists
			if (currentHeader !== "" || currentSeqLines.length > 0) {
				entries.push({
					header: currentHeader,
					sequence: currentSeqLines.join(""),
				});
			}
			currentHeader = trimmed.substring(1).trim();
			currentSeqLines = [];
		} else {
			// Sequence line: strip whitespace but preserve gap chars
			currentSeqLines.push(trimmed.replace(/\s/g, ""));
		}
	}

	// Don't forget the last entry
	if (currentHeader !== "" || currentSeqLines.length > 0) {
		entries.push({
			header: currentHeader,
			sequence: currentSeqLines.join(""),
		});
	}

	return entries;
}
