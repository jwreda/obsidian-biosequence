import {
	BiosequenceSettings,
	ColorScheme,
	NucleotideColorSchemeId,
	NucleotideProperties,
	ParsedSequence,
	SequenceType,
} from "../types";
import { autoContrast } from "../colorSchemes/aminoAcid";
import {
	getNucleotideScheme,
	getNucleotideSchemeList,
} from "../colorSchemes/index";
import { calculateNucleotideProperties } from "../calculations/nucleotideProps";

const VALID_DNA = new Set("ATGC".split(""));
const VALID_RNA = new Set("AUGC".split(""));

function parseNucleotideSequence(
	source: string,
	type: SequenceType
): ParsedSequence {
	const lines = source.split("\n");
	let header: string | null = null;

	const firstLine = lines[0];
	if (firstLine !== undefined && firstLine.startsWith(">")) {
		header = firstLine.substring(1).trim();
	}

	const seqLines = lines.filter((l) => !l.startsWith(">"));
	const raw = seqLines.join("");
	const cleaned = raw.replace(/[\s\d\-*]/g, "").toUpperCase();

	const validSet = type === "dna" ? VALID_DNA : VALID_RNA;
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

	return {
		raw: source,
		sequence,
		type,
		header,
		isValid: invalidPositions.length === 0 && sequence.length > 0,
		invalidPositions,
	};
}

function renderToolbar(
	container: HTMLElement,
	type: SequenceType,
	currentSchemeId: NucleotideColorSchemeId,
	sequenceLength: number,
	onSchemeChange: (id: NucleotideColorSchemeId) => void
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
		text: `(${sequenceLength} nt)`,
	});
}

function renderColoredSequence(
	container: HTMLElement,
	sequence: string,
	scheme: ColorScheme,
	settings: BiosequenceSettings,
	invalidPositions: number[]
): void {
	const invalidSet = new Set(invalidPositions);
	const seqDiv = container.createDiv({ cls: "biosequence-sequence" });
	seqDiv.style.fontSize = `${settings.sequenceFontSize}px`;

	const lineCount = Math.ceil(sequence.length / settings.residuesPerLine);

	for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
		const start = lineIdx * settings.residuesPerLine;
		const end = Math.min(start + settings.residuesPerLine, sequence.length);
		const lineDiv = seqDiv.createDiv({ cls: "biosequence-line" });

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

			const span = residuesSpan.createSpan({
				cls: "biosequence-residue",
				text: ch,
				title: `${ch} (pos ${i + 1})`,
			});
			span.style.backgroundColor = bgColor;
			span.style.color = textColor;

			if (invalidSet.has(i)) {
				span.addClass("invalid");
			}
		}
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
	sequence: string
): void {
	const summary = container.createDiv({ cls: "biosequence-summary" });
	const typeLabel = type === "dna" ? "DNA" : "RNA";
	summary.createDiv({
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

	function render(): void {
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
			parsed.sequence.length,
			(newId) => {
				currentSchemeId = newId;
				render();
			}
		);

		renderColoredSequence(
			container,
			parsed.sequence,
			scheme,
			settings,
			parsed.invalidPositions
		);

		const props = calculateNucleotideProperties(parsed.sequence, type);
		renderNucleotideSummaryPanel(container, props, type, parsed.sequence);
	}

	render();
}
