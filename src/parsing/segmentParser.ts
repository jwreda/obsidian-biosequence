import { Segment } from "../types";

export interface RawSegmentAnnotation {
	name: string;
	start: number;  // 0-indexed inclusive
	end: number;    // 0-indexed exclusive
}

/** Muted color palette for segments */
export const SEGMENT_PALETTE: string[] = [
	"#7eb8da",  // soft blue
	"#a3d89b",  // soft green
	"#f4b183",  // soft orange
	"#c5a3d9",  // soft purple
	"#f2a1a1",  // soft red
	"#8fd4c1",  // soft teal
	"#f7d794",  // soft gold
	"#b5c7e3",  // periwinkle
	"#d4a5a5",  // dusty rose
	"#a8d8b9",  // sage
	"#e6c89c",  // tan
	"#b3b3cc",  // lavender gray
];

/**
 * Detect and parse inline [Name]SEQUENCE annotations.
 * Returns the cleaned sequence text (annotations removed) and the segments found.
 *
 * Input format:
 *   [Igk leader]METDTLLLWVLLLWVPGSTGD
 *   [Linker]GGGGSGGGGSGGGGS
 *   [VH domain]EVQLVESGGGLVQ
 */
export function parseInlineAnnotations(seqLines: string[]): {
	cleanedText: string;
	segments: RawSegmentAnnotation[];
} {
	const segments: RawSegmentAnnotation[] = [];
	const cleanedParts: string[] = [];
	let globalPos = 0;

	// Regex to match [Name] followed by sequence characters
	const annotationPattern = /\[([^\]]+)\]/g;

	for (const line of seqLines) {
		const remaining = line;
		let lineClean = "";

		let match: RegExpExecArray | null;
		let lastIndex = 0;
		annotationPattern.lastIndex = 0;

		while ((match = annotationPattern.exec(remaining)) !== null) {
			// Text before the annotation bracket (if any)
			const prefixText = remaining
				.substring(lastIndex, match.index)
				.replace(/[\s\d\-*]/g, "");
			globalPos += prefixText.length;
			lineClean += prefixText;

			const name = match[1] ?? "";
			const afterBracket = remaining.substring(
				match.index + match[0].length
			);

			// Find the next bracket annotation or end of string
			const nextBracket = afterBracket.search(/\[/);
			const segmentText =
				nextBracket >= 0
					? afterBracket.substring(0, nextBracket)
					: afterBracket;

			const cleanSegment = segmentText.replace(/[\s\d\-*]/g, "");

			if (cleanSegment.length > 0) {
				segments.push({
					name,
					start: globalPos,
					end: globalPos + cleanSegment.length,
				});
			}

			globalPos += cleanSegment.length;
			lineClean += cleanSegment;

			// Advance past this segment's text
			lastIndex =
				match.index +
				match[0].length +
				(nextBracket >= 0 ? nextBracket : afterBracket.length);
			annotationPattern.lastIndex = lastIndex;
		}

		// Remaining text after last annotation
		const tail = remaining.substring(lastIndex).replace(/[\s\d\-*]/g, "");
		globalPos += tail.length;
		lineClean += tail;

		cleanedParts.push(lineClean);
	}

	return {
		cleanedText: cleanedParts.join(""),
		segments,
	};
}

/**
 * Parse position-range annotations from lines after --- delimiter.
 *
 * Input format:
 *   1-21: Igk leader
 *   22-36: (G4S)3 Linker
 *   37-150: VH domain
 *
 * Positions are 1-indexed in input, converted to 0-indexed internally.
 */
export function parseRangeAnnotations(
	annotationLines: string[]
): RawSegmentAnnotation[] {
	const segments: RawSegmentAnnotation[] = [];
	const rangePattern = /^\s*(\d+)\s*-\s*(\d+)\s*:\s*(.+)\s*$/;

	for (const line of annotationLines) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;

		const match = trimmed.match(rangePattern);
		if (match) {
			const start = parseInt(match[1] ?? "0", 10) - 1; // convert to 0-indexed
			const end = parseInt(match[2] ?? "0", 10); // exclusive (1-indexed end = 0-indexed exclusive)
			const name = (match[3] ?? "").trim();

			if (start >= 0 && end > start) {
				segments.push({ name, start, end });
			}
		}
	}

	return segments;
}

/** Assign colors from palette to segments.
 *  @param offset - palette index offset so separately-parsed groups get distinct colors
 */
export function colorizeSegments(segments: RawSegmentAnnotation[], offset = 0): Segment[] {
	return segments.map((seg, i) => ({
		name: seg.name,
		start: seg.start,
		end: seg.end,
		color: SEGMENT_PALETTE[(i + offset) % SEGMENT_PALETTE.length] ?? "#7eb8da",
	}));
}

/**
 * Check whether sequence lines contain inline [Name] annotations.
 */
export function hasInlineAnnotations(seqLines: string[]): boolean {
	return seqLines.some((line) => /\[[^\]]+\]/.test(line));
}
