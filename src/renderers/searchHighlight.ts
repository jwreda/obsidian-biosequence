import { autoContrast } from "../colorSchemes/aminoAcid";

/** Find all positions covered by exact matches of searchTerm in sequence. */
export function findMatchPositions(sequence: string, searchTerm: string): Set<number> {
	const positions = new Set<number>();
	if (searchTerm.length === 0) return positions;
	const upper = searchTerm.toUpperCase();
	let idx = 0;
	while ((idx = sequence.indexOf(upper, idx)) !== -1) {
		for (let i = idx; i < idx + upper.length; i++) {
			positions.add(i);
		}
		idx++;
	}
	return positions;
}

/** Count number of (possibly overlapping) match starting positions. */
export function countMatches(sequence: string, searchTerm: string): number {
	if (searchTerm.length === 0) return 0;
	const upper = searchTerm.toUpperCase();
	let count = 0;
	let idx = 0;
	while ((idx = sequence.indexOf(upper, idx)) !== -1) {
		count++;
		idx++;
	}
	return count;
}

/** DOM-patch residue colors: accent on matches, neutral CSS class on non-matches. */
export function applySearchHighlight(
	seqDiv: HTMLElement,
	sequence: string,
	searchTerm: string,
	accentColor: string
): number {
	const matchPositions = findMatchPositions(sequence, searchTerm);
	const residues = seqDiv.querySelectorAll<HTMLElement>(".biosequence-residue[data-pos]");

	for (const res of Array.from(residues)) {
		const pos = parseInt(res.dataset["pos"] ?? "-1", 10);
		if (matchPositions.has(pos)) {
			res.style.backgroundColor = accentColor;
			res.style.color = autoContrast(accentColor);
			res.classList.remove("biosequence-residue-neutral");
		} else {
			res.style.removeProperty("background-color");
			res.style.removeProperty("color");
			if (!res.classList.contains("biosequence-residue-neutral")) {
				res.classList.add("biosequence-residue-neutral");
			}
		}
	}

	return countMatches(sequence, searchTerm);
}
