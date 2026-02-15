import { AAComposition, ProteinProperties } from "../types";
import {
	AMINO_ACIDS,
	ATOM_COUNTS,
	DIWV,
	KYTE_DOOLITTLE,
	PK_BJELLQVIST,
	RESIDUE_WEIGHTS,
	WATER_MW,
} from "./aminoAcidData";

function computeComposition(sequence: string): AAComposition {
	const counts: Record<string, number> = {};
	for (const aa of AMINO_ACIDS) {
		counts[aa] = 0;
	}
	for (const residue of sequence) {
		if (counts[residue] !== undefined) {
			counts[residue]++;
		}
	}

	const totalResidues = sequence.length;
	const percentages: Record<string, number> = {};
	for (const aa of AMINO_ACIDS) {
		const c = counts[aa] ?? 0;
		percentages[aa] = totalResidues > 0 ? (c / totalResidues) * 100 : 0;
	}

	return { counts, percentages, totalResidues };
}

function computeMolecularWeight(composition: AAComposition): number {
	let mw = WATER_MW;
	for (const aa of AMINO_ACIDS) {
		const count = composition.counts[aa] ?? 0;
		const weight = RESIDUE_WEIGHTS[aa];
		if (weight !== undefined) {
			mw += count * weight;
		}
	}
	return mw;
}

function computePI(sequence: string): number {
	if (sequence.length === 0) return 0;

	const nTermAA = sequence[0] as string;
	const cTermAA = sequence[sequence.length - 1] as string;

	const nTermPK =
		PK_BJELLQVIST.nTermAdjust[nTermAA] ?? PK_BJELLQVIST.positive.nTerm;
	const cTermPK =
		PK_BJELLQVIST.cTermAdjust[cTermAA] ?? PK_BJELLQVIST.negative.cTerm;

	const positiveCounts: { pKa: number; count: number }[] = [
		{ pKa: nTermPK, count: 1 },
	];
	const negativeCounts: { pKa: number; count: number }[] = [
		{ pKa: cTermPK, count: 1 },
	];

	let kCount = 0,
		rCount = 0,
		hCount = 0;
	let dCount = 0,
		eCount = 0,
		cCount = 0,
		yCount = 0;

	for (const residue of sequence) {
		switch (residue) {
			case "K":
				kCount++;
				break;
			case "R":
				rCount++;
				break;
			case "H":
				hCount++;
				break;
			case "D":
				dCount++;
				break;
			case "E":
				eCount++;
				break;
			case "C":
				cCount++;
				break;
			case "Y":
				yCount++;
				break;
		}
	}

	if (kCount > 0)
		positiveCounts.push({ pKa: PK_BJELLQVIST.positive.K, count: kCount });
	if (rCount > 0)
		positiveCounts.push({ pKa: PK_BJELLQVIST.positive.R, count: rCount });
	if (hCount > 0)
		positiveCounts.push({ pKa: PK_BJELLQVIST.positive.H, count: hCount });

	if (dCount > 0)
		negativeCounts.push({ pKa: PK_BJELLQVIST.negative.D, count: dCount });
	if (eCount > 0)
		negativeCounts.push({ pKa: PK_BJELLQVIST.negative.E, count: eCount });
	if (cCount > 0)
		negativeCounts.push({ pKa: PK_BJELLQVIST.negative.C, count: cCount });
	if (yCount > 0)
		negativeCounts.push({ pKa: PK_BJELLQVIST.negative.Y, count: yCount });

	function chargeAtPH(pH: number): number {
		let charge = 0;
		for (const group of positiveCounts) {
			charge += group.count / (Math.pow(10, pH - group.pKa) + 1);
		}
		for (const group of negativeCounts) {
			charge -= group.count / (Math.pow(10, group.pKa - pH) + 1);
		}
		return charge;
	}

	let low = 0;
	let high = 14;
	while (high - low > 0.0001) {
		const mid = (low + high) / 2;
		if (chargeAtPH(mid) > 0) {
			low = mid;
		} else {
			high = mid;
		}
	}

	return (low + high) / 2;
}

function computeExtinctionCoefficient(composition: AAComposition): {
	reduced: number;
	oxidized: number;
} {
	const nW = composition.counts["W"] ?? 0;
	const nY = composition.counts["Y"] ?? 0;
	const nC = composition.counts["C"] ?? 0;

	const reduced = nW * 5500 + nY * 1490;
	const oxidized = reduced + Math.floor(nC / 2) * 125;

	return { reduced, oxidized };
}

function computeGRAVY(
	composition: AAComposition,
	totalResidues: number
): number {
	if (totalResidues === 0) return 0;
	let sum = 0;
	for (const aa of AMINO_ACIDS) {
		const count = composition.counts[aa] ?? 0;
		const kd = KYTE_DOOLITTLE[aa];
		if (kd !== undefined) {
			sum += count * kd;
		}
	}
	return sum / totalResidues;
}

function computeAliphaticIndex(composition: AAComposition): number {
	const total = composition.totalResidues;
	if (total === 0) return 0;

	const xA = ((composition.counts["A"] ?? 0) / total) * 100;
	const xV = ((composition.counts["V"] ?? 0) / total) * 100;
	const xI = ((composition.counts["I"] ?? 0) / total) * 100;
	const xL = ((composition.counts["L"] ?? 0) / total) * 100;

	return xA + 2.9 * xV + 3.9 * (xI + xL);
}

function computeInstabilityIndex(sequence: string): number {
	const L = sequence.length;
	if (L < 2) return 0;

	let sum = 0;
	for (let i = 0; i < L - 1; i++) {
		const aa1 = sequence[i] as string;
		const aa2 = sequence[i + 1] as string;
		const row = DIWV[aa1];
		const value = row ? (row[aa2] ?? 1.0) : 1.0;
		sum += value;
	}

	return (10.0 / L) * sum;
}

function computeMolecularFormula(composition: AAComposition): {
	formula: string;
	atomCounts: Record<string, number>;
} {
	const atoms = { C: 0, H: 0, N: 0, O: 0, S: 0 };

	for (const aa of AMINO_ACIDS) {
		const count = composition.counts[aa] ?? 0;
		if (count === 0) continue;
		const ac = ATOM_COUNTS[aa];
		if (!ac) continue;
		atoms.C += count * ac[0];
		atoms.H += count * ac[1];
		atoms.N += count * ac[2];
		atoms.O += count * ac[3];
		atoms.S += count * ac[4];
	}

	// Add water (H2O) for the intact protein
	atoms.H += 2;
	atoms.O += 1;

	const parts: string[] = [];
	if (atoms.C > 0) parts.push(`C${atoms.C}`);
	if (atoms.H > 0) parts.push(`H${atoms.H}`);
	if (atoms.N > 0) parts.push(`N${atoms.N}`);
	if (atoms.O > 0) parts.push(`O${atoms.O}`);
	if (atoms.S > 0) parts.push(`S${atoms.S}`);

	return { formula: parts.join(" "), atomCounts: atoms };
}

export function calculateProteinProperties(
	sequence: string,
	assumeDisulfideBonds: boolean
): ProteinProperties {
	if (sequence.length === 0) {
		return {
			molecularWeight: 0,
			theoreticalPI: 0,
			extinctionCoefficient: 0,
			extinctionCoefficientSS: 0,
			absorbance01: 0,
			absorbance01SS: 0,
			gravy: 0,
			aliphaticIndex: 0,
			instabilityIndex: 0,
			isStable: true,
			composition: { counts: {}, percentages: {}, totalResidues: 0 },
			formula: "",
			atomCounts: {},
		};
	}

	const composition = computeComposition(sequence);
	const molecularWeight = computeMolecularWeight(composition);
	const theoreticalPI = computePI(sequence);
	const extinction = computeExtinctionCoefficient(composition);
	const gravy = computeGRAVY(composition, composition.totalResidues);
	const aliphaticIndex = computeAliphaticIndex(composition);
	const instabilityIndex = computeInstabilityIndex(sequence);
	const { formula, atomCounts } = computeMolecularFormula(composition);

	const absorbance01 =
		molecularWeight > 0 ? extinction.reduced / molecularWeight : 0;
	const absorbance01SS =
		molecularWeight > 0 ? extinction.oxidized / molecularWeight : 0;

	return {
		molecularWeight,
		theoreticalPI,
		extinctionCoefficient: assumeDisulfideBonds
			? extinction.oxidized
			: extinction.reduced,
		extinctionCoefficientSS: extinction.oxidized,
		absorbance01,
		absorbance01SS,
		gravy,
		aliphaticIndex,
		instabilityIndex,
		isStable: instabilityIndex < 40,
		composition,
		formula,
		atomCounts,
	};
}
