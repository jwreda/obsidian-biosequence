// src/calculations/translation.ts
//
// 6-frame DNA translation utilities.
// All coordinates are 0-based, half-open [start, end).

export type FrameId = "+1" | "+2" | "+3" | "-1" | "-2" | "-3";

export interface Frame {
	id: FrameId;
	/** Translated protein string. Stop codons appear as "*". Ambiguous codons appear as "X". */
	protein: string;
	/**
	 * For each aa index i in `protein`, the 0-based nt start position on the
	 * ORIGINAL FORWARD STRAND of the codon that produced it.
	 * For reverse frames, codonStartsForward[i] is the nt position of the
	 * FIRST nucleotide of the codon as it appears on the forward strand
	 * (i.e., the rightmost of the three nt on the reverse strand).
	 * Codon nt range on forward strand: [codonStartsForward[i], codonStartsForward[i] + 3).
	 */
	codonStartsForward: number[];
}

/** Standard genetic code (Table 1). Returns "*" for stops, "X" for codons containing non-ACGT. */
export const CODON_TABLE: Record<string, string> = {
	TTT: "F", TTC: "F", TTA: "L", TTG: "L",
	CTT: "L", CTC: "L", CTA: "L", CTG: "L",
	ATT: "I", ATC: "I", ATA: "I", ATG: "M",
	GTT: "V", GTC: "V", GTA: "V", GTG: "V",
	TCT: "S", TCC: "S", TCA: "S", TCG: "S",
	CCT: "P", CCC: "P", CCA: "P", CCG: "P",
	ACT: "T", ACC: "T", ACA: "T", ACG: "T",
	GCT: "A", GCC: "A", GCA: "A", GCG: "A",
	TAT: "Y", TAC: "Y", TAA: "*", TAG: "*",
	CAT: "H", CAC: "H", CAA: "Q", CAG: "Q",
	AAT: "N", AAC: "N", AAA: "K", AAG: "K",
	GAT: "D", GAC: "D", GAA: "E", GAG: "E",
	TGT: "C", TGC: "C", TGA: "*", TGG: "W",
	CGT: "R", CGC: "R", CGA: "R", CGG: "R",
	AGT: "S", AGC: "S", AGA: "R", AGG: "R",
	GGT: "G", GGC: "G", GGA: "G", GGG: "G",
};

const COMPLEMENT: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };

/** Translate a single codon. Returns "X" if codon contains any non-ACGT base. */
export function translateCodon(codon: string): string {
	if (codon.length !== 3) return "X";
	const upper = codon.toUpperCase();
	return CODON_TABLE[upper] ?? "X";
}

/** Reverse-complement a DNA string. Non-ACGT bases pass through unchanged. */
export function reverseComplement(seq: string): string {
	const upper = seq.toUpperCase();
	const out: string[] = [];
	for (let i = upper.length - 1; i >= 0; i--) {
		const base = upper[i]!;
		out.push(COMPLEMENT[base] ?? base);
	}
	return out.join("");
}

/**
 * Translate one forward frame (1, 2, or 3).
 * Returns the protein string and an array mapping each aa index to its
 * codon's nt start on the forward strand.
 * Trailing partial codons (< 3 nt) are dropped.
 */
export function translateForwardFrame(
	sequence: string,
	frame: 1 | 2 | 3
): { protein: string; codonStartsForward: number[] } {
	const upper = sequence.toUpperCase();
	const offset = frame - 1;
	const protein: string[] = [];
	const codonStarts: number[] = [];
	for (let i = offset; i + 3 <= upper.length; i += 3) {
		protein.push(translateCodon(upper.slice(i, i + 3)));
		codonStarts.push(i);
	}
	return { protein: protein.join(""), codonStartsForward: codonStarts };
}

/**
 * Produce all 6 reading frames.
 *
 * Forward frames (+1/+2/+3): translated directly from `sequence`.
 *   codonStartsForward[i] is the 0-based nt index on the forward strand.
 *
 * Reverse frames (-1/-2/-3): translated from reverseComplement(sequence).
 *   We compute the protein from the reverse-complement string, then map each
 *   aa back to its codon's position on the FORWARD strand.
 *
 *   Let L = sequence.length, and let i be the aa index in the reverse frame's
 *   protein. The codon was taken from rc[offset + 3i : offset + 3i + 3] where
 *   rc = reverseComplement(sequence) and offset = frame - 1. That codon
 *   corresponds to forward-strand positions [L - (offset + 3i + 3), L - (offset + 3i)).
 *   So codonStartsForward[i] = L - offset - 3i - 3.
 */
export function translateAllFrames(sequence: string): Frame[] {
	const upper = sequence.toUpperCase();
	const L = upper.length;
	const frames: Frame[] = [];

	for (const f of [1, 2, 3] as const) {
		const { protein, codonStartsForward } = translateForwardFrame(upper, f);
		frames.push({ id: `+${f}` as FrameId, protein, codonStartsForward });
	}

	const rc = reverseComplement(upper);
	for (const f of [1, 2, 3] as const) {
		const { protein, codonStartsForward: rcStarts } = translateForwardFrame(rc, f);
		const offset = f - 1;
		const forwardStarts = rcStarts.map((_, i) => L - offset - 3 * i - 3);
		frames.push({ id: `-${f}` as FrameId, protein, codonStartsForward: forwardStarts });
	}

	return frames;
}
