import {
	AAColorSchemeId,
	BiosequenceSettings,
	ColorScheme,
	ParsedSequence,
	ProteinProperties,
} from "../types";
import { autoContrast } from "../colorSchemes/aminoAcid";
import { getAAScheme, getAASchemeList } from "../colorSchemes/index";
import { calculateProteinProperties } from "../calculations/proteinProps";

const VALID_AA = new Set("ACDEFGHIKLMNPQRSTVWY".split(""));

function parseAASequence(source: string): ParsedSequence {
	const lines = source.split("\n");
	let header: string | null = null;

	const firstLine = lines[0];
	if (firstLine !== undefined && firstLine.startsWith(">")) {
		header = firstLine.substring(1).trim();
	}

	const seqLines = lines.filter((l) => !l.startsWith(">"));
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

	return {
		raw: source,
		sequence,
		type: "aa",
		header,
		isValid: invalidPositions.length === 0 && sequence.length > 0,
		invalidPositions,
	};
}

function renderToolbar(
	container: HTMLElement,
	currentSchemeId: AAColorSchemeId,
	sequenceLength: number,
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
		text: `(${sequenceLength} aa)`,
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
		`${props.absorbance01.toFixed(3)} / ${props.absorbance01SS.toFixed(3)}`
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

	let currentSchemeId = settings.defaultAAScheme;

	function render(): void {
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

		const props = calculateProteinProperties(
			parsed.sequence,
			settings.assumeDisulfideBonds
		);
		renderSummaryPanel(container, props);
	}

	render();
}
