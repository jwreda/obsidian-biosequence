import { Segment } from "../types";

/**
 * Render a horizontal bar track below the sequence showing colored segments.
 */
export function renderSegmentTrack(
	container: HTMLElement,
	sequenceContainer: HTMLElement,
	segments: Segment[],
	sequenceLength: number,
	gutterActive: boolean
): void {
	if (segments.length === 0) return;

	const track = container.createDiv({ cls: "biosequence-segment-track" });

	if (gutterActive) {
		track.addClass("biosequence-segment-track-gutter");
	}

	const bar = track.createDiv({ cls: "biosequence-segment-bar" });

	for (const segment of segments) {
		const leftPct = (segment.start / sequenceLength) * 100;
		const widthPct =
			((segment.end - segment.start) / sequenceLength) * 100;

		const rect = bar.createDiv({ cls: "biosequence-segment-rect" });
		rect.style.left = `${leftPct}%`;
		rect.style.width = `${widthPct}%`;
		rect.style.backgroundColor = segment.color;
		rect.setAttribute("title", `${segment.name} (${segment.start + 1}\u2013${segment.end})`);

		// Label inside the segment if wide enough
		if (widthPct > 8) {
			rect.createSpan({
				cls: "biosequence-segment-label",
				text: segment.name,
			});
		}

		// Hover interaction: highlight corresponding residues
		rect.addEventListener("mouseenter", () => {
			rect.addClass("biosequence-segment-hover");
			const residues = sequenceContainer.querySelectorAll<HTMLElement>(
				".biosequence-residue[data-pos]"
			);
			for (const res of Array.from(residues)) {
				const pos = parseInt(res.dataset.pos ?? "-1", 10);
				if (pos >= segment.start && pos < segment.end) {
					res.addClass("segment-highlight");
				}
			}
		});

		rect.addEventListener("mouseleave", () => {
			rect.removeClass("biosequence-segment-hover");
			const residues = sequenceContainer.querySelectorAll<HTMLElement>(
				".biosequence-residue[data-pos]"
			);
			for (const res of Array.from(residues)) {
				res.removeClass("segment-highlight");
			}
		});
	}

	// Legend below the bar
	const legend = track.createDiv({ cls: "biosequence-segment-legend" });
	for (const segment of segments) {
		const item = legend.createSpan({ cls: "biosequence-segment-legend-item" });
		const swatch = item.createSpan({ cls: "biosequence-segment-swatch" });
		swatch.style.backgroundColor = segment.color;
		item.createSpan({
			cls: "biosequence-segment-legend-text",
			text: segment.name,
		});
	}
}
