import {
	AAColorSchemeId,
	BiosequenceSettings,
	ColorScheme,
	ConservationSymbols,
	NucleotideColorSchemeId,
	SequenceType,
} from "../types";
import { autoContrast } from "../colorSchemes/aminoAcid";
import {
	getAAScheme,
	getAASchemeList,
	getNucleotideScheme,
	getNucleotideSchemeList,
} from "../colorSchemes/index";
import { parseFasta } from "../alignment/fastaParser";
import { computeConservation } from "../alignment/conservation";
import {
	createReflowObserver,
	computeInitialResiduesPerLine,
} from "./reflowManager";
import { AA_LEGEND_DATA, NUCLEOTIDE_LEGEND_DATA } from "../colorSchemes/legendData";

const VALID_DNA = new Set("ATGC".split(""));

/**
 * Detect the sequence type from aligned sequences (which may contain gaps).
 */
function detectType(seq1: string, seq2: string): SequenceType {
	// Combine both sequences, remove gaps
	const combined = (seq1 + seq2).replace(/-/g, "").toUpperCase();

	// Check if all non-gap characters are nucleotides
	let allNuc = true;
	let hasU = false;
	let hasT = false;
	for (let i = 0; i < combined.length; i++) {
		const ch = combined.charAt(i);
		if (ch === "U") hasU = true;
		if (ch === "T") hasT = true;
		if (!VALID_DNA.has(ch) && ch !== "U" && ch !== "N") {
			allNuc = false;
			break;
		}
	}

	if (allNuc && combined.length > 0) {
		if (hasU && !hasT) return "rna";
		return "dna";
	}
	return "aa";
}

/**
 * Truncate a header string for display in alignment labels.
 */
function shortLabel(header: string, maxLen: number = 20): string {
	if (header.length <= maxLen) return header;
	return header.substring(0, maxLen - 1) + "\u2026";
}

/**
 * Map internal conservation code to user-configured display character.
 */
function getDisplayMarker(
	internalCode: string,
	symbols: ConservationSymbols
): string {
	switch (internalCode) {
		case "|":
			return symbols.identity;
		case ":":
			return symbols.similar;
		case ".":
			return symbols.weak;
		case "_":
			return symbols.gap;
		case " ":
			return symbols.mismatch;
		default:
			return " ";
	}
}

/**
 * Get the CSS class for an internal conservation code.
 */
function getConservationClass(internalCode: string): string | null {
	switch (internalCode) {
		case "|":
			return "biosequence-conservation-identity";
		case ":":
			return "biosequence-conservation-similar";
		case ".":
			return "biosequence-conservation-weak";
		case " ":
			return "biosequence-conservation-mismatch";
		case "_":
			return "biosequence-conservation-gap";
		default:
			return null;
	}
}

/**
 * Render the toolbar with type badge, scheme dropdown, and length info.
 */
function renderToolbar(
	container: HTMLElement,
	detectedType: SequenceType,
	currentSchemeId: string,
	alignmentLength: number,
	seq1Length: number,
	seq2Length: number,
	onSchemeChange: (id: string) => void
): void {
	const toolbar = container.createDiv({ cls: "biosequence-toolbar" });
	toolbar.createSpan({ cls: "biosequence-type-label", text: "ALIGN" });

	const select = toolbar.createEl("select", {
		cls: "biosequence-scheme-select",
	});

	const schemes =
		detectedType === "aa" ? getAASchemeList() : getNucleotideSchemeList();
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
		onSchemeChange(select.value);
	});

	const unitLabel = detectedType === "aa" ? "aa" : "nt";

	toolbar.createSpan({
		cls: "biosequence-length",
		text: `(alignment: ${alignmentLength} pos | seq1: ${seq1Length} ${unitLabel} | seq2: ${seq2Length} ${unitLabel})`,
	});
}

/**
 * Render the color scheme legend for the alignment view.
 */
function renderLegend(
	container: HTMLElement,
	detectedType: SequenceType,
	schemeId: string
): void {
	const metadata =
		detectedType === "aa"
			? AA_LEGEND_DATA[schemeId as AAColorSchemeId]
			: NUCLEOTIDE_LEGEND_DATA[schemeId as NucleotideColorSchemeId];
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

/**
 * Render the interleaved alignment display for one chunk of residuesPerLine.
 */
function renderAlignmentChunk(
	container: HTMLElement,
	seq1: string,
	seq2: string,
	conservation: string,
	label1: string,
	label2: string,
	chunkStart: number,
	chunkEnd: number,
	scheme: ColorScheme,
	detectedType: SequenceType,
	settings: BiosequenceSettings
): void {
	const chunk = container.createDiv({
		cls: "biosequence-alignment-chunk",
	});

	// Row 1: Sequence 1
	const row1 = chunk.createDiv({ cls: "biosequence-alignment-row" });
	row1.createSpan({
		cls: "biosequence-alignment-label",
		text: shortLabel(label1),
		title: label1,
	});

	if (settings.showPositionNumbers) {
		row1.createSpan({
			cls: "biosequence-gutter",
			text: String(chunkStart + 1),
		});
	}

	const residues1 = row1.createSpan({ cls: "biosequence-residues" });
	renderResidueSpans(
		residues1,
		seq1,
		chunkStart,
		chunkEnd,
		scheme,
		detectedType
	);

	// Row 2: Conservation markers
	const consRow = chunk.createDiv({
		cls: "biosequence-alignment-row",
	});

	consRow.createSpan({
		cls: "biosequence-alignment-label",
		text: "",
	});

	if (settings.showPositionNumbers) {
		consRow.createSpan({
			cls: "biosequence-gutter",
			text: "",
		});
	}

	const consResidues = consRow.createSpan({ cls: "biosequence-residues" });

	for (let i = chunkStart; i < chunkEnd; i++) {
		const internalCode =
			i < conservation.length ? conservation.charAt(i) : " ";

		const span = consResidues.createSpan({ cls: "biosequence-conservation-marker" });

		if (internalCode === "_") {
			// Gap position: render empty spacer (gap is already visible in sequences)
			span.textContent = "\u00A0";
			span.addClass("biosequence-conservation-gap");
		} else {
			const displayChar = getDisplayMarker(
				internalCode,
				settings.conservationSymbols
			);
			span.textContent = displayChar;
			const cls = getConservationClass(internalCode);
			if (cls) {
				span.addClass(cls);
			}
		}
	}

	// Row 3: Sequence 2
	const row3 = chunk.createDiv({ cls: "biosequence-alignment-row" });
	row3.createSpan({
		cls: "biosequence-alignment-label",
		text: shortLabel(label2),
		title: label2,
	});

	if (settings.showPositionNumbers) {
		row3.createSpan({
			cls: "biosequence-gutter",
			text: String(chunkStart + 1),
		});
	}

	const residues2 = row3.createSpan({ cls: "biosequence-residues" });
	renderResidueSpans(
		residues2,
		seq2,
		chunkStart,
		chunkEnd,
		scheme,
		detectedType
	);
}

/**
 * Render individual residue/gap spans for an aligned sequence chunk.
 */
function renderResidueSpans(
	parent: HTMLElement,
	sequence: string,
	start: number,
	end: number,
	scheme: ColorScheme,
	detectedType: SequenceType
): void {
	for (let i = start; i < end; i++) {
		const ch = i < sequence.length ? sequence.charAt(i) : " ";

		if (ch === "-") {
			// Gap character: dim styling, no background color
			parent.createSpan({
				cls: "biosequence-gap",
				text: "-",
				title: `gap (pos ${i + 1})`,
			});
		} else {
			const upper = ch.toUpperCase();
			const bgColor = scheme.colors[upper] ?? "#E0E0E0";

			const span = parent.createSpan({
				cls: "biosequence-residue",
				text: upper,
				title: `${upper} (pos ${i + 1})`,
			});

			if (bgColor === "") {
				span.classList.add("biosequence-residue-neutral");
			} else {
				const textColor =
					scheme.textColors?.[upper] ?? autoContrast(bgColor);
				span.style.backgroundColor = bgColor;
				span.style.color = textColor;
			}
		}
	}
}

/**
 * Count non-gap characters in a sequence.
 */
function countResidues(seq: string): number {
	let count = 0;
	for (let i = 0; i < seq.length; i++) {
		if (seq.charAt(i) !== "-") count++;
	}
	return count;
}

/**
 * Compute the pixel width of the alignment label column.
 * Label CSS: width: 8em, font-size: 0.75em, padding-right: 6px
 * So actual width = 8 × 0.75 × fontSize + 6 = 6 × fontSize + 6
 */
function computeLabelOffsetPx(fontSize: number): number {
	return 6 * fontSize + 6;
}

/**
 * Render an alignment code block.
 *
 * The source format is multi-FASTA with gaps:
 * ```
 * >Header 1
 * MVLSPADKTNVKA--AWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH
 * >Header 2
 * MVLSGEDKSNIKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH--
 * ```
 */
export function renderAlignmentBlock(
	source: string,
	el: HTMLElement,
	settings: BiosequenceSettings
): () => void {
	const container = el.createDiv({
		cls: "biosequence-block biosequence-alignment",
	});

	const entries = parseFasta(source);

	if (entries.length < 2) {
		container.createEl("p", {
			text: "Alignment requires at least 2 sequences in FASTA format",
			cls: "biosequence-error",
		});
		return () => {};
	}

	const seq1 = entries[0]!.sequence;
	const seq2 = entries[1]!.sequence;
	const label1 = entries[0]!.header || "Sequence 1";
	const label2 = entries[1]!.header || "Sequence 2";

	if (seq1.length === 0 && seq2.length === 0) {
		container.createEl("p", {
			text: "No valid sequences found in alignment block",
			cls: "biosequence-error",
		});
		return () => {};
	}

	const detectedType = detectType(seq1, seq2);
	const conservation = computeConservation(seq1, seq2);
	const alignmentLength = Math.max(seq1.length, seq2.length);
	const seq1Residues = countResidues(seq1);
	const seq2Residues = countResidues(seq2);

	// Determine initial color scheme
	let currentSchemeId: string =
		detectedType === "aa"
			? settings.defaultAAScheme
			: detectedType === "dna"
				? settings.defaultDNAScheme
				: settings.defaultRNAScheme;

	const labelOffsetPx = computeLabelOffsetPx(settings.sequenceFontSize);

	function render(residuesPerLine: number): void {
		container.empty();

		const scheme =
			detectedType === "aa"
				? getAAScheme(currentSchemeId as AAColorSchemeId)
				: getNucleotideScheme(
						currentSchemeId as NucleotideColorSchemeId
					);

		renderToolbar(
			container,
			detectedType,
			currentSchemeId,
			alignmentLength,
			seq1Residues,
			seq2Residues,
			(newId) => {
				currentSchemeId = newId;
				render(residuesPerLine);
			}
		);

		renderLegend(container, detectedType, currentSchemeId);

		const seqDiv = container.createDiv({ cls: "biosequence-sequence" });
		seqDiv.setCssProps({ "--biosequence-font-size": `${settings.sequenceFontSize}px` });

		const lineCount = Math.ceil(alignmentLength / residuesPerLine);

		for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
			const start = lineIdx * residuesPerLine;
			const end = Math.min(start + residuesPerLine, alignmentLength);

			renderAlignmentChunk(
				seqDiv,
				seq1,
				seq2,
				conservation,
				label1,
				label2,
				start,
				end,
				scheme,
				detectedType,
				settings
			);
		}

		// Summary statistics
		let identityCount = 0;
		let similarCount = 0;
		let gapCount = 0;
		for (let i = 0; i < conservation.length; i++) {
			const ch = conservation.charAt(i);
			if (ch === "|") identityCount++;
			else if (ch === ":" || ch === ".") similarCount++;
			else if (ch === "_") gapCount++;
		}

		const pctIdentity =
			alignmentLength > 0
				? ((identityCount / alignmentLength) * 100).toFixed(1)
				: "0.0";
		const pctSimilar =
			alignmentLength > 0
				? (
						((identityCount + similarCount) / alignmentLength) *
						100
					).toFixed(1)
				: "0.0";

		const summary = container.createDiv({ cls: "biosequence-summary" });
		summary.createDiv({
			cls: "biosequence-summary-header",
			text: "Alignment Statistics",
		});

		const grid = summary.createDiv({ cls: "biosequence-summary-grid" });

		function addProp(label: string, value: string): void {
			const prop = grid.createDiv({ cls: "biosequence-prop" });
			prop.createSpan({ cls: "biosequence-prop-label", text: label });
			prop.createSpan({ cls: "biosequence-prop-value", text: value });
		}

		addProp("Alignment Length", `${alignmentLength} positions`);
		addProp(
			"Identity",
			`${identityCount}/${alignmentLength} (${pctIdentity}%)`
		);
		if (detectedType === "aa") {
			addProp(
				"Similarity",
				`${identityCount + similarCount}/${alignmentLength} (${pctSimilar}%)`
			);
		}
		addProp("Gaps in Seq 1", `${alignmentLength - seq1Residues}`);
		addProp("Gaps in Seq 2", `${alignmentLength - seq2Residues}`);
		addProp("Sequence Type", detectedType.toUpperCase());
	}

	// Compute initial residues per line (accounting for alignment label width)
	const initialResiduesPerLine = computeInitialResiduesPerLine(
		container,
		settings.showPositionNumbers,
		settings.sequenceFontSize,
		settings.residuesPerLine,
		labelOffsetPx
	);

	render(initialResiduesPerLine);

	// Attach reflow observer for dynamic resize
	const observer = createReflowObserver(
		container,
		settings.showPositionNumbers,
		settings.sequenceFontSize,
		settings.residuesPerLine,
		(newResiduesPerLine) => {
			render(newResiduesPerLine);
		},
		labelOffsetPx
	);

	return () => observer.disconnect();
}
