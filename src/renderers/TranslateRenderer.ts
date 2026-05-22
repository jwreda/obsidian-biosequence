// src/renderers/TranslateRenderer.ts
//
// Renders a sibling block under the existing nucleic-acid render showing
// 6 reading frames with protein-feature highlights. The container is appended
// to the same parent `el` provided by Obsidian — not nested inside the
// nucleic-acid container — so the existing renderer's internal empty()/render()
// cycle does not touch it.
//
// Stop and start (M) codon styling is gated on per-frame feature presence:
// frames with zero matches render plain residues with no stop/start emphasis.

import { BiosequenceSettings } from "../types";
import { translateAllFrames, Frame, FrameId } from "../calculations/translation";
import {
	matchProteinFeatures,
	annotatedFrameIds,
	ProteinMatch,
} from "../features/proteinFeatureMatcher";
import { parseNucleotideSequence } from "./NucleotideRenderer";

const FRAME_ORDER: FrameId[] = ["+1", "+2", "+3", "-1", "-2", "-3"];

export function renderTranslateBlock(
	source: string,
	parentEl: HTMLElement,
	settings: BiosequenceSettings
): void {
	if (!settings.showTranslateBlock) return;

	const parsed = parseNucleotideSequence(source, "dna");
	const sequence = parsed.sequence;
	if (sequence.length < 3) return;

	const container = parentEl.createDiv({ cls: "biosequence-translate-block" });

	const frames = translateAllFrames(sequence);
	const matches = matchProteinFeatures(frames, settings.featureLibrary);
	const annotated = annotatedFrameIds(matches);
	const matchesByFrame: Map<FrameId, ProteinMatch[]> = new Map();
	for (const id of FRAME_ORDER) matchesByFrame.set(id, []);
	for (const m of matches) matchesByFrame.get(m.frame)!.push(m);

	// Header
	const header = container.createDiv({ cls: "biosequence-translate-header" });
	if (matches.length === 0) {
		header.setText("No protein features matched in any reading frame");
	} else {
		const perFrame = FRAME_ORDER
			.filter((id) => matchesByFrame.get(id)!.length > 0)
			.map((id) => `${id}: ${matchesByFrame.get(id)!.length}`)
			.join(", ");
		header.setText(
			`${matches.length} protein feature ${matches.length === 1 ? "match" : "matches"} across 6 frames (${perFrame})`
		);
	}

	// Rows
	const framesByID = new Map(frames.map((f) => [f.id, f]));
	for (const id of FRAME_ORDER) {
		const frame = framesByID.get(id)!;
		const frameMatches = matchesByFrame.get(id)!;
		renderFrameRow(container, frame, frameMatches, annotated.has(id));
	}
}

function renderFrameRow(
	parent: HTMLElement,
	frame: Frame,
	frameMatches: ProteinMatch[],
	frameIsAnnotated: boolean
): void {
	const row = parent.createDiv({ cls: "biosequence-translate-frame" });

	const label = row.createSpan({ cls: "biosequence-translate-frame-label" });
	label.setText(`${frame.id}${frameMatches.length > 0 ? ` (${frameMatches.length})` : ""}`);

	const seqWrap = row.createSpan({ cls: "biosequence-translate-sequence" });

	if (frame.protein.length === 0) {
		seqWrap.createSpan({ text: "—", cls: "biosequence-translate-empty" });
		return;
	}

	// Precompute aa→match map (first match wins for highlight color; tooltip lists all).
	const matchAt: Array<ProteinMatch | null> = new Array(frame.protein.length).fill(null);
	const allMatchesAt: Array<ProteinMatch[]> = new Array(frame.protein.length)
		.fill(null)
		.map(() => []);
	for (const m of frameMatches) {
		for (let i = m.aaStart; i < m.aaEnd; i++) {
			if (matchAt[i] === null) matchAt[i] = m;
			allMatchesAt[i]!.push(m);
		}
	}

	for (let i = 0; i < frame.protein.length; i++) {
		const aa = frame.protein[i]!;
		const span = seqWrap.createSpan({ cls: "biosequence-translate-residue" });
		span.setText(aa);
		span.setAttr("data-aa-pos", String(i));

		const match = matchAt[i];
		if (match) {
			span.addClass("biosequence-translate-feature");
			span.setAttr("style", `background-color: ${match.color}`);
			const tipParts = allMatchesAt[i]!.map(
				(m) => `${m.name} | frame ${m.frame} | aa ${m.aaStart + 1}–${m.aaEnd} | nt ${m.ntStart + 1}–${m.ntEnd}`
			);
			span.setAttr("title", tipParts.join("\n"));
		}

		if (frameIsAnnotated) {
			if (aa === "*") span.addClass("biosequence-translate-stop");
			else if (aa === "M") span.addClass("biosequence-translate-start");
		}
	}
}
