// src/features/proteinFeatureMatcher.ts
//
// Match enabled `type: "aa"` features from the library against translated frames.
// Coordinates are 0-based, half-open [start, end).

import { FeatureEntry } from "../types";
import { Frame, FrameId } from "../calculations/translation";

export interface ProteinMatch {
	featureId: string;
	name: string;
	color: string;
	frame: FrameId;
	aaStart: number;   // inclusive, 0-based, index into Frame.protein
	aaEnd: number;     // exclusive
	ntStart: number;   // inclusive, 0-based, on forward strand
	ntEnd: number;     // exclusive, on forward strand
}

/**
 * For each frame, find all (overlapping) substring matches of every enabled
 * `type: "aa"` feature. Map aa coordinates back to forward-strand nt
 * coordinates using Frame.codonStartsForward.
 *
 * Rules:
 * - Stop characters "*" in the protein are ordinary characters for substring
 *   purposes. A feature sequence containing "*" would still match, but this
 *   is not expected in practice.
 * - Features with empty sequence or longer than the frame protein are skipped.
 * - Case-insensitive match (uppercase normalize both sides).
 */
export function matchProteinFeatures(
	frames: Frame[],
	features: FeatureEntry[]
): ProteinMatch[] {
	const matches: ProteinMatch[] = [];

	for (const frame of frames) {
		const proteinUpper = frame.protein.toUpperCase();
		if (proteinUpper.length === 0) continue;

		for (const feature of features) {
			if (!feature.enabled) continue;
			if (feature.type !== "aa") continue;

			const featureSeq = feature.sequence.toUpperCase();
			if (featureSeq.length === 0 || featureSeq.length > proteinUpper.length) continue;

			let searchFrom = 0;
			while (searchFrom <= proteinUpper.length - featureSeq.length) {
				const aaStart = proteinUpper.indexOf(featureSeq, searchFrom);
				if (aaStart === -1) break;
				const aaEnd = aaStart + featureSeq.length;

				// Map aa range → nt range on forward strand.
				// For forward frames: nt range covers codons aaStart..aaEnd-1 in increasing nt order.
				// For reverse frames: codonStartsForward is decreasing, so the smallest nt is the
				// LAST aa's codon start. We compute min and max regardless of frame direction.
				const starts = frame.codonStartsForward;
				const firstCodonStart = starts[aaStart]!;
				const lastCodonStart = starts[aaEnd - 1]!;
				const ntStart = Math.min(firstCodonStart, lastCodonStart);
				const ntEnd = Math.max(firstCodonStart, lastCodonStart) + 3;

				matches.push({
					featureId: feature.id,
					name: feature.name,
					color: feature.color,
					frame: frame.id,
					aaStart,
					aaEnd,
					ntStart,
					ntEnd,
				});

				searchFrom = aaStart + 1;
			}
		}
	}

	return matches;
}

/** Return the set of frame IDs that have at least one match. */
export function annotatedFrameIds(matches: ProteinMatch[]): Set<FrameId> {
	const set = new Set<FrameId>();
	for (const m of matches) set.add(m.frame);
	return set;
}

/** Display mode for inline frame annotations. */
export type FrameAnnotationMode =
	| "none"
	| "all"
	| "forward"
	| "reverse"
	| FrameId;

const FORWARD_FRAMES: FrameId[] = ["+1", "+2", "+3"];
const REVERSE_FRAMES: FrameId[] = ["-1", "-2", "-3"];

/**
 * Resolve which frame IDs should render under a given display mode.
 *
 *  - "none": always empty.
 *  - "all": every frame in {+1..-3} that has at least one match.
 *  - "forward": forward frames that have at least one match.
 *  - "reverse": reverse frames that have at least one match.
 *  - Specific FrameId: that single frame, regardless of match presence
 *    (ORF-inspection mode).
 */
export function visibleFramesForMode(
	mode: FrameAnnotationMode,
	matches: ProteinMatch[]
): Set<FrameId> {
	if (mode === "none") return new Set();
	if (mode === "all") return annotatedFrameIds(matches);
	if (mode === "forward") {
		const annotated = annotatedFrameIds(matches);
		return new Set(FORWARD_FRAMES.filter((id) => annotated.has(id)));
	}
	if (mode === "reverse") {
		const annotated = annotatedFrameIds(matches);
		return new Set(REVERSE_FRAMES.filter((id) => annotated.has(id)));
	}
	// Specific frame: always rendered, no match filter.
	return new Set([mode]);
}
