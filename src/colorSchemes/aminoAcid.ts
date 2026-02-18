import { ColorScheme, AAColorSchemeId } from "../types";

/**
 * Compute a contrasting text color (dark or light) for a given hex background.
 * Uses the W3C relative luminance formula.
 */
export function autoContrast(hexColor: string): string {
	const r = parseInt(hexColor.slice(1, 3), 16);
	const g = parseInt(hexColor.slice(3, 5), 16);
	const b = parseInt(hexColor.slice(5, 7), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.5 ? "#333" : "#FFF";
}

/**
 * Linearly interpolate a Kyte-Doolittle value to a color on a red-to-blue gradient.
 * Most hydrophobic (4.5) maps to red (#FF0000), most hydrophilic (-4.5) maps to blue (#0088FF).
 */
function kdToColor(value: number): string {
	const min = -4.5;
	const max = 4.5;
	const t = (value - min) / (max - min); // 0 = most hydrophilic, 1 = most hydrophobic
	// t=1 -> red (#FF0000), t=0 -> blue (#0088FF)
	const r = Math.round(0x00 + t * (0xFF - 0x00));
	const g = Math.round(0x88 - t * 0x88);
	const b = Math.round(0xFF - t * 0xFF);
	return "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");
}

// Kyte-Doolittle hydrophobicity values
const KD: Record<string, number> = {
	I: 4.5, V: 4.2, L: 3.8, F: 2.8, C: 2.5, M: 1.9, A: 1.8,
	G: -0.4, T: -0.7, S: -0.8, W: -0.9, Y: -1.3, P: -1.6,
	H: -3.2, E: -3.5, Q: -3.5, D: -3.5, N: -3.5, K: -3.9, R: -4.5,
};

// Build hydrophobicity colors and text colors from KD values
const hydroColors: Record<string, string> = {};
const hydroTextColors: Record<string, string> = {};
for (const [aa, val] of Object.entries(KD)) {
	const bg = kdToColor(val);
	hydroColors[aa] = bg;
	hydroTextColors[aa] = autoContrast(bg);
}

export const AA_SCHEMES: Record<AAColorSchemeId, ColorScheme> = {
	unique: {
		id: "unique",
		name: "Unique",
		type: "aa",
		description: "Each amino acid has a unique color",
		colors: {
			A: "#F0544F", R: "#1565C0", N: "#43A047", D: "#E53935",
			C: "#FDD835", Q: "#26A69A", E: "#D32F2F", G: "#BDBDBD",
			H: "#7E57C2", I: "#2E7D32", L: "#388E3C", K: "#1E88E5",
			M: "#FFC107", F: "#5C6BC0", P: "#FF7043", S: "#FF8A65",
			T: "#FFAB91", W: "#8E24AA", Y: "#42A5F5", V: "#66BB6A",
		},
		textColors: {
			A: "#FFF", R: "#FFF", N: "#FFF", D: "#FFF",
			C: "#333", Q: "#FFF", E: "#FFF", G: "#333",
			H: "#FFF", I: "#FFF", L: "#FFF", K: "#FFF",
			M: "#333", F: "#FFF", P: "#FFF", S: "#333",
			T: "#333", W: "#FFF", Y: "#333", V: "#333",
		},
	},

	rasmol: {
		id: "rasmol",
		name: "RasMol",
		type: "aa",
		description: "Classic RasMol coloring",
		colors: {
			D: "#E60A0A", E: "#E60A0A",
			K: "#145AFF", R: "#145AFF",
			F: "#3232AA", Y: "#3232AA",
			W: "#B45AB4",
			S: "#FA9600", T: "#FA9600",
			N: "#00DCDC", Q: "#00DCDC",
			L: "#0F820F", V: "#0F820F", I: "#0F820F",
			C: "#E6E600", M: "#E6E600",
			P: "#DC9682",
			A: "#C8C8C8",
			G: "#EBEBEB",
			H: "#8282D2",
		},
		textColors: {
			D: "#FFF", E: "#FFF",
			K: "#FFF", R: "#FFF",
			F: "#FFF", Y: "#FFF",
			W: "#FFF",
			S: "#333", T: "#333",
			N: "#333", Q: "#333",
			L: "#FFF", V: "#FFF", I: "#FFF",
			C: "#333", M: "#333",
			P: "#333",
			A: "#333",
			G: "#333",
			H: "#FFF",
		},
	},

	clustalx: {
		id: "clustalx",
		name: "ClustalX",
		type: "aa",
		description: "ClustalX group coloring",
		colors: {
			A: "#197FE5", I: "#197FE5", L: "#197FE5", M: "#197FE5",
			F: "#197FE5", W: "#197FE5", V: "#197FE5",
			K: "#E53935", R: "#E53935",
			E: "#E040FB", D: "#E040FB",
			N: "#43A047", Q: "#43A047", S: "#43A047", T: "#43A047",
			C: "#E040FB",
			G: "#F57C00",
			P: "#FDD835",
			H: "#00BCD4", Y: "#00BCD4",
		},
		textColors: {
			A: "#FFF", I: "#FFF", L: "#FFF", M: "#FFF",
			F: "#FFF", W: "#FFF", V: "#FFF",
			K: "#FFF", R: "#FFF",
			E: "#FFF", D: "#FFF",
			N: "#FFF", Q: "#FFF", S: "#FFF", T: "#FFF",
			C: "#FFF",
			G: "#FFF",
			P: "#333",
			H: "#333", Y: "#333",
		},
	},

	zappo: {
		id: "zappo",
		name: "Zappo",
		type: "aa",
		description: "Zappo physicochemical coloring",
		colors: {
			I: "#FFAFAF", L: "#FFAFAF", V: "#FFAFAF", A: "#FFAFAF", M: "#FFAFAF",
			F: "#FFC800", W: "#FFC800", Y: "#FFC800",
			K: "#6464FF", R: "#6464FF", H: "#6464FF",
			D: "#FF0000", E: "#FF0000",
			S: "#00FF00", T: "#00FF00", N: "#00FF00", Q: "#00FF00",
			P: "#FF00FF", G: "#FF00FF",
			C: "#FFFF00",
		},
		textColors: {
			I: "#333", L: "#333", V: "#333", A: "#333", M: "#333",
			F: "#333", W: "#333", Y: "#333",
			K: "#FFF", R: "#FFF", H: "#FFF",
			D: "#FFF", E: "#FFF",
			S: "#333", T: "#333", N: "#333", Q: "#333",
			P: "#FFF", G: "#FFF",
			C: "#333",
		},
	},

	hydrophobicity: {
		id: "hydrophobicity",
		name: "Hydrophobicity",
		type: "aa",
		description: "Kyte-Doolittle hydrophobicity",
		colors: hydroColors,
		textColors: hydroTextColors,
	},

	polarity: {
		id: "polarity",
		name: "Polarity",
		type: "aa",
		description: "Polarity-based coloring",
		colors: {
			G: "#FFD54F", A: "#FFD54F", V: "#FFD54F", L: "#FFD54F",
			I: "#FFD54F", P: "#FFD54F", F: "#FFD54F", M: "#FFD54F", W: "#FFD54F",
			S: "#66BB6A", T: "#66BB6A", C: "#66BB6A", Y: "#66BB6A",
			N: "#66BB6A", Q: "#66BB6A",
			K: "#42A5F5", R: "#42A5F5", H: "#42A5F5",
			D: "#EF5350", E: "#EF5350",
		},
		textColors: {
			G: "#333", A: "#333", V: "#333", L: "#333",
			I: "#333", P: "#333", F: "#333", M: "#333", W: "#333",
			S: "#333", T: "#333", C: "#333", Y: "#333",
			N: "#333", Q: "#333",
			K: "#333", R: "#333", H: "#333",
			D: "#FFF", E: "#FFF",
		},
	},

	charge: {
		id: "charge",
		name: "Charge (pH 7)",
		type: "aa",
		description: "Charge at physiological pH",
		colors: {
			K: "#2196F3", R: "#2196F3",
			H: "#90CAF9",
			D: "#F44336", E: "#F44336",
			A: "#E0E0E0", C: "#E0E0E0", F: "#E0E0E0", G: "#E0E0E0",
			I: "#E0E0E0", L: "#E0E0E0", M: "#E0E0E0", N: "#E0E0E0",
			P: "#E0E0E0", Q: "#E0E0E0", S: "#E0E0E0", T: "#E0E0E0",
			V: "#E0E0E0", W: "#E0E0E0", Y: "#E0E0E0",
		},
		textColors: {
			K: "#FFF", R: "#FFF",
			H: "#333",
			D: "#FFF", E: "#FFF",
			A: "#333", C: "#333", F: "#333", G: "#333",
			I: "#333", L: "#333", M: "#333", N: "#333",
			P: "#333", Q: "#333", S: "#333", T: "#333",
			V: "#333", W: "#333", Y: "#333",
		},
	},

	chemical: {
		id: "chemical",
		name: "Chemical Type",
		type: "aa",
		description: "Side chain chemistry groups",
		colors: {
			G: "#BDBDBD", A: "#BDBDBD", V: "#BDBDBD", L: "#BDBDBD",
			I: "#BDBDBD", P: "#BDBDBD",
			F: "#7E57C2", W: "#7E57C2", Y: "#7E57C2",
			C: "#FDD835", M: "#FDD835",
			S: "#FF8A65", T: "#FF8A65",
			D: "#EF5350", E: "#EF5350",
			N: "#EF9A9A", Q: "#EF9A9A",
			K: "#42A5F5", R: "#42A5F5",
			H: "#90CAF9",
		},
		textColors: {
			G: "#333", A: "#333", V: "#333", L: "#333",
			I: "#333", P: "#333",
			F: "#FFF", W: "#FFF", Y: "#FFF",
			C: "#333", M: "#333",
			S: "#333", T: "#333",
			D: "#FFF", E: "#FFF",
			N: "#333", Q: "#333",
			K: "#333", R: "#333",
			H: "#333",
		},
	},

	cysteine: {
		id: "cysteine",
		name: "Cysteine",
		type: "aa",
		description: "Highlights cysteine residues only",
		colors: {
			A: "#BDBDBD", R: "#BDBDBD", N: "#BDBDBD", D: "#BDBDBD",
			C: "#E91E63", Q: "#BDBDBD", E: "#BDBDBD", G: "#BDBDBD",
			H: "#BDBDBD", I: "#BDBDBD", L: "#BDBDBD", K: "#BDBDBD",
			M: "#BDBDBD", F: "#BDBDBD", P: "#BDBDBD", S: "#BDBDBD",
			T: "#BDBDBD", W: "#BDBDBD", Y: "#BDBDBD", V: "#BDBDBD",
		},
		textColors: {
			A: "#555", R: "#555", N: "#555", D: "#555",
			C: "#FFF", Q: "#555", E: "#555", G: "#555",
			H: "#555", I: "#555", L: "#555", K: "#555",
			M: "#555", F: "#555", P: "#555", S: "#555",
			T: "#555", W: "#555", Y: "#555", V: "#555",
		},
	},

	phosphorylation: {
		id: "phosphorylation",
		name: "Phosphorylation",
		type: "aa",
		description: "Highlights phosphorylatable residues (S, T, Y)",
		colors: {
			A: "#BDBDBD", R: "#BDBDBD", N: "#BDBDBD", D: "#BDBDBD",
			C: "#BDBDBD", Q: "#BDBDBD", E: "#BDBDBD", G: "#BDBDBD",
			H: "#BDBDBD", I: "#BDBDBD", L: "#BDBDBD", K: "#BDBDBD",
			M: "#BDBDBD", F: "#BDBDBD", P: "#BDBDBD",
			S: "#2196F3", T: "#FF9800", Y: "#9C27B0",
			W: "#BDBDBD", V: "#BDBDBD",
		},
		textColors: {
			A: "#555", R: "#555", N: "#555", D: "#555",
			C: "#555", Q: "#555", E: "#555", G: "#555",
			H: "#555", I: "#555", L: "#555", K: "#555",
			M: "#555", F: "#555", P: "#555",
			S: "#FFF", T: "#FFF", Y: "#FFF",
			W: "#555", V: "#555",
		},
	},
};
