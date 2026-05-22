import {
	AnnotatedSegment,
	AnnotationDisplayMode,
	BiosequenceSettings,
	ColorScheme,
	NucleotideColorSchemeId,
	NucleotideProperties,
	ParsedSequence,
	Segment,
	SequenceType,
} from "../types";
import { autoContrast } from "../colorSchemes/aminoAcid";
import {
	getNucleotideScheme,
	getNucleotideSchemeList,
} from "../colorSchemes/index";
import { calculateNucleotideProperties } from "../calculations/nucleotideProps";
import { NUCLEOTIDE_LEGEND_DATA } from "../colorSchemes/legendData";
import {
	parseInlineAnnotations,
	parseRangeAnnotations,
	hasInlineAnnotations,
	colorizeSegments,
} from "../parsing/segmentParser";
import { attachSelectionHandlers } from "./selectionHandler";
import { renderLineRibbons, renderBadgeBar, renderAnnotationLegend } from "./annotationRenderer";
import { matchFeatures, mergeSegments } from "../features/featureMatcher";
import {
	createReflowObserver,
	computeInitialResiduesPerLine,
	measureResiduesPerLine,
} from "./reflowManager";
import { applySearchHighlight } from "./searchHighlight";
import { translateAllFrames } from "../calculations/translation";
import { matchProteinFeatures, annotatedFrameIds } from "../features/proteinFeatureMatcher";
import {
	renderFrameAnnotations,
	FrameAnnotationContext,
} from "./FrameAnnotationRenderer";

const VALID_DNA = new Set("ATGC".split(""));
const VALID_RNA = new Set("AUGC".split(""));

export function parseNucleotideSequence(
	source: string,
	type: SequenceType
): ParsedSequence {
	const lines = source.split("\n");
	let header: string | null = null;

	const firstLine = lines[0];
	if (firstLine !== undefined && firstLine.startsWith(">")) {
		header = firstLine.substring(1).trim();
	}

	// Filter out FASTA headers
	const nonHeaderLines = lines.filter((l) => !l.startsWith(">"));

	// Check for --- delimiter (Approach B: range annotations)
	const delimiterIdx = nonHeaderLines.findIndex((l) => l.trim() === "---");
	let seqLines: string[];
	let annotationLines: string[] = [];
	let segments: Segment[] = [];

	if (delimiterIdx >= 0) {
		seqLines = nonHeaderLines.slice(0, delimiterIdx);
		annotationLines = nonHeaderLines.slice(delimiterIdx + 1);
	} else {
		seqLines = nonHeaderLines;
	}

	const validSet = type === "dna" ? VALID_DNA : VALID_RNA;

	// Check for inline annotations (Approach A)
	if (hasInlineAnnotations(seqLines)) {
		const result = parseInlineAnnotations(seqLines);
		const cleaned = result.cleanedText.toUpperCase();

		const invalidPositions: number[] = [];
		const chars: string[] = [];
		for (let i = 0; i < cleaned.length; i++) {
			const ch = cleaned.charAt(i);
			chars.push(ch);
			if (!validSet.has(ch)) {
				invalidPositions.push(i);
			}
		}

		const sequence = chars.join("");
		const inlineColored = colorizeSegments(result.segments);

		// Also parse range annotations if present (merge both approaches)
		if (annotationLines.length > 0) {
			const rangeRaw = parseRangeAnnotations(annotationLines);
			const rangeColored = colorizeSegments(rangeRaw, result.segments.length);
			segments = [...inlineColored, ...rangeColored];
		} else {
			segments = inlineColored;
		}

		return {
			raw: source,
			sequence,
			type,
			header,
			isValid: invalidPositions.length === 0 && sequence.length > 0,
			invalidPositions,
			segments,
		};
	}

	// Standard parsing (no inline annotations)
	const raw = seqLines.join("");
	const cleaned = raw.replace(/[\s\d\-*]/g, "").toUpperCase();

	const invalidPositions: number[] = [];
	const chars: string[] = [];

	for (let i = 0; i < cleaned.length; i++) {
		const ch = cleaned.charAt(i);
		chars.push(ch);
		if (!validSet.has(ch)) {
			invalidPositions.push(i);
		}
	}

	const sequence = chars.join("");

	// Parse range annotations if present (Approach B)
	if (annotationLines.length > 0) {
		const rawSegments = parseRangeAnnotations(annotationLines);
		segments = colorizeSegments(rawSegments);
	}

	return {
		raw: source,
		sequence,
		type,
		header,
		isValid: invalidPositions.length === 0 && sequence.length > 0,
		invalidPositions,
		segments,
	};
}

function renderToolbar(
	container: HTMLElement,
	type: SequenceType,
	currentSchemeId: NucleotideColorSchemeId,
	sequence: string,
	onSchemeChange: (id: NucleotideColorSchemeId) => void,
	currentDisplayMode: AnnotationDisplayMode,
	onDisplayModeToggle: () => void,
	onRefresh: () => void
): void {
	const toolbar = container.createDiv({ cls: "biosequence-toolbar" });
	toolbar.createSpan({
		cls: "biosequence-type-label",
		text: type.toUpperCase(),
	});

	const select = toolbar.createEl("select", {
		cls: "biosequence-scheme-select",
	});

	const schemes = getNucleotideSchemeList();
	for (const scheme of schemes) {
		const opt = select.createEl("option", {
			text: scheme.name,
			value: scheme.id,
		});
		if (scheme.id === currentSchemeId) {
			opt.selected = true;
		}
	}

	select.addEventListener("change", () => {
		onSchemeChange(select.value as NucleotideColorSchemeId);
	});

	toolbar.createSpan({
		cls: "biosequence-length",
		text: `(${sequence.length} nt)`,
	});

	// Copy button
	const copyBtn = toolbar.createEl("button", {
		cls: "biosequence-copy-btn",
		text: "Copy",
	});

	copyBtn.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(sequence);
			const originalText = copyBtn.textContent;
			copyBtn.textContent = "Copied!";
			copyBtn.addClass("copied");
			setTimeout(() => {
				copyBtn.textContent = originalText;
				copyBtn.removeClass("copied");
			}, 1500);
		} catch (err) {
			console.error("Failed to copy sequence:", err);
		}
	});

	// Display mode toggle
	const modeBtn = toolbar.createEl("button", {
		cls: "biosequence-copy-btn",
		text: currentDisplayMode === "ribbons" ? "\u2630 Badges" : "\u2630 Ribbons",
		title: `Switch to ${currentDisplayMode === "ribbons" ? "badge" : "ribbon"} annotations`,
	});
	modeBtn.addEventListener("click", onDisplayModeToggle);

	// Refresh button
	const refreshBtn = toolbar.createEl("button", {
		cls: "biosequence-copy-btn",
		text: "\u21BB",
		title: "Refresh view and re-match features",
	});
	refreshBtn.addEventListener("click", onRefresh);
}

function renderLegend(
	container: HTMLElement,
	schemeId: NucleotideColorSchemeId
): void {
	const metadata = NUCLEOTIDE_LEGEND_DATA[schemeId];
	if (!metadata) return;
	if (metadata.legendType === "categorical" && (!metadata.groups || metadata.groups.length === 0)) return;

	const details = container.createEl("details", {
		cls: "biosequence-legend",
	});
	details.createEl("summary", { text: "Color Scheme Legend" });

	const content = details.createDiv({ cls: "biosequence-legend-content" });

	if (metadata.legendType === "categorical" && metadata.groups) {
		const grid = content.createDiv({ cls: "biosequence-legend-grid" });
		for (const group of metadata.groups) {
			const entry = grid.createDiv({ cls: "biosequence-legend-entry" });
			const swatch = entry.createDiv({ cls: "biosequence-legend-swatch" });
			swatch.style.backgroundColor = group.color;
			swatch.style.color = group.textColor;
			swatch.textContent = group.residues.join("");
			entry.createSpan({
				cls: "biosequence-legend-label",
				text: group.label,
			});
		}
	}
}

function renderColoredSequence(
	seqDiv: HTMLElement,
	sequence: string,
	scheme: ColorScheme,
	settings: BiosequenceSettings,
	invalidPositions: number[],
	residuesPerLine: number,
	allSegments: AnnotatedSegment[],
	displayMode: AnnotationDisplayMode,
	selectRange: (start: number, end: number) => void,
	frameContext: FrameAnnotationContext | null
): void {
	const invalidSet = new Set(invalidPositions);
	const lineCount = Math.ceil(sequence.length / residuesPerLine);

	for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
		const start = lineIdx * residuesPerLine;
		const end = Math.min(start + residuesPerLine, sequence.length);

		const lineWrapper = seqDiv.createDiv({ cls: "biosequence-line-wrapper" });
		const lineDiv = lineWrapper.createDiv({ cls: "biosequence-line" });

		if (settings.showPositionNumbers) {
			lineDiv.createSpan({
				cls: "biosequence-gutter",
				text: String(start + 1),
			});
		}

		const residuesSpan = lineDiv.createSpan({
			cls: "biosequence-residues",
		});

		for (let i = start; i < end; i++) {
			const ch = sequence.charAt(i);
			const bgColor = scheme.colors[ch] ?? "#E0E0E0";

			// Build tooltip with feature names at this position
			const featuresAtPos = allSegments.filter(
				(s) => s.start <= i && s.end > i
			);
			let title = `${ch} (pos ${i + 1})`;
			if (featuresAtPos.length > 0) {
				const featureNames = featuresAtPos.map((f) => f.name).join(", ");
				title += ` | ${featureNames}`;
			}

			const span = residuesSpan.createSpan({
				cls: "biosequence-residue",
				text: ch,
				title,
			});
			span.dataset["pos"] = String(i);

			if (bgColor === "") {
				span.classList.add("biosequence-residue-neutral");
			} else {
				const textColor =
					scheme.textColors?.[ch] ?? autoContrast(bgColor);
				span.style.backgroundColor = bgColor;
				span.style.color = textColor;
			}

			if (invalidSet.has(i)) {
				span.addClass("invalid");
			}
		}

		if (settings.showPositionNumbers) {
			lineDiv.createSpan({
				cls: "biosequence-gutter-right",
				text: String(end),
			});
		}

		// Render ribbon annotations for this line
		if (allSegments.length > 0 && displayMode === "ribbons") {
			renderLineRibbons(
				lineWrapper,
				lineDiv,
				seqDiv,
				allSegments,
				start,
				end,
				settings.showPositionNumbers,
				settings.sequenceFontSize,
				selectRange
			);
		}

		// Render protein-feature frame rows for this line (DNA only, gated).
		if (frameContext && frameContext.visibleFrameIds.size > 0) {
			renderFrameAnnotations(
				lineWrapper,
				lineDiv,
				start,
				end,
				frameContext,
				settings
			);
		}
	}

	// Render badge bar after all lines (badge mode only)
	if (allSegments.length > 0 && displayMode === "badges") {
		renderBadgeBar(seqDiv, allSegments, selectRange);
	}
}

function countBases(sequence: string): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const ch of sequence) {
		counts[ch] = (counts[ch] ?? 0) + 1;
	}
	return counts;
}

function renderNucleotideSummaryPanel(
	container: HTMLElement,
	props: NucleotideProperties,
	type: SequenceType,
	sequence: string,
	expanded: boolean
): void {
	const summary = container.createEl("details", { cls: "biosequence-summary" });
	summary.open = expanded;
	const typeLabel = type === "dna" ? "DNA" : "RNA";
	summary.createEl("summary", {
		cls: "biosequence-summary-header",
		text: `${typeLabel} Properties`,
	});

	const grid = summary.createDiv({ cls: "biosequence-summary-grid" });

	function addProp(label: string, value: string): void {
		const prop = grid.createDiv({ cls: "biosequence-prop" });
		prop.createSpan({ cls: "biosequence-prop-label", text: label });
		prop.createSpan({ cls: "biosequence-prop-value", text: value });
	}

	addProp("Length", `${props.length} nt`);
	addProp("GC Content", `${props.gcPercent.toFixed(1)}%`);
	addProp(
		"Molecular Weight",
		props.molecularWeight.toLocaleString(undefined, {
			maximumFractionDigits: 1,
		}) + " Da"
	);
	addProp("Melting Temp (Tm)", `${props.meltingTemp.toFixed(1)} \u00B0C`);

	const bases = countBases(sequence);
	const tuBase = type === "dna" ? "T" : "U";
	addProp(
		"Nucleotide Counts",
		`A: ${bases["A"] ?? 0} | ${tuBase}: ${bases[tuBase] ?? 0} | G: ${bases["G"] ?? 0} | C: ${bases["C"] ?? 0}`
	);

	// Complement
	const compDiv = grid.createDiv({ cls: "biosequence-prop" });
	compDiv.createSpan({ cls: "biosequence-prop-label", text: "Complement" });
	const compVal = compDiv.createSpan({ cls: "biosequence-prop-value biosequence-complement" });
	if (props.complement.length > 60) {
		compVal.textContent = props.complement.substring(0, 60) + "...";
		compVal.title = props.complement;
	} else {
		compVal.textContent = props.complement;
	}

	// Reverse Complement
	const rcDiv = grid.createDiv({ cls: "biosequence-prop" });
	rcDiv.createSpan({
		cls: "biosequence-prop-label",
		text: "Reverse Complement",
	});
	const rcVal = rcDiv.createSpan({ cls: "biosequence-prop-value biosequence-complement" });
	if (props.reverseComplement.length > 60) {
		rcVal.textContent = props.reverseComplement.substring(0, 60) + "...";
		rcVal.title = props.reverseComplement;
	} else {
		rcVal.textContent = props.reverseComplement;
	}
}

export function renderNucleotideBlock(
	source: string,
	el: HTMLElement,
	type: SequenceType,
	settings: BiosequenceSettings
): void {
	const container = el.createDiv({
		cls: `biosequence-block biosequence-${type}`,
	});
	const parsed = parseNucleotideSequence(source, type);

	if (parsed.sequence.length === 0) {
		container.createEl("p", {
			text: `No valid ${type.toUpperCase()} sequence found`,
			cls: "biosequence-error",
		});
		return;
	}

	const defaultScheme =
		type === "dna" ? settings.defaultDNAScheme : settings.defaultRNAScheme;
	let currentSchemeId = defaultScheme;
	let currentDisplayMode: AnnotationDisplayMode = settings.annotationDisplayMode;
	let selectionCleanup: (() => void) | null = null;
	let searchTerm = "";

	function render(residuesPerLine: number): void {
		// Match library features and merge with inline/range segments
		const featureMatches = matchFeatures(parsed.sequence, settings.featureLibrary, type);
		const allSegments = mergeSegments(parsed.segments, featureMatches);

		// Compute frame-annotation context (DNA only, gated by setting).
		let frameContext: FrameAnnotationContext | null = null;
		if (type === "dna" && settings.showFrameAnnotations && parsed.sequence.length >= 3) {
			const frames = translateAllFrames(parsed.sequence);
			const matches = matchProteinFeatures(frames, settings.featureLibrary);
			const visibleFrameIds = annotatedFrameIds(matches);
			frameContext = { frames, matches, visibleFrameIds };
		}

		// Clean up previous handlers
		if (selectionCleanup) {
			selectionCleanup();
			selectionCleanup = null;
		}

		container.empty();
		const scheme = getNucleotideScheme(currentSchemeId);

		if (parsed.header) {
			container.createDiv({
				cls: "biosequence-header",
				text: parsed.header,
			});
		}

		renderToolbar(
			container,
			type,
			currentSchemeId,
			parsed.sequence,
			(newId) => {
				currentSchemeId = newId;
				render(residuesPerLine);
			},
			currentDisplayMode,
			() => {
				currentDisplayMode = currentDisplayMode === "ribbons" ? "badges" : "ribbons";
				render(residuesPerLine);
			},
			() => render(residuesPerLine)
		);

		renderLegend(container, currentSchemeId);

		// Search bar (only when search scheme is active)
		let searchBarEl: HTMLElement | null = null;
		if (currentSchemeId === "search") {
			searchBarEl = container.createDiv({ cls: "biosequence-search-bar" });
			const searchInput = searchBarEl.createEl("input", {
				type: "text",
				placeholder: "Search sequence\u2026",
				cls: "biosequence-search-input",
			}) as HTMLInputElement;
			searchInput.value = searchTerm;

			const matchInfo = searchBarEl.createSpan({ cls: "biosequence-search-match-info" });

			const clearBtn = searchBarEl.createEl("button", {
				text: "\u00D7",
				cls: "biosequence-search-clear",
				title: "Clear search",
			});
			clearBtn.style.visibility = searchTerm ? "visible" : "hidden";

			(searchBarEl as any)._searchInput = searchInput;
			(searchBarEl as any)._matchInfo = matchInfo;
			(searchBarEl as any)._clearBtn = clearBtn;
		}

		// Create seqDiv first, attach selection handlers (they query DOM dynamically),
		// then populate sequence lines with selectRange available for annotations
		const seqDiv = container.createDiv({ cls: "biosequence-sequence" });
		seqDiv.style.fontSize = `${settings.sequenceFontSize}px`;

		const selection = attachSelectionHandlers(
			seqDiv,
			container,
			parsed.sequence,
			(subsequence) => {
				searchTerm = subsequence;
				currentSchemeId = "search";
				render(residuesPerLine);
			}
		);
		selectionCleanup = selection.cleanup;

		renderColoredSequence(
			seqDiv,
			parsed.sequence,
			scheme,
			settings,
			parsed.invalidPositions,
			residuesPerLine,
			allSegments,
			currentDisplayMode,
			selection.selectRange,
			frameContext
		);

		// Attach search handlers after sequence is rendered
		if (searchBarEl && currentSchemeId === "search") {
			const searchInput = (searchBarEl as any)._searchInput as HTMLInputElement;
			const matchInfo = (searchBarEl as any)._matchInfo as HTMLElement;
			const clearBtn = (searchBarEl as any)._clearBtn as HTMLElement;

			const updateSearch = (): void => {
				searchTerm = searchInput.value;
				clearBtn.style.visibility = searchTerm ? "visible" : "hidden";
				const count = applySearchHighlight(
					seqDiv, parsed.sequence, searchTerm, settings.searchHighlightColor
				);
				if (searchTerm.length === 0) {
					matchInfo.textContent = "";
				} else {
					matchInfo.textContent = `${count} match${count !== 1 ? "es" : ""}`;
					if (count === 0) {
						matchInfo.classList.add("no-matches");
					} else {
						matchInfo.classList.remove("no-matches");
					}
				}
			};

			searchInput.addEventListener("input", updateSearch);
			clearBtn.addEventListener("click", () => {
				searchInput.value = "";
				updateSearch();
				searchInput.focus();
			});

			if (searchTerm) updateSearch();
			searchInput.focus();
		}

		// Render annotation legend
		if (allSegments.length > 0) {
			renderAnnotationLegend(container, allSegments, seqDiv, selection.selectRange);
		}

		const props = calculateNucleotideProperties(parsed.sequence, type);
		renderNucleotideSummaryPanel(container, props, type, parsed.sequence, settings.summaryExpanded);
	}

	// Compute initial residues per line from container width
	const initialResiduesPerLine = computeInitialResiduesPerLine(
		container,
		settings.showPositionNumbers,
		settings.sequenceFontSize,
		settings.residuesPerLine
	);

	render(initialResiduesPerLine);

	// One-shot DOM measurement: correct if formula underestimated
	const measured = measureResiduesPerLine(
		container,
		settings.showPositionNumbers,
		settings.residuesPerLine
	);
	if (measured !== null && measured > initialResiduesPerLine) {
		render(measured);
	}

	// Attach reflow observer
	createReflowObserver(
		container,
		settings.showPositionNumbers,
		settings.sequenceFontSize,
		settings.residuesPerLine,
		(newResiduesPerLine) => {
			render(newResiduesPerLine);
		}
	);
}
