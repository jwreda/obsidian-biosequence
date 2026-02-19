import { AAColorSchemeId, NucleotideColorSchemeId, LegendGroup, ColorSchemeMetadata } from "../types";

export const AA_LEGEND_DATA: Record<AAColorSchemeId, ColorSchemeMetadata> = {
	unique: {
		legendType: "categorical",
		groups: [
			{ label: "Alanine", residues: ["A"], color: "#F0544F", textColor: "#FFF" },
			{ label: "Arginine", residues: ["R"], color: "#1565C0", textColor: "#FFF" },
			{ label: "Asparagine", residues: ["N"], color: "#43A047", textColor: "#FFF" },
			{ label: "Aspartate", residues: ["D"], color: "#E53935", textColor: "#FFF" },
			{ label: "Cysteine", residues: ["C"], color: "#FDD835", textColor: "#333" },
			{ label: "Glutamine", residues: ["Q"], color: "#26A69A", textColor: "#FFF" },
			{ label: "Glutamate", residues: ["E"], color: "#D32F2F", textColor: "#FFF" },
			{ label: "Glycine", residues: ["G"], color: "#BDBDBD", textColor: "#333" },
			{ label: "Histidine", residues: ["H"], color: "#7E57C2", textColor: "#FFF" },
			{ label: "Isoleucine", residues: ["I"], color: "#2E7D32", textColor: "#FFF" },
			{ label: "Leucine", residues: ["L"], color: "#388E3C", textColor: "#FFF" },
			{ label: "Lysine", residues: ["K"], color: "#1E88E5", textColor: "#FFF" },
			{ label: "Methionine", residues: ["M"], color: "#FFC107", textColor: "#333" },
			{ label: "Phenylalanine", residues: ["F"], color: "#5C6BC0", textColor: "#FFF" },
			{ label: "Proline", residues: ["P"], color: "#FF7043", textColor: "#FFF" },
			{ label: "Serine", residues: ["S"], color: "#FF8A65", textColor: "#333" },
			{ label: "Threonine", residues: ["T"], color: "#FFAB91", textColor: "#333" },
			{ label: "Tryptophan", residues: ["W"], color: "#8E24AA", textColor: "#FFF" },
			{ label: "Tyrosine", residues: ["Y"], color: "#42A5F5", textColor: "#333" },
			{ label: "Valine", residues: ["V"], color: "#66BB6A", textColor: "#333" },
		],
	},

	rasmol: {
		legendType: "categorical",
		groups: [
			{ label: "Acidic", residues: ["D", "E"], color: "#E60A0A", textColor: "#FFF" },
			{ label: "Basic", residues: ["K", "R"], color: "#145AFF", textColor: "#FFF" },
			{ label: "Aromatic", residues: ["F", "Y"], color: "#3232AA", textColor: "#FFF" },
			{ label: "Tryptophan", residues: ["W"], color: "#B45AB4", textColor: "#FFF" },
			{ label: "Hydroxyl", residues: ["S", "T"], color: "#FA9600", textColor: "#333" },
			{ label: "Amide", residues: ["N", "Q"], color: "#00DCDC", textColor: "#333" },
			{ label: "Aliphatic", residues: ["L", "V", "I"], color: "#0F820F", textColor: "#FFF" },
			{ label: "Sulfur", residues: ["C", "M"], color: "#E6E600", textColor: "#333" },
			{ label: "Proline", residues: ["P"], color: "#DC9682", textColor: "#333" },
			{ label: "Alanine", residues: ["A"], color: "#C8C8C8", textColor: "#333" },
			{ label: "Glycine", residues: ["G"], color: "#EBEBEB", textColor: "#333" },
			{ label: "Histidine", residues: ["H"], color: "#8282D2", textColor: "#FFF" },
		],
	},

	clustalx: {
		legendType: "categorical",
		groups: [
			{ label: "Hydrophobic", residues: ["A", "I", "L", "M", "F", "W", "V"], color: "#197FE5", textColor: "#FFF" },
			{ label: "Positive", residues: ["K", "R"], color: "#E53935", textColor: "#FFF" },
			{ label: "Negative / Cys", residues: ["E", "D", "C"], color: "#E040FB", textColor: "#FFF" },
			{ label: "Polar", residues: ["N", "Q", "S", "T"], color: "#43A047", textColor: "#FFF" },
			{ label: "Glycine", residues: ["G"], color: "#F57C00", textColor: "#FFF" },
			{ label: "Proline", residues: ["P"], color: "#FDD835", textColor: "#333" },
			{ label: "Aromatic / His", residues: ["H", "Y"], color: "#00BCD4", textColor: "#333" },
		],
	},

	zappo: {
		legendType: "categorical",
		groups: [
			{ label: "Aliphatic", residues: ["I", "L", "V", "A", "M"], color: "#FFAFAF", textColor: "#333" },
			{ label: "Aromatic", residues: ["F", "W", "Y"], color: "#FFC800", textColor: "#333" },
			{ label: "Positive", residues: ["K", "R", "H"], color: "#6464FF", textColor: "#FFF" },
			{ label: "Negative", residues: ["D", "E"], color: "#FF0000", textColor: "#FFF" },
			{ label: "Hydrophilic", residues: ["S", "T", "N", "Q"], color: "#00FF00", textColor: "#333" },
			{ label: "Conformational", residues: ["P", "G"], color: "#FF00FF", textColor: "#FFF" },
			{ label: "Cysteine", residues: ["C"], color: "#FFFF00", textColor: "#333" },
		],
	},

	hydrophobicity: {
		legendType: "spectrum",
		spectrumLabel: { low: "Hydrophilic (\u22124.5)", high: "Hydrophobic (+4.5)" },
		spectrumColors: { low: "#0088FF", high: "#FF0000" },
	},

	polarity: {
		legendType: "categorical",
		groups: [
			{ label: "Nonpolar", residues: ["G", "A", "V", "L", "I", "P", "F", "M", "W"], color: "#FFD54F", textColor: "#333" },
			{ label: "Polar Uncharged", residues: ["S", "T", "C", "Y", "N", "Q"], color: "#66BB6A", textColor: "#333" },
			{ label: "Positively Charged", residues: ["K", "R", "H"], color: "#42A5F5", textColor: "#333" },
			{ label: "Negatively Charged", residues: ["D", "E"], color: "#EF5350", textColor: "#FFF" },
		],
	},

	charge: {
		legendType: "categorical",
		groups: [
			{ label: "Positive", residues: ["K", "R"], color: "#2196F3", textColor: "#FFF" },
			{ label: "Weak Positive", residues: ["H"], color: "#90CAF9", textColor: "#333" },
			{ label: "Negative", residues: ["D", "E"], color: "#F44336", textColor: "#FFF" },
			{ label: "Neutral", residues: ["A", "C", "F", "G", "I", "L", "M", "N", "P", "Q", "S", "T", "V", "W", "Y"], color: "#E0E0E0", textColor: "#333" },
		],
	},

	chemical: {
		legendType: "categorical",
		groups: [
			{ label: "Aliphatic", residues: ["G", "A", "V", "L", "I", "P"], color: "#BDBDBD", textColor: "#333" },
			{ label: "Aromatic", residues: ["F", "W", "Y"], color: "#7E57C2", textColor: "#FFF" },
			{ label: "Sulfur", residues: ["C", "M"], color: "#FDD835", textColor: "#333" },
			{ label: "Hydroxyl", residues: ["S", "T"], color: "#FF8A65", textColor: "#333" },
			{ label: "Acidic", residues: ["D", "E"], color: "#EF5350", textColor: "#FFF" },
			{ label: "Amide", residues: ["N", "Q"], color: "#EF9A9A", textColor: "#333" },
			{ label: "Basic", residues: ["K", "R"], color: "#42A5F5", textColor: "#333" },
			{ label: "Histidine", residues: ["H"], color: "#90CAF9", textColor: "#333" },
		],
	},

	cysteine: {
		legendType: "categorical",
		groups: [
			{ label: "Cysteine", residues: ["C"], color: "#E91E63", textColor: "#FFF" },
			{ label: "Other", residues: ["A", "R", "N", "D", "Q", "E", "G", "H", "I", "L", "K", "M", "F", "P", "S", "T", "W", "Y", "V"], color: "#BDBDBD", textColor: "#555" },
		],
	},

	neutral: { legendType: "categorical", groups: [] },

	search: { legendType: "categorical", groups: [] },

	phosphorylation: {
		legendType: "categorical",
		groups: [
			{ label: "Serine", residues: ["S"], color: "#2196F3", textColor: "#FFF" },
			{ label: "Threonine", residues: ["T"], color: "#FF9800", textColor: "#FFF" },
			{ label: "Tyrosine", residues: ["Y"], color: "#9C27B0", textColor: "#FFF" },
			{ label: "Other", residues: ["A", "R", "N", "D", "C", "Q", "E", "G", "H", "I", "L", "K", "M", "F", "P", "W", "V"], color: "#BDBDBD", textColor: "#555" },
		],
	},

	absorbance280: {
		legendType: "categorical",
		groups: [
			{ label: "Tryptophan [W]", residues: ["W"], color: "#7B1FA2", textColor: "#FFF" },
			{ label: "Tyrosine [Y]", residues: ["Y"], color: "#F57F17", textColor: "#FFF" },
			{ label: "Cysteine [C]", residues: ["C"], color: "#00897B", textColor: "#FFF" },
			{ label: "Other", residues: ["A", "R", "N", "D", "Q", "E", "G", "H", "I", "L", "K", "M", "F", "P", "S", "T", "V"], color: "#BDBDBD", textColor: "#555" },
		],
	},
};

export const NUCLEOTIDE_LEGEND_DATA: Record<NucleotideColorSchemeId, ColorSchemeMetadata> = {
	"default": {
		legendType: "categorical",
		groups: [
			{ label: "Adenine", residues: ["A"], color: "#64DD17", textColor: "#333" },
			{ label: "Thymine / Uracil", residues: ["T", "U"], color: "#FF1744", textColor: "#FFF" },
			{ label: "Guanine", residues: ["G"], color: "#FFD600", textColor: "#333" },
			{ label: "Cytosine", residues: ["C"], color: "#2979FF", textColor: "#FFF" },
		],
	},

	"purine-pyrimidine": {
		legendType: "categorical",
		groups: [
			{ label: "Purines", residues: ["A", "G"], color: "#1565C0", textColor: "#FFF" },
			{ label: "Pyrimidines", residues: ["C", "T", "U"], color: "#FF8F00", textColor: "#333" },
		],
	},

	"neutral": { legendType: "categorical", groups: [] },

	"search": { legendType: "categorical", groups: [] },

	"complementary": {
		legendType: "categorical",
		groups: [
			{ label: "Adenine", residues: ["A"], color: "#E53935", textColor: "#FFF" },
			{ label: "Thymine / Uracil", residues: ["T", "U"], color: "#FF8A80", textColor: "#333" },
			{ label: "Guanine", residues: ["G"], color: "#1565C0", textColor: "#FFF" },
			{ label: "Cytosine", residues: ["C"], color: "#82B1FF", textColor: "#333" },
		],
	},
};
