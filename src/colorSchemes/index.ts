import { ColorScheme, AAColorSchemeId, NucleotideColorSchemeId } from "../types";
import { AA_SCHEMES } from "./aminoAcid";
import { NUCLEOTIDE_SCHEMES } from "./nucleotide";

export function getAAScheme(id: AAColorSchemeId): ColorScheme {
	return AA_SCHEMES[id];
}

export function getNucleotideScheme(id: NucleotideColorSchemeId): ColorScheme {
	return NUCLEOTIDE_SCHEMES[id];
}

export function getAASchemeList(): ColorScheme[] {
	return Object.values(AA_SCHEMES);
}

export function getNucleotideSchemeList(): ColorScheme[] {
	return Object.values(NUCLEOTIDE_SCHEMES);
}
