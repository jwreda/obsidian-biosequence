import { reverseComplement } from "../calculations/translation";
import { AnnotatedSegment, FeatureEntry, FeatureMatch, Segment, SequenceType } from "../types";

/**
 * Find all occurrences of enabled library features in the given sequence.
 * Finds all substring matches including overlapping positions. Nucleotide
 * features are matched on both strands, and DNA and RNA features match
 * either sequence type (T and U are treated as equivalent).
 */
export function matchFeatures(
	sequence: string,
	features: FeatureEntry[],
	sequenceType: SequenceType
): FeatureMatch[] {
	const matches: FeatureMatch[] = [];
	const isNucleotide = sequenceType !== "aa";
	const upperSeq = isNucleotide
		? sequence.toUpperCase().replace(/U/g, "T")
		: sequence.toUpperCase();

	for (const feature of features) {
		if (!feature.enabled) continue;
		if (isNucleotide ? feature.type === "aa" : feature.type !== "aa") continue;

		const featureSeq = isNucleotide
			? feature.sequence.toUpperCase().replace(/U/g, "T")
			: feature.sequence.toUpperCase();
		if (featureSeq.length === 0 || featureSeq.length > upperSeq.length) continue;

		const push = (start: number, strand?: "+" | "-"): void => {
			matches.push({
				featureId: feature.id,
				name: feature.name,
				start,
				end: start + featureSeq.length,
				color: feature.color,
				source: "library",
				...(strand ? { strand } : {}),
			});
		};

		if (!isNucleotide) {
			for (const idx of findAll(upperSeq, featureSeq)) push(idx);
			continue;
		}

		const forward = findAll(upperSeq, featureSeq);
		for (const idx of forward) push(idx, "+");

		// Skip the reverse search for palindromes: those hits are the same sites
		const rc = reverseComplement(featureSeq);
		if (rc !== featureSeq) {
			for (const idx of findAll(upperSeq, rc)) push(idx, "-");
		}
	}

	return matches;
}

/** All (overlapping) start positions of needle in haystack. */
function findAll(haystack: string, needle: string): number[] {
	const positions: number[] = [];
	let from = 0;
	while (from <= haystack.length - needle.length) {
		const idx = haystack.indexOf(needle, from);
		if (idx === -1) break;
		positions.push(idx);
		from = idx + 1;
	}
	return positions;
}

/**
 * Merge inline/range annotation segments with library feature matches
 * into a unified AnnotatedSegment array.
 */
export function mergeSegments(
	inlineSegments: Segment[],
	featureMatches: FeatureMatch[]
): AnnotatedSegment[] {
	const result: AnnotatedSegment[] = [];

	for (const seg of inlineSegments) {
		result.push({
			...seg,
			source: "inline",
		});
	}

	for (const match of featureMatches) {
		result.push({
			name: match.name,
			start: match.start,
			end: match.end,
			color: match.color,
			source: "library",
			featureId: match.featureId,
			...(match.strand ? { strand: match.strand } : {}),
		});
	}

	return result;
}
