import { NucleotideProperties, SequenceType } from "../types";

const DNA_WEIGHTS: Record<string, number> = {
	A: 313.21,
	T: 304.19,
	G: 329.21,
	C: 289.18,
};

const RNA_WEIGHTS: Record<string, number> = {
	A: 329.21,
	U: 306.17,
	G: 345.21,
	C: 305.18,
};

const DNA_COMPLEMENT: Record<string, string> = {
	A: "T",
	T: "A",
	G: "C",
	C: "G",
};

const RNA_COMPLEMENT: Record<string, string> = {
	A: "U",
	U: "A",
	G: "C",
	C: "G",
};

/** Pyrophosphate loss from 5' end */
const PYROPHOSPHATE_LOSS = 61.96;

export function calculateNucleotideProperties(
	sequence: string,
	type: SequenceType
): NucleotideProperties {
	const length = sequence.length;

	if (length === 0) {
		return {
			length: 0,
			gcContent: 0,
			gcPercent: 0,
			molecularWeight: 0,
			complement: "",
			reverseComplement: "",
			meltingTemp: 0,
			atCount: 0,
			gcCount: 0,
		};
	}

	const isDNA = type === "dna";
	const weights = isDNA ? DNA_WEIGHTS : RNA_WEIGHTS;
	const complementMap = isDNA ? DNA_COMPLEMENT : RNA_COMPLEMENT;

	let gcCount = 0;
	let atCount = 0;
	let mw = 0;
	const complementChars: string[] = [];

	for (const base of sequence) {
		const upper = base.toUpperCase();
		if (upper === "G" || upper === "C") {
			gcCount++;
		} else {
			atCount++;
		}
		mw += weights[upper] ?? 0;
		complementChars.push(complementMap[upper] ?? upper);
	}

	// Subtract pyrophosphate loss
	mw -= PYROPHOSPHATE_LOSS;

	const gcContent = gcCount / length;
	const gcPercent = gcContent * 100;

	const complement = complementChars.join("");
	const reverseComplement = complementChars.slice().reverse().join("");

	// Melting temperature
	let meltingTemp: number;
	if (length <= 13) {
		// Wallace rule
		meltingTemp = 2 * atCount + 4 * gcCount;
	} else {
		meltingTemp = 64.9 + (41 * (gcCount - 16.4)) / length;
	}

	return {
		length,
		gcContent,
		gcPercent,
		molecularWeight: mw,
		complement,
		reverseComplement,
		meltingTemp,
		atCount,
		gcCount,
	};
}
