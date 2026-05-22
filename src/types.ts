/** The three supported biological sequence types */
export type SequenceType = "aa" | "dna" | "rna";

/** A named segment/feature within a sequence */
export interface Segment {
	name: string;
	start: number;  // 0-indexed inclusive
	end: number;    // 0-indexed exclusive
	color: string;
}

/** A parsed and validated sequence */
export interface ParsedSequence {
	raw: string;
	sequence: string;
	type: SequenceType;
	header: string | null;
	isValid: boolean;
	invalidPositions: number[];
	segments: Segment[];
}

/** Color scheme identifier strings for amino acids */
export type AAColorSchemeId =
	| "unique"
	| "clustalx"
	| "zappo"
	| "rasmol"
	| "hydrophobicity"
	| "polarity"
	| "charge"
	| "chemical"
	| "cysteine"
	| "phosphorylation"
	| "absorbance280"
	| "neutral"
	| "search";

/** Color scheme identifier strings for nucleotides */
export type NucleotideColorSchemeId =
	| "default"
	| "purine-pyrimidine"
	| "complementary"
	| "neutral"
	| "search";

/** A color scheme maps single-letter residue codes to CSS color strings */
export interface ColorScheme {
	id: string;
	name: string;
	type: SequenceType | "nucleotide";
	colors: Record<string, string>;
	textColors?: Record<string, string>;
	description: string;
}

/** A legend entry for categorical color schemes */
export interface LegendGroup {
	label: string;
	residues: string[];
	color: string;
	textColor: string;
}

/** Legend metadata for a color scheme */
export interface ColorSchemeMetadata {
	legendType: "categorical" | "spectrum";
	groups?: LegendGroup[];
	spectrumLabel?: { low: string; high: string };
	spectrumColors?: { low: string; high: string };
}

/** Conservation display symbols (user-configurable) */
export interface ConservationSymbols {
	identity: string;
	similar: string;
	weak: string;
	mismatch: string;
	gap: string;
}

/** A single feature in the user's feature library */
export interface FeatureEntry {
	id: string;
	name: string;
	sequence: string;
	type: SequenceType;
	color: string;
	enabled: boolean;
}

/** A matched feature instance at a specific position */
export interface FeatureMatch {
	featureId: string;
	name: string;
	start: number;
	end: number;
	color: string;
	source: "library";
}

/** Extended Segment with source tracking */
export interface AnnotatedSegment extends Segment {
	source: "inline" | "range" | "library";
	featureId?: string;
}

/** Display mode for sequence annotations */
export type AnnotationDisplayMode = "ribbons" | "badges";

/** Plugin settings persisted to data.json */
export interface BiosequenceSettings {
	defaultAAScheme: AAColorSchemeId;
	defaultDNAScheme: NucleotideColorSchemeId;
	defaultRNAScheme: NucleotideColorSchemeId;
	residuesPerLine: number;
	showPositionNumbers: boolean;
	sequenceFontSize: number;
	summaryExpanded: boolean;
	assumeDisulfideBonds: boolean;
	mafftPath: string;
	alignmentOutputDir: string;
	conservationSymbols: ConservationSymbols;
	featureLibrary: FeatureEntry[];
	annotationDisplayMode: AnnotationDisplayMode;
	searchHighlightColor: string;
	showFrameAnnotations: boolean;
}

/** Amino acid composition result */
export interface AAComposition {
	counts: Record<string, number>;
	percentages: Record<string, number>;
	totalResidues: number;
}

/** Full protein property calculation result */
export interface ProteinProperties {
	molecularWeight: number;
	theoreticalPI: number;
	extinctionCoefficient: number;
	extinctionCoefficientSS: number;
	absorbance01: number;
	absorbance01SS: number;
	gravy: number;
	aliphaticIndex: number;
	instabilityIndex: number;
	isStable: boolean;
	composition: AAComposition;
	formula: string;
	atomCounts: Record<string, number>;
}

/** Nucleotide property calculation result */
export interface NucleotideProperties {
	length: number;
	gcContent: number;
	gcPercent: number;
	molecularWeight: number;
	complement: string;
	reverseComplement: string;
	meltingTemp: number;
	atCount: number;
	gcCount: number;
}

/** Parsed FASTA entry */
export interface FastaEntry {
	header: string;
	sequence: string;
}

/** Result from MAFFT alignment */
export interface AlignmentResult {
	sequences: FastaEntry[];
	type: SequenceType;
	conservation: string;
}

/** Default settings */
export const DEFAULT_SETTINGS: BiosequenceSettings = {
	defaultAAScheme: "rasmol",
	defaultDNAScheme: "default",
	defaultRNAScheme: "default",
	residuesPerLine: 60,
	showPositionNumbers: true,
	sequenceFontSize: 14,
	summaryExpanded: false,
	assumeDisulfideBonds: false,
	mafftPath: "mafft",
	alignmentOutputDir: "Plasmid design/alignments",
	conservationSymbols: {
		identity: "|",
		similar: ":",
		weak: ".",
		mismatch: "X",
		gap: "-",
	},
	featureLibrary: [],
	annotationDisplayMode: "ribbons" as AnnotationDisplayMode,
	searchHighlightColor: "#FF6D00",
	showFrameAnnotations: true,
};
