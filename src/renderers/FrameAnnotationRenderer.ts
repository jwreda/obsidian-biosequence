// src/renderers/FrameAnnotationRenderer.ts
//
// Per-line, per-frame protein annotation rows. Appended to each
// .biosequence-line-wrapper after the ribbon rows, this renderer draws one
// labeled row per visible frame (frames with >=1 protein-feature match) and
// places an AA cell over every codon whose first nucleotide lies in the
// line's [lineStart, lineEnd) range.
//
// AA cells are absolutely positioned, anchored to the residue span for the
// codon's first nt via the data-pos posMap pattern used by annotationRenderer.

import { BiosequenceSettings } from "../types";
import { Frame, FrameId } from "../calculations/translation";
import { ProteinMatch } from "../features/proteinFeatureMatcher";

export const FRAME_ORDER: FrameId[] = ["+1", "+2", "+3", "-1", "-2", "-3"];

export interface FrameAnnotationContext {
	frames: Frame[];
	matches: ProteinMatch[];
	visibleFrameIds: Set<FrameId>;
}

interface AaIndexEntry {
	aa: string;
	aaIndex: number;
}

/**
 * Append per-frame annotation rows to lineWrapper for the line spanning
 * forward-strand nt positions [lineStart, lineEnd).
 *
 * Preconditions:
 *  - lineWrapper already contains a .biosequence-line with .biosequence-residue
 *    spans bearing data-pos attributes for the line's nt range.
 *  - ctx.visibleFrameIds is non-empty (caller short-circuits the empty case).
 */
export function renderFrameAnnotations(
	lineWrapper: HTMLElement,
	lineDiv: HTMLElement,
	lineStart: number,
	lineEnd: number,
	ctx: FrameAnnotationContext,
	settings: BiosequenceSettings
): void {
	if (ctx.visibleFrameIds.size === 0) return;

	// Build posMap for this line's residue spans.
	const residueEls = lineDiv.querySelectorAll<HTMLElement>(
		".biosequence-residue[data-pos]"
	);
	const posMap = new Map<number, HTMLElement>();
	for (const el of Array.from(residueEls)) {
		const pos = parseInt(el.dataset["pos"] ?? "-1", 10);
		if (pos >= 0) posMap.set(pos, el);
	}
	if (posMap.size === 0) return;

	// Reference origin for the absolute-positioned cells: the
	// .biosequence-frame-cells container we'll create per row. Cells container
	// shares left edge with .biosequence-residues (both are flex children to
	// the right of the gutter), but we compute relative to the cells container
	// itself so it composes cleanly under any future layout change.

	const framesByID = new Map(ctx.frames.map((f) => [f.id, f]));
	const matchesByFrame = new Map<FrameId, ProteinMatch[]>();
	for (const id of FRAME_ORDER) matchesByFrame.set(id, []);
	for (const m of ctx.matches) matchesByFrame.get(m.frame)!.push(m);

	for (const frameId of FRAME_ORDER) {
		if (!ctx.visibleFrameIds.has(frameId)) continue;

		const frame = framesByID.get(frameId);
		if (!frame) continue;
		const frameMatches = matchesByFrame.get(frameId)!;

		// Find codons whose first nt falls on this line.
		const codonsOnLine: AaIndexEntry[] = [];
		for (let i = 0; i < frame.protein.length; i++) {
			const ntStart = frame.codonStartsForward[i]!;
			if (ntStart >= lineStart && ntStart < lineEnd) {
				codonsOnLine.push({ aa: frame.protein[i]!, aaIndex: i });
			}
		}

		// Always render the row for visible frames (even if no codons land here),
		// so frame ordering / label column stays stable line-to-line.
		const row = document.createElement("div");
		row.className = "biosequence-frame-row";

		// Mirror the DNA line's gutter presence so the cells container starts
		// at the same x-offset as `.biosequence-residues`. When position
		// numbers are off, the DNA line has no gutter, so we omit the frame
		// label too and surface the frame ID via the row's title attribute.
		if (settings.showPositionNumbers) {
			const label = document.createElement("span");
			label.className = "biosequence-frame-label";
			label.textContent = frameId;
			row.appendChild(label);
		}
		row.title = `Frame ${frameId}`;

		const cells = document.createElement("div");
		cells.className = "biosequence-frame-cells";
		row.appendChild(cells);

		// Append the row now so getBoundingClientRect for `cells` is meaningful.
		lineWrapper.appendChild(row);

		if (codonsOnLine.length === 0) {
			continue;
		}

		const cellsRect = cells.getBoundingClientRect();

		// Precompute aa→match lookup for this frame, restricted to this line.
		const matchAt = new Map<number, ProteinMatch>(); // first match wins
		const allAt = new Map<number, ProteinMatch[]>();
		for (const m of frameMatches) {
			for (let i = m.aaStart; i < m.aaEnd; i++) {
				if (!matchAt.has(i)) matchAt.set(i, m);
				if (!allAt.has(i)) allAt.set(i, []);
				allAt.get(i)!.push(m);
			}
		}

		for (const codon of codonsOnLine) {
			const ntStart = frame.codonStartsForward[codon.aaIndex]!;
			const anchorEl = posMap.get(ntStart);
			if (!anchorEl) continue;

			const anchorRect = anchorEl.getBoundingClientRect();
			const residueWidth = anchorRect.width;

			const cell = document.createElement("div");
			cell.className = "biosequence-frame-cell";
			cell.textContent = codon.aa;
			cell.style.left = `${anchorRect.left - cellsRect.left}px`;
			cell.style.width = `${residueWidth * 3}px`;

			const match = matchAt.get(codon.aaIndex);
			if (match) {
				cell.classList.add("biosequence-frame-cell-feature");
				cell.style.backgroundColor = match.color;
				const all = allAt.get(codon.aaIndex)!;
				const tip = all
					.map(
						(m) =>
							`${m.name} | frame ${m.frame} | aa ${m.aaStart + 1}–${m.aaEnd} | nt ${m.ntStart + 1}–${m.ntEnd}`
					)
					.join("\n");
				cell.title = tip;
			} else {
				cell.title = `${codon.aa} (frame ${frameId}, aa ${codon.aaIndex + 1}, nt ${ntStart + 1}–${ntStart + 3})`;
			}

			if (codon.aa === "*") cell.classList.add("biosequence-frame-cell-stop");
			else if (codon.aa === "M") cell.classList.add("biosequence-frame-cell-start");

			cells.appendChild(cell);
		}
	}

	lineWrapper.classList.add("has-frame-annotations");
}
