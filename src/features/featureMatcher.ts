import { AnnotatedSegment, FeatureEntry, FeatureMatch, Segment, SequenceType } from "../types";

/**
 * Find all occurrences of enabled library features in the given sequence.
 * Filters by type, finds all substring matches including overlapping positions.
 */
export function matchFeatures(
	sequence: string,
	features: FeatureEntry[],
	sequenceType: SequenceType
): FeatureMatch[] {
	const matches: FeatureMatch[] = [];
	const upperSeq = sequence.toUpperCase();

	for (const feature of features) {
		if (!feature.enabled) continue;
		if (feature.type !== sequenceType) continue;

		const featureSeq = feature.sequence.toUpperCase();
		if (featureSeq.length === 0 || featureSeq.length > upperSeq.length) continue;

		let searchFrom = 0;
		while (searchFrom <= upperSeq.length - featureSeq.length) {
			const idx = upperSeq.indexOf(featureSeq, searchFrom);
			if (idx === -1) break;

			matches.push({
				featureId: feature.id,
				name: feature.name,
				start: idx,
				end: idx + featureSeq.length,
				color: feature.color,
				source: "library",
			});

			searchFrom = idx + 1;
		}
	}

	return matches;
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
		});
	}

	return result;
}
