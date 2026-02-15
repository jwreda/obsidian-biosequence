import { ColorScheme, NucleotideColorSchemeId } from "../types";

export const NUCLEOTIDE_SCHEMES: Record<NucleotideColorSchemeId, ColorScheme> = {
	"default": {
		id: "default",
		name: "Default",
		type: "nucleotide",
		description: "Standard nucleotide colors",
		colors: {
			A: "#64DD17",
			T: "#FF1744",
			U: "#FF1744",
			G: "#FFD600",
			C: "#2979FF",
		},
		textColors: {
			A: "#333",
			T: "#FFF",
			U: "#FFF",
			G: "#333",
			C: "#FFF",
		},
	},

	"purine-pyrimidine": {
		id: "purine-pyrimidine",
		name: "Purine / Pyrimidine",
		type: "nucleotide",
		description: "Purines vs pyrimidines",
		colors: {
			A: "#1565C0",
			G: "#1565C0",
			C: "#FF8F00",
			T: "#FF8F00",
			U: "#FF8F00",
		},
		textColors: {
			A: "#FFF",
			G: "#FFF",
			C: "#333",
			T: "#333",
			U: "#333",
		},
	},

	"complementary": {
		id: "complementary",
		name: "Complementary Pairs",
		type: "nucleotide",
		description: "Complement pair colors",
		colors: {
			A: "#E53935",
			T: "#FF8A80",
			U: "#FF8A80",
			G: "#1565C0",
			C: "#82B1FF",
		},
		textColors: {
			A: "#FFF",
			T: "#333",
			U: "#333",
			G: "#FFF",
			C: "#333",
		},
	},
};
