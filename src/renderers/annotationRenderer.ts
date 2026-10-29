import { AnnotatedSegment } from "../types";

/**
 * Assign segments to non-overlapping lanes using greedy interval scheduling.
 * Segments are sorted by start position, then wider segments first for ties.
 */
function assignLanes(segments: AnnotatedSegment[]): AnnotatedSegment[][] {
	const sorted = [...segments].sort((a, b) => {
		if (a.start !== b.start) return a.start - b.start;
		return (b.end - b.start) - (a.end - a.start);
	});

	const lanes: AnnotatedSegment[][] = [];

	for (const seg of sorted) {
		let placed = false;
		for (const lane of lanes) {
			const last = lane[lane.length - 1];
			if (last !== undefined && last.end <= seg.start) {
				lane.push(seg);
				placed = true;
				break;
			}
		}
		if (!placed) {
			lanes.push([seg]);
		}
	}

	return lanes;
}

export function highlightResidues(containerDiv: HTMLElement, start: number, end: number, color: string): void {
	const residues = containerDiv.querySelectorAll<HTMLElement>(".biosequence-residue[data-pos]");
	for (const res of Array.from(residues)) {
		const pos = parseInt(res.dataset["pos"] ?? "-1", 10);
		if (pos >= start && pos < end) {
			res.classList.add("segment-highlight");
			res.style.setProperty("--segment-color", color);
		}
	}
}

export function clearHighlights(containerDiv: HTMLElement): void {
	const residues = containerDiv.querySelectorAll<HTMLElement>(".biosequence-residue.segment-highlight");
	for (const res of Array.from(residues)) {
		res.classList.remove("segment-highlight");
		res.style.removeProperty("--segment-color");
	}
}

/**
 * Render colored ribbons below a sequence line for overlapping features.
 * Each feature gets its own lane (row). Ribbons are aligned with residue positions.
 *
 * @param lineWrapper - The wrapper div containing the line div; ribbon rows are appended here
 * @param lineDiv - The div containing the residue spans (used for highlight targeting)
 * @param seqDiv - The entire sequence container div (for full-range highlighting)
 * @param segments - All annotated segments for the full sequence
 * @param lineStart - 0-indexed start position of this line
 * @param lineEnd - 0-indexed exclusive end position of this line
 * @param gutterActive - Whether position numbers are shown (affects left padding)
 * @param fontSize - Current font size in pixels
 * @param selectRange - Callback to select a range in the sequence
 */
export function renderLineRibbons(
	lineWrapper: HTMLElement,
	lineDiv: HTMLElement,
	seqDiv: HTMLElement,
	segments: AnnotatedSegment[],
	lineStart: number,
	lineEnd: number,
	gutterActive: boolean,
	fontSize: number,
	selectRange: (start: number, end: number) => void
): void {
	// Find segments overlapping [lineStart, lineEnd)
	const overlapping = segments.filter(
		(s) => s.start < lineEnd && s.end > lineStart
	);
	if (overlapping.length === 0) return;

	// Assign to non-overlapping lanes (greedy interval scheduling)
	const lanes = assignLanes(overlapping);

	// Build a map of data-pos -> residue element for DOM-measured positioning
	const residueEls = lineDiv.querySelectorAll<HTMLElement>(".biosequence-residue[data-pos]");
	const posMap = new Map<number, HTMLElement>();
	for (const el of Array.from(residueEls)) {
		const pos = parseInt(el.dataset["pos"] ?? "-1", 10);
		if (pos >= 0) posMap.set(pos, el);
	}

	// Reference origin: lineWrapper left edge (ribbon rows share this origin)
	const wrapperRect = lineWrapper.getBoundingClientRect();

	for (const lane of lanes) {
		const ribbonRow = document.createElement("div");
		ribbonRow.className = "biosequence-ribbon-row";

		for (const seg of lane) {
			// Clamp to line bounds
			const clampedStart = Math.max(seg.start, lineStart);
			const clampedEnd = Math.min(seg.end, lineEnd);

			// Look up actual DOM elements for start and end residues
			const startEl = posMap.get(clampedStart);
			const endEl = posMap.get(clampedEnd - 1); // end is exclusive
			if (!startEl || !endEl) continue;

			const startRect = startEl.getBoundingClientRect();
			const endRect = endEl.getBoundingClientRect();

			const ribbon = document.createElement("div");
			ribbon.className = "biosequence-ribbon";
			if (seg.source === "library") {
				ribbon.classList.add("biosequence-ribbon-library");
			}
			ribbon.style.left = `${startRect.left - wrapperRect.left}px`;
			ribbon.style.width = `${endRect.right - startRect.left}px`;
			ribbon.style.backgroundColor = seg.color;
			ribbon.title = `${seg.name} (${seg.start + 1}\u2013${seg.end})${seg.strand === "-" ? " [reverse strand]" : ""}${seg.source === "library" ? " [library]" : ""}`;

			// Label if wide enough (>6 characters)
			const widthChars = clampedEnd - clampedStart;
			if (widthChars > 6) {
				const label = document.createElement("span");
				label.className = "biosequence-ribbon-label";
				label.textContent = seg.name;
				ribbon.appendChild(label);
			}

			// Hover: highlight full feature range across all lines
			ribbon.addEventListener("mouseenter", () => {
				ribbon.classList.add("biosequence-ribbon-hover");
				highlightResidues(seqDiv, seg.start, seg.end, seg.color);
			});
			ribbon.addEventListener("mouseleave", () => {
				ribbon.classList.remove("biosequence-ribbon-hover");
				clearHighlights(seqDiv);
			});

			// Click: select full feature range
			ribbon.addEventListener("mousedown", (e) => e.stopPropagation());
			ribbon.addEventListener("click", (e) => {
				e.stopPropagation();
				selectRange(seg.start, seg.end - 1);
			});

			ribbonRow.appendChild(ribbon);
		}

		lineWrapper.appendChild(ribbonRow);
	}

	lineWrapper.classList.add("has-ribbons");
}

/**
 * Render a badge bar with one badge per unique feature, below all sequence lines.
 * Does not affect line flow — rendered as a separate block element.
 */
export function renderBadgeBar(
	seqDiv: HTMLElement,
	segments: AnnotatedSegment[],
	selectRange: (start: number, end: number) => void
): void {
	if (segments.length === 0) return;

	const badgeBar = document.createElement("div");
	badgeBar.className = "biosequence-badge-bar";

	for (const seg of segments) {
		const badge = document.createElement("span");
		badge.className = "biosequence-badge";
		badge.title = `${seg.name} (${seg.start + 1}\u2013${seg.end})${seg.strand === "-" ? " [reverse strand]" : ""}${seg.source === "library" ? " [library]" : ""}`;

		const dot = document.createElement("span");
		dot.className = "biosequence-badge-dot";
		dot.style.backgroundColor = seg.color;
		badge.appendChild(dot);

		const text = document.createElement("span");
		text.className = "biosequence-badge-text";
		text.textContent = seg.name;
		badge.appendChild(text);

		// Hover: highlight full feature range across all lines
		badge.addEventListener("mouseenter", () => {
			highlightResidues(seqDiv, seg.start, seg.end, seg.color);
		});
		badge.addEventListener("mouseleave", () => {
			clearHighlights(seqDiv);
		});

		// Click: select full feature range
		badge.addEventListener("mousedown", (e) => e.stopPropagation());
		badge.addEventListener("click", (e) => {
			e.stopPropagation();
			selectRange(seg.start, seg.end - 1);
		});

		badgeBar.appendChild(badge);
	}

	seqDiv.appendChild(badgeBar);
}

/**
 * Render a collapsible annotation legend below the sequence.
 */
export function renderAnnotationLegend(
	container: HTMLElement,
	segments: AnnotatedSegment[],
	seqDiv: HTMLElement,
	selectRange: (start: number, end: number) => void
): void {
	if (segments.length === 0) return;

	const details = container.createEl("details", { cls: "biosequence-annotation-legend" });
	details.createEl("summary", { text: `Annotations (${segments.length})` });

	const content = details.createDiv({ cls: "biosequence-annotation-legend-content" });
	for (const seg of segments) {
		const item = content.createDiv({ cls: "biosequence-annotation-legend-item" });
		const swatch = item.createSpan({ cls: "biosequence-annotation-swatch" });
		swatch.style.backgroundColor = seg.color;
		if (seg.source === "library") {
			swatch.classList.add("biosequence-annotation-swatch-library");
		}
		item.createSpan({
			cls: "biosequence-annotation-legend-text",
			text: `${seg.name} (${seg.start + 1}\u2013${seg.end})${seg.strand === "-" ? " \u2190" : ""}`,
		});
		if (seg.source === "library") {
			item.createSpan({
				cls: "biosequence-annotation-source-tag",
				text: "library",
			});
		}

		// Hover: highlight full feature range
		item.addEventListener("mouseenter", () => {
			highlightResidues(seqDiv, seg.start, seg.end, seg.color);
		});
		item.addEventListener("mouseleave", () => {
			clearHighlights(seqDiv);
		});

		// Click: select full feature range
		item.addEventListener("mousedown", (e) => e.stopPropagation());
		item.addEventListener("click", (e) => {
			e.stopPropagation();
			selectRange(seg.start, seg.end - 1);
		});
	}
}
