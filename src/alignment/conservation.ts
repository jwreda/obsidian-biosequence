/**
 * Compute a conservation string for two aligned sequences.
 *
 * Returns a string of the same length as the input sequences with:
 *   `|` = identical residues
 *   `:` = strongly similar (BLOSUM62 groups)
 *   `.` = weakly similar (broader group match)
 *   ` ` = mismatch (both residues present, no similarity)
 *   `_` = gap present (at least one sequence has `-`)
 *
 * For nucleotide sequences, only `|` (identity), ` ` (mismatch), and `_` (gap) are used.
 */

// Strong similarity groups (BLOSUM62-derived)
const STRONG_GROUPS: string[][] = [
	["S", "T", "A"],
	["N", "E", "Q", "K"],
	["N", "H", "Q", "K"],
	["N", "D", "E", "Q"],
	["Q", "H", "R", "K"],
	["M", "I", "L", "V"],
	["M", "I", "L", "F"],
	["H", "Y"],
	["F", "Y", "W"],
];

// Weak similarity groups (broader physicochemical)
const WEAK_GROUPS: string[][] = [
	["C", "S", "A"],
	["A", "T", "V"],
	["S", "A", "G"],
	["S", "T", "N", "K"],
	["S", "T", "P", "A"],
	["S", "G", "N", "D"],
	["S", "N", "D", "E", "Q", "K"],
	["N", "D", "E", "Q", "H", "K"],
	["N", "E", "Q", "H", "R", "K"],
	["F", "V", "L", "I", "M"],
	["H", "F", "Y"],
];

// Pre-compute lookup sets for faster checking
const strongSets: Set<string>[] = STRONG_GROUPS.map(
	(group) => new Set(group)
);
const weakSets: Set<string>[] = WEAK_GROUPS.map((group) => new Set(group));

const NUCLEOTIDE_CHARS = new Set(["A", "T", "U", "G", "C"]);

/**
 * Detect whether an aligned sequence (possibly with gaps) is nucleotide.
 */
function isNucleotideSequence(seq: string): boolean {
	for (let i = 0; i < seq.length; i++) {
		const ch = seq.charAt(i).toUpperCase();
		if (ch === "-") continue;
		if (!NUCLEOTIDE_CHARS.has(ch)) return false;
	}
	return true;
}

export function computeConservation(seq1: string, seq2: string): string {
	const len = Math.max(seq1.length, seq2.length);
	const result: string[] = [];

	// Determine if these are nucleotide sequences
	const isNuc = isNucleotideSequence(seq1) && isNucleotideSequence(seq2);

	for (let i = 0; i < len; i++) {
		const a = (i < seq1.length ? seq1.charAt(i) : "-").toUpperCase();
		const b = (i < seq2.length ? seq2.charAt(i) : "-").toUpperCase();

		// If either is a gap, mark as gap (distinct from mismatch)
		if (a === "-" || b === "-") {
			result.push("_");
			continue;
		}

		// Identity
		if (a === b) {
			result.push("|");
			continue;
		}

		// For nucleotides, no similarity scoring beyond identity
		if (isNuc) {
			result.push(" ");
			continue;
		}

		// Strong similarity check
		let found = false;
		for (const group of strongSets) {
			if (group.has(a) && group.has(b)) {
				result.push(":");
				found = true;
				break;
			}
		}
		if (found) continue;

		// Weak similarity check
		for (const group of weakSets) {
			if (group.has(a) && group.has(b)) {
				result.push(".");
				found = true;
				break;
			}
		}
		if (found) continue;

		// No similarity
		result.push(" ");
	}

	return result.join("");
}
