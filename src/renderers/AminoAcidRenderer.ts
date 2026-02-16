import {
	AAColorSchemeId,
	AnnotatedSegment,
	AnnotationDisplayMode,
	BiosequenceSettings,
	ColorScheme,
	ParsedSequence,
	ProteinProperties,
	Segment,
} from "../types";
import { autoContrast } from "../colorSchemes/aminoAcid";
import { getAAScheme, getAASchemeList } from "../colorSchemes/index";
import { calculateProteinProperties } from "../calculations/proteinProps";
import { AA_LEGEND_DATA } from "../colorSchemes/legendData";
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
} from "./reflowManager";

const VALID_AA = new Set("ACDEFGHIKLMNPQRSTVWY".split(""));

function parseAASequence(source: string): ParsedSequence {
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

	// Check for inline annotations (Approach A)
	if (hasInlineAnnotations(seqLines)) {
		const result = parseInlineAnnotations(seqLines);
		const cleaned = result.cleanedText.toUpperCase();

		const invalidPositions: number[] = [];
		const chars: string[] = [];
		for (let i = 0; i < cleaned.length; i++) {
			const ch = cleaned.charAt(i);
			chars.push(ch);
			if (!VALID_AA.has(ch)) {
				invalidPositions.push(i);
			}
		}

		const sequence = chars.join("");
		segments = colorizeSegments(result.segments);

		return {
			raw: source,
			sequence,
			type: "aa",
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
		if (!VALID_AA.has(ch)) {
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
		type: "aa",
		header,
		isValid: invalidPositions.length === 0 && sequence.length > 0,
		invalidPositions,
		segments,
	};
}

function renderToolbar(
	container: HTMLElement,
	currentSchemeId: AAColorSchemeId,
	sequence: string,
	onSchemeChange: (id: AAColorSchemeId) => void
): void {
	const toolbar = container.createDiv({ cls: "biosequence-toolbar" });
	toolbar.createSpan({ cls: "biosequence-type-label", text: "AA" });

	const select = toolbar.createEl("select", {
		cls: "biosequence-scheme-select",
	});

	const schemes = getAASchemeList();
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
		onSchemeChange(select.value as AAColorSchemeId);
	});

	toolbar.createSpan({
		cls: "biosequence-length",
		text: `(${sequence.length} aa)`,
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
}

function renderLegend(
	container: HTMLElement,
	schemeId: AAColorSchemeId
): void {
	const metadata = AA_LEGEND_DATA[schemeId];
	if (!metadata) return;

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
	} else if (
		metadata.legendType === "spectrum" &&
		metadata.spectrumLabel &&
		metadata.spectrumColors
	) {
		const spectrum = content.createDiv({ cls: "biosequence-legend-spectrum" });
		spectrum.createSpan({
			cls: "biosequence-legend-spectrum-label",
			text: metadata.spectrumLabel.low,
		});
		const bar = spectrum.createDiv({
			cls: "biosequence-legend-spectrum-bar",
		});
		bar.style.background = `linear-gradient(to right, ${metadata.spectrumColors.low}, ${metadata.spectrumColors.high})`;
		spectrum.createSpan({
			cls: "biosequence-legend-spectrum-label",
			text: metadata.spectrumLabel.high,
		});
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
	selectRange: (start: number, end: number) => void
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
			const textColor =
				scheme.textColors?.[ch] ?? autoContrast(bgColor);

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
			span.style.backgroundColor = bgColor;
			span.style.color = textColor;

			if (invalidSet.has(i)) {
				span.addClass("invalid");
			}
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
	}

	// Render badge bar after all lines (badge mode only)
	if (allSegments.length > 0 && displayMode === "badges") {
		renderBadgeBar(seqDiv, allSegments, selectRange);
	}
}

function renderSummaryPanel(
	container: HTMLElement,
	props: ProteinProperties
): void {
	const summary = container.createDiv({ cls: "biosequence-summary" });
	summary.createDiv({
		cls: "biosequence-summary-header",
		text: "Protein Properties",
	});

	const grid = summary.createDiv({ cls: "biosequence-summary-grid" });

	function addProp(label: string, value: string): HTMLElement {
		const prop = grid.createDiv({ cls: "biosequence-prop" });
		prop.createSpan({ cls: "biosequence-prop-label", text: label });
		const valSpan = prop.createSpan({ cls: "biosequence-prop-value" });
		valSpan.textContent = value;
		return valSpan;
	}

	addProp(
		"Molecular Weight",
		props.molecularWeight.toLocaleString(undefined, {
			maximumFractionDigits: 1,
		}) + " Da"
	);
	addProp("Theoretical pI", props.theoreticalPI.toFixed(2));
	addProp(
		"Extinction Coefficient",
		`${props.extinctionCoefficient.toLocaleString()} M\u207B\u00B9cm\u207B\u00B9 (reduced)`
	);
	addProp(
		"Ext. Coeff. (SS bonds)",
		`${props.extinctionCoefficientSS.toLocaleString()} M\u207B\u00B9cm\u207B\u00B9`
	);
	addProp(
		"Abs 0.1% (1 g/L)",
		`${props.absorbance01.toFixed(3)} (reduced) / ${props.absorbance01SS.toFixed(3)} (SS bonds)`
	);
	addProp("GRAVY", props.gravy.toFixed(3));
	addProp("Aliphatic Index", props.aliphaticIndex.toFixed(2));

	const iiVal = addProp(
		"Instability Index",
		props.instabilityIndex.toFixed(2) + " "
	);
	iiVal.createSpan({
		cls: props.isStable ? "stable" : "unstable",
		text: props.isStable ? "(stable)" : "(unstable)",
	});

	addProp("Molecular Formula", props.formula);

	// Amino acid composition as collapsible details
	const details = summary.createEl("details", {
		cls: "biosequence-composition",
	});
	details.createEl("summary", { text: "Amino Acid Composition" });

	const table = details.createEl("table");
	const thead = table.createEl("thead");
	const headerRow = thead.createEl("tr");
	headerRow.createEl("th", { text: "Residue" });
	headerRow.createEl("th", { text: "Count" });
	headerRow.createEl("th", { text: "%" });

	const tbody = table.createEl("tbody");
	const aaOrder = "ACDEFGHIKLMNPQRSTVWY".split("");
	for (const aa of aaOrder) {
		const count = props.composition.counts[aa] ?? 0;
		const pct = props.composition.percentages[aa] ?? 0;
		const row = tbody.createEl("tr");
		row.createEl("td", { text: aa });
		row.createEl("td", { text: String(count) });
		row.createEl("td", { text: pct.toFixed(1) });
	}
}

export function renderAminoAcidBlock(
	source: string,
	el: HTMLElement,
	settings: BiosequenceSettings
): void {
	const container = el.createDiv({ cls: "biosequence-block biosequence-aa" });
	const parsed = parseAASequence(source);

	if (parsed.sequence.length === 0) {
		container.createEl("p", {
			text: "No valid amino acid sequence found",
			cls: "biosequence-error",
		});
		return;
	}

	// Match library features and merge with inline/range segments
	const featureMatches = matchFeatures(parsed.sequence, settings.featureLibrary, "aa");
	const allSegments = mergeSegments(parsed.segments, featureMatches);

	let currentSchemeId = settings.defaultAAScheme;
	let selectionCleanup: (() => void) | null = null;

	function render(residuesPerLine: number): void {
		// Clean up previous handlers
		if (selectionCleanup) {
			selectionCleanup();
			selectionCleanup = null;
		}

		container.empty();
		const scheme = getAAScheme(currentSchemeId);

		if (parsed.header) {
			container.createDiv({
				cls: "biosequence-header",
				text: parsed.header,
			});
		}

		renderToolbar(
			container,
			currentSchemeId,
			parsed.sequence,
			(newId) => {
				currentSchemeId = newId;
				render(residuesPerLine);
			}
		);

		renderLegend(container, currentSchemeId);

		// Create seqDiv first, attach selection handlers (they query DOM dynamically),
		// then populate sequence lines with selectRange available for annotations
		const seqDiv = container.createDiv({ cls: "biosequence-sequence" });
		seqDiv.style.fontSize = `${settings.sequenceFontSize}px`;

		const selection = attachSelectionHandlers(
			seqDiv,
			container,
			parsed.sequence
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
			settings.annotationDisplayMode,
			selection.selectRange
		);

		// Render annotation legend
		if (allSegments.length > 0) {
			renderAnnotationLegend(container, allSegments, seqDiv, selection.selectRange);
		}

		const props = calculateProteinProperties(
			parsed.sequence,
			settings.assumeDisulfideBonds
		);
		renderSummaryPanel(container, props);
	}

	// Compute initial residues per line from container width
	const initialResiduesPerLine = computeInitialResiduesPerLine(
		container,
		settings.showPositionNumbers,
		settings.sequenceFontSize,
		settings.residuesPerLine
	);

	render(initialResiduesPerLine);

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
