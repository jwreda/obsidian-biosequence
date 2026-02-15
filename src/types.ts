/** The three supported biological sequence types */
export type SequenceType = "aa" | "dna" | "rna";

/** A parsed and validated sequence */
export interface ParsedSequence {
	raw: string;
	sequence: string;
	type: SequenceType;
	header: string | null;
	isValid: boolean;
	invalidPositions: number[];
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
	| "chemical";

/** Color scheme identifier strings for nucleotides */
export type NucleotideColorSchemeId =
	| "default"
	| "purine-pyrimidine"
	| "complementary";

/** A color scheme maps single-letter residue codes to CSS color strings */
export interface ColorScheme {
	id: string;
	name: string;
	type: SequenceType | "nucleotide";
	colors: Record<string, string>;
	textColors?: Record<string, string>;
	description: string;
}

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

/** Default settings */
export const DEFAULT_SETTINGS: BiosequenceSettings = {
	defaultAAScheme: "rasmol",
	defaultDNAScheme: "default",
	defaultRNAScheme: "default",
	residuesPerLine: 60,
	showPositionNumbers: true,
	sequenceFontSize: 14,
	summaryExpanded: true,
	assumeDisulfideBonds: false,
};
