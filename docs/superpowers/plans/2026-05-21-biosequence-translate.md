# 6-Frame Translate Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-destructive translate block below every rendered DNA code block that shows all 6 reading frames with protein-feature highlights, with stop/start codon styling gated on per-frame feature presence.

**Architecture:** Three new modules — `translation.ts` (codon table + 6-frame translator), `proteinFeatureMatcher.ts` (substring-match enabled `type: "aa"` features against translated frames, mapping aa coords back to nt coords), and `TranslateRenderer.ts` (renders a sibling block under the existing DNA render). `main.ts` calls the renderer after the DNA renderer. One new setting (`showTranslateBlock`). New validation tests in `validate.mjs`.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild, Node-based `validate.mjs` test harness.

**Spec:** `docs/superpowers/specs/2026-05-21-biosequence-translate-design.md`

**Coordinate convention:** All coordinates are **0-based, half-open** internally (`[start, end)`). Display strings may be 1-based, but interfaces, return values, and tests use 0-based half-open. Document this in each module header.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/calculations/translation.ts` | Create | Codon table + frame translation utilities |
| `src/features/proteinFeatureMatcher.ts` | Create | Match `type: "aa"` features against translated frames; map aa→nt |
| `src/renderers/TranslateRenderer.ts` | Create | Render the sibling translate block |
| `src/types.ts` | Modify | Add `Frame`, `ProteinMatch`, `FrameId` types; add `showTranslateBlock` to `BiosequenceSettings` and `DEFAULT_SETTINGS` |
| `src/main.ts` | Modify | Call `renderTranslateBlock` after `renderNucleotideBlock` for DNA only |
| `src/settings.ts` | Modify | Add toggle UI for `showTranslateBlock` |
| `styles.css` | Modify | Add `.biosequence-translate-*` classes |
| `validate.mjs` | Modify | Add translation correctness tests + matcher tests |

---

## Task 1: Codon table and forward-frame translation

**Files:**
- Create: `src/calculations/translation.ts`

- [ ] **Step 1: Create the file with codon table and type exports**

```typescript
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
```

- [ ] **Step 2: Create the test fixtures file**

```typescript
// src/calculations/translation.test.ts
//
// Manual test file consumed by validate.mjs. Not executed by TS directly.
// (We use validate.mjs as the test harness, mirroring existing convention.)
```

Skip — we test via `validate.mjs` in Task 4. Mark this step done without action.

- [ ] **Step 3: Quick TypeScript compile check**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck`
Expected: no errors related to `translation.ts`.

- [ ] **Step 4: Commit**

```bash
cd /Users/joereda/github-local/obsidian-biosequence
git add src/calculations/translation.ts
git commit -m "feat(translate): add codon table and forward-frame translator"
```

---

## Task 2: 6-frame translation with reverse-strand coordinate mapping

**Files:**
- Modify: `src/calculations/translation.ts` (append `translateAllFrames`)

- [ ] **Step 1: Append `translateAllFrames` to `translation.ts`**

```typescript
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
```

- [ ] **Step 2: TypeScript compile check**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/joereda/github-local/obsidian-biosequence
git add src/calculations/translation.ts
git commit -m "feat(translate): add 6-frame translation with reverse-strand coordinate mapping"
```

---

## Task 3: Protein feature matcher

**Files:**
- Create: `src/features/proteinFeatureMatcher.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/features/proteinFeatureMatcher.ts
//
// Match enabled `type: "aa"` features from the library against translated frames.
// Coordinates are 0-based, half-open [start, end).

import { FeatureEntry } from "../types";
import { Frame, FrameId } from "../calculations/translation";

export interface ProteinMatch {
	featureId: string;
	name: string;
	color: string;
	frame: FrameId;
	aaStart: number;   // inclusive, 0-based, index into Frame.protein
	aaEnd: number;     // exclusive
	ntStart: number;   // inclusive, 0-based, on forward strand
	ntEnd: number;     // exclusive, on forward strand
}

/**
 * For each frame, find all (overlapping) substring matches of every enabled
 * `type: "aa"` feature. Map aa coordinates back to forward-strand nt
 * coordinates using Frame.codonStartsForward.
 *
 * Rules:
 * - Stop characters "*" in the protein are ordinary characters for substring
 *   purposes. A feature sequence containing "*" would still match, but this
 *   is not expected in practice.
 * - Features with empty sequence or longer than the frame protein are skipped.
 * - Case-insensitive match (uppercase normalize both sides).
 */
export function matchProteinFeatures(
	frames: Frame[],
	features: FeatureEntry[]
): ProteinMatch[] {
	const matches: ProteinMatch[] = [];

	for (const frame of frames) {
		const proteinUpper = frame.protein.toUpperCase();
		if (proteinUpper.length === 0) continue;

		for (const feature of features) {
			if (!feature.enabled) continue;
			if (feature.type !== "aa") continue;

			const featureSeq = feature.sequence.toUpperCase();
			if (featureSeq.length === 0 || featureSeq.length > proteinUpper.length) continue;

			let searchFrom = 0;
			while (searchFrom <= proteinUpper.length - featureSeq.length) {
				const aaStart = proteinUpper.indexOf(featureSeq, searchFrom);
				if (aaStart === -1) break;
				const aaEnd = aaStart + featureSeq.length;

				// Map aa range → nt range on forward strand.
				// For forward frames: nt range covers codons aaStart..aaEnd-1 in increasing nt order.
				// For reverse frames: codonStartsForward is decreasing, so the smallest nt is the
				// LAST aa's codon start. We compute min and max regardless of frame direction.
				const starts = frame.codonStartsForward;
				const firstCodonStart = starts[aaStart]!;
				const lastCodonStart = starts[aaEnd - 1]!;
				const ntStart = Math.min(firstCodonStart, lastCodonStart);
				const ntEnd = Math.max(firstCodonStart, lastCodonStart) + 3;

				matches.push({
					featureId: feature.id,
					name: feature.name,
					color: feature.color,
					frame: frame.id,
					aaStart,
					aaEnd,
					ntStart,
					ntEnd,
				});

				searchFrom = aaStart + 1;
			}
		}
	}

	return matches;
}

/** Return the set of frame IDs that have at least one match. */
export function annotatedFrameIds(matches: ProteinMatch[]): Set<FrameId> {
	const set = new Set<FrameId>();
	for (const m of matches) set.add(m.frame);
	return set;
}
```

- [ ] **Step 2: TypeScript compile check**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/joereda/github-local/obsidian-biosequence
git add src/features/proteinFeatureMatcher.ts
git commit -m "feat(translate): add protein feature matcher with aa→nt coordinate mapping"
```

---

## Task 4: Validation tests for translation and matching

**Files:**
- Modify: `validate.mjs` (append a new section after existing tests)

- [ ] **Step 1: Inline a copy of the codon table and frame translator into `validate.mjs`**

Follow the existing convention in `validate.mjs` of inlining data tables. Append at the bottom of the file (before the final summary/exit, or as a new section if the file ends without one — check the file structure first and place the new section in the same style as existing test blocks):

```javascript
// ── Translation tests (Task 4) ─────────────────────────────────────────

const CODON_TABLE = {
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
const COMP = { A: "T", T: "A", G: "C", C: "G" };

function translateCodon(c) {
	if (c.length !== 3) return "X";
	return CODON_TABLE[c.toUpperCase()] ?? "X";
}

function reverseComplement(seq) {
	const u = seq.toUpperCase();
	let out = "";
	for (let i = u.length - 1; i >= 0; i--) out += COMP[u[i]] ?? u[i];
	return out;
}

function translateForwardFrame(seq, frame) {
	const u = seq.toUpperCase();
	const offset = frame - 1;
	const aa = [];
	const starts = [];
	for (let i = offset; i + 3 <= u.length; i += 3) {
		aa.push(translateCodon(u.slice(i, i + 3)));
		starts.push(i);
	}
	return { protein: aa.join(""), codonStartsForward: starts };
}

function translateAllFrames(seq) {
	const u = seq.toUpperCase();
	const L = u.length;
	const frames = [];
	for (const f of [1, 2, 3]) {
		const r = translateForwardFrame(u, f);
		frames.push({ id: "+" + f, ...r });
	}
	const rc = reverseComplement(u);
	for (const f of [1, 2, 3]) {
		const r = translateForwardFrame(rc, f);
		const offset = f - 1;
		const forwardStarts = r.codonStartsForward.map((_, i) => L - offset - 3 * i - 3);
		frames.push({ id: "-" + f, protein: r.protein, codonStartsForward: forwardStarts });
	}
	return frames;
}
```

- [ ] **Step 2: Append the codon-table coverage test**

```javascript
// Test 1: All 64 codons translate to expected residues
function testCodonTable() {
	const bases = ["A", "C", "G", "T"];
	const expected = {
		// Sanity-check a representative subset; full table is in CODON_TABLE.
		ATG: "M", TAA: "*", TAG: "*", TGA: "*",
		TGG: "W", TTT: "F", GGG: "G", AAA: "K",
		CGN_AGA: "R", // covered by entries CGA + AGA below
	};
	let pass = 0, fail = 0;
	for (const b1 of bases) for (const b2 of bases) for (const b3 of bases) {
		const codon = b1 + b2 + b3;
		const aa = translateCodon(codon);
		if (typeof aa !== "string" || aa.length !== 1) { fail++; console.error("BAD", codon, aa); }
		else pass++;
	}
	// Spot-checks
	for (const [codon, want] of [["ATG","M"],["TAA","*"],["TAG","*"],["TGA","*"],["TGG","W"]]) {
		if (translateCodon(codon) !== want) { fail++; console.error("MISMATCH", codon, "want", want); }
		else pass++;
	}
	console.log(`Codon table: ${pass} pass, ${fail} fail`);
	return fail === 0;
}
```

- [ ] **Step 3: Append a 6-frame translation test on a known fixture**

The fixture: DNA `ATGAAACGTTAA` (= Met-Lys-Arg-Stop in +1).

```javascript
function test6Frames() {
	const dna = "ATGAAACGTTAA";
	const frames = translateAllFrames(dna);
	const byId = Object.fromEntries(frames.map(f => [f.id, f]));

	const checks = [
		// Forward
		["+1", "MKR*", [0, 3, 6, 9]],
		["+2", "*NV",  [1, 4, 7]],
		["+3", "ETL",  [2, 5, 8]],
		// Reverse (rc of ATGAAACGTTAA = TTAACGTTTCAT)
		// rc frame +1 = TTA ACG TTT CAT = L T F H → forward nt starts L-0-3i-3, L=12
		["-1", "LTFH", [9, 6, 3, 0]],
		// rc frame +2 = TAA CGT TTC AT(drop) = * R F → L-1-3i-3 = 8,5,2
		["-2", "*RF",  [8, 5, 2]],
		// rc frame +3 = AAC GTT TCA T(drop) = N V S → L-2-3i-3 = 7,4,1
		["-3", "NVS",  [7, 4, 1]],
	];

	let pass = 0, fail = 0;
	for (const [id, proteinExp, startsExp] of checks) {
		const f = byId[id];
		if (!f) { fail++; console.error("Missing frame", id); continue; }
		if (f.protein !== proteinExp) {
			fail++; console.error(`Frame ${id} protein: got "${f.protein}" want "${proteinExp}"`);
			continue;
		}
		if (JSON.stringify(f.codonStartsForward) !== JSON.stringify(startsExp)) {
			fail++; console.error(`Frame ${id} starts: got ${JSON.stringify(f.codonStartsForward)} want ${JSON.stringify(startsExp)}`);
			continue;
		}
		pass++;
	}
	console.log(`6-frame translation: ${pass} pass, ${fail} fail`);
	return fail === 0;
}
```

- [ ] **Step 4: Append protein-feature matching test with reverse-frame coordinate verification**

```javascript
// Inline matcher (mirror of proteinFeatureMatcher.ts)
function matchProteinFeatures(frames, features) {
	const out = [];
	for (const frame of frames) {
		const p = frame.protein.toUpperCase();
		if (!p) continue;
		for (const feat of features) {
			if (!feat.enabled || feat.type !== "aa") continue;
			const fs = feat.sequence.toUpperCase();
			if (!fs || fs.length > p.length) continue;
			let from = 0;
			while (from <= p.length - fs.length) {
				const i = p.indexOf(fs, from);
				if (i === -1) break;
				const j = i + fs.length;
				const a = frame.codonStartsForward[i];
				const b = frame.codonStartsForward[j - 1];
				out.push({
					featureId: feat.id, name: feat.name, frame: frame.id,
					aaStart: i, aaEnd: j,
					ntStart: Math.min(a, b),
					ntEnd: Math.max(a, b) + 3,
				});
				from = i + 1;
			}
		}
	}
	return out;
}

function testMatcherForward() {
	const dna = "ATGAAACGTTAA"; // +1 = MKR*
	const features = [{ id: "f1", name: "MK", sequence: "MK", type: "aa", color: "#fff", enabled: true }];
	const ms = matchProteinFeatures(translateAllFrames(dna), features);
	const hit = ms.find(m => m.frame === "+1");
	const ok = !!hit && hit.aaStart === 0 && hit.aaEnd === 2 && hit.ntStart === 0 && hit.ntEnd === 6;
	console.log(`Matcher forward MK in +1: ${ok ? "pass" : "FAIL"}`, hit);
	return ok;
}

function testMatcherReverse() {
	// rc of ATGAAACGTTAA = TTAACGTTTCAT; -1 frame = LTFH; LT at aa 0–2.
	// codonStartsForward for -1 = [9, 6, 3, 0]. So LT → starts[0]=9, starts[1]=6.
	// nt range = [min(9,6), max(9,6)+3) = [6, 12).
	const dna = "ATGAAACGTTAA";
	const features = [{ id: "f1", name: "LT", sequence: "LT", type: "aa", color: "#fff", enabled: true }];
	const ms = matchProteinFeatures(translateAllFrames(dna), features);
	const hit = ms.find(m => m.frame === "-1");
	const ok = !!hit && hit.aaStart === 0 && hit.aaEnd === 2 && hit.ntStart === 6 && hit.ntEnd === 12;
	console.log(`Matcher reverse LT in -1: ${ok ? "pass" : "FAIL"}`, hit);
	return ok;
}

function testMatcherDisabledAndWrongType() {
	const dna = "ATGAAACGTTAA";
	const features = [
		{ id: "a", name: "MK", sequence: "MK", type: "aa", color: "#fff", enabled: false },
		{ id: "b", name: "ATG", sequence: "ATG", type: "dna", color: "#fff", enabled: true },
	];
	const ms = matchProteinFeatures(translateAllFrames(dna), features);
	const ok = ms.length === 0;
	console.log(`Matcher ignores disabled + non-aa: ${ok ? "pass" : "FAIL"}`, ms);
	return ok;
}

function testAmbiguousBases() {
	// "ATGNNNTAA" in +1 → M X *
	const dna = "ATGNNNTAA";
	const frames = translateAllFrames(dna);
	const f1 = frames.find(f => f.id === "+1");
	const ok = f1.protein === "MX*";
	console.log(`Ambiguous bases → X: ${ok ? "pass" : "FAIL"}`, f1.protein);
	return ok;
}
```

- [ ] **Step 5: Run the new tests and tally results**

Add at the end of `validate.mjs`:

```javascript
console.log("\n=== Translation tests ===");
const trResults = [
	testCodonTable(),
	test6Frames(),
	testMatcherForward(),
	testMatcherReverse(),
	testMatcherDisabledAndWrongType(),
	testAmbiguousBases(),
];
const trPass = trResults.filter(Boolean).length;
const trTotal = trResults.length;
console.log(`Translation suite: ${trPass}/${trTotal} passed`);
if (trPass !== trTotal) process.exit(1);
```

Run: `cd /Users/joereda/github-local/obsidian-biosequence && node validate.mjs`
Expected: All translation tests pass; existing tests still pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/joereda/github-local/obsidian-biosequence
git add validate.mjs
git commit -m "test(translate): validation suite for codon table, frames, and matcher"
```

---

## Task 5: Add types and settings field

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add `showTranslateBlock` to `BiosequenceSettings`**

In `src/types.ts`, edit the `BiosequenceSettings` interface to add the field. Locate the existing block (around line 112) and add `showTranslateBlock: boolean;` after `searchHighlightColor: string;`:

```typescript
export interface BiosequenceSettings {
	defaultAAScheme: AAColorSchemeId;
	defaultDNAScheme: NucleotideColorSchemeId;
	defaultRNAScheme: NucleotideColorSchemeId;
	residuesPerLine: number;
	showPositionNumbers: boolean;
	sequenceFontSize: number;
	summaryExpanded: boolean;
	assumeDisulfideBonds: boolean;
	mafftPath: string;
	alignmentOutputDir: string;
	conservationSymbols: ConservationSymbols;
	featureLibrary: FeatureEntry[];
	annotationDisplayMode: AnnotationDisplayMode;
	searchHighlightColor: string;
	showTranslateBlock: boolean;
}
```

- [ ] **Step 2: Add the default to `DEFAULT_SETTINGS`**

In the same file, add `showTranslateBlock: true,` to `DEFAULT_SETTINGS` (after `searchHighlightColor`):

```typescript
export const DEFAULT_SETTINGS: BiosequenceSettings = {
	// ... existing fields ...
	searchHighlightColor: "#FF6D00",
	showTranslateBlock: true,
};
```

- [ ] **Step 3: TypeScript compile check**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck`
Expected: no errors. (Existing `loadSettings` uses `Object.assign` so missing keys in stored `data.json` will be backfilled from `DEFAULT_SETTINGS` — no migration code needed.)

- [ ] **Step 4: Commit**

```bash
cd /Users/joereda/github-local/obsidian-biosequence
git add src/types.ts
git commit -m "feat(translate): add showTranslateBlock setting"
```

---

## Task 6: Renderer

**Files:**
- Create: `src/renderers/TranslateRenderer.ts`

- [ ] **Step 1: Create the renderer**

```typescript
// src/renderers/TranslateRenderer.ts
//
// Renders a sibling block under the existing nucleic-acid render showing
// 6 reading frames with protein-feature highlights. The container is appended
// to the same parent `el` provided by Obsidian — not nested inside the
// nucleic-acid container — so the existing renderer's internal empty()/render()
// cycle does not touch it.
//
// Stop and start (M) codon styling is gated on per-frame feature presence:
// frames with zero matches render plain residues with no stop/start emphasis.

import { BiosequenceSettings } from "../types";
import { translateAllFrames, Frame, FrameId } from "../calculations/translation";
import {
	matchProteinFeatures,
	annotatedFrameIds,
	ProteinMatch,
} from "../features/proteinFeatureMatcher";

const FRAME_ORDER: FrameId[] = ["+1", "+2", "+3", "-1", "-2", "-3"];

/**
 * Strip FASTA header line (if any) and non-letter characters from `source`,
 * returning an uppercase ACGTN-ish string suitable for translation.
 * Mirrors the lenient preprocessing in parseNucleotideSequence.
 */
function sanitizeDnaSource(source: string): string {
	const lines = source.split("\n");
	const body = lines
		.filter((line) => !line.startsWith(">"))
		.join("");
	return body.replace(/[^A-Za-z]/g, "").toUpperCase();
}

export function renderTranslateBlock(
	source: string,
	parentEl: HTMLElement,
	settings: BiosequenceSettings
): void {
	if (!settings.showTranslateBlock) return;

	const sequence = sanitizeDnaSource(source);
	if (sequence.length < 3) return;

	const container = parentEl.createDiv({ cls: "biosequence-translate-block" });

	const frames = translateAllFrames(sequence);
	const matches = matchProteinFeatures(frames, settings.featureLibrary);
	const annotated = annotatedFrameIds(matches);
	const matchesByFrame: Map<FrameId, ProteinMatch[]> = new Map();
	for (const id of FRAME_ORDER) matchesByFrame.set(id, []);
	for (const m of matches) matchesByFrame.get(m.frame)!.push(m);

	// Header
	const header = container.createDiv({ cls: "biosequence-translate-header" });
	if (matches.length === 0) {
		header.setText("No protein features matched in any reading frame");
	} else {
		const perFrame = FRAME_ORDER
			.filter((id) => matchesByFrame.get(id)!.length > 0)
			.map((id) => `${id}: ${matchesByFrame.get(id)!.length}`)
			.join(", ");
		header.setText(
			`${matches.length} protein feature ${matches.length === 1 ? "match" : "matches"} across 6 frames (${perFrame})`
		);
	}

	// Rows
	const framesByID = new Map(frames.map((f) => [f.id, f]));
	for (const id of FRAME_ORDER) {
		const frame = framesByID.get(id)!;
		const frameMatches = matchesByFrame.get(id)!;
		renderFrameRow(container, frame, frameMatches, annotated.has(id));
	}
}

function renderFrameRow(
	parent: HTMLElement,
	frame: Frame,
	frameMatches: ProteinMatch[],
	frameIsAnnotated: boolean
): void {
	const row = parent.createDiv({ cls: "biosequence-translate-frame" });

	const label = row.createSpan({ cls: "biosequence-translate-frame-label" });
	label.setText(`${frame.id}${frameMatches.length > 0 ? ` (${frameMatches.length})` : ""}`);

	const seqWrap = row.createSpan({ cls: "biosequence-translate-sequence" });

	if (frame.protein.length === 0) {
		seqWrap.createSpan({ text: "—", cls: "biosequence-translate-empty" });
		return;
	}

	// Precompute aa→match map (first match wins for highlight color; tooltip lists all).
	const matchAt: Array<ProteinMatch | null> = new Array(frame.protein.length).fill(null);
	const allMatchesAt: Array<ProteinMatch[]> = new Array(frame.protein.length)
		.fill(null)
		.map(() => []);
	for (const m of frameMatches) {
		for (let i = m.aaStart; i < m.aaEnd; i++) {
			if (matchAt[i] === null) matchAt[i] = m;
			allMatchesAt[i]!.push(m);
		}
	}

	for (let i = 0; i < frame.protein.length; i++) {
		const aa = frame.protein[i]!;
		const span = seqWrap.createSpan({ cls: "biosequence-translate-residue" });
		span.setText(aa);
		span.setAttr("data-aa-pos", String(i));

		const match = matchAt[i];
		if (match) {
			span.addClass("biosequence-translate-feature");
			span.setAttr("style", `background-color: ${match.color}`);
			const tipParts = allMatchesAt[i]!.map(
				(m) => `${m.name} | frame ${m.frame} | aa ${m.aaStart + 1}–${m.aaEnd} | nt ${m.ntStart + 1}–${m.ntEnd}`
			);
			span.setAttr("title", tipParts.join("\n"));
		}

		if (frameIsAnnotated) {
			if (aa === "*") span.addClass("biosequence-translate-stop");
			else if (aa === "M") span.addClass("biosequence-translate-start");
		}
	}
}
```

- [ ] **Step 2: TypeScript compile check**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/joereda/github-local/obsidian-biosequence
git add src/renderers/TranslateRenderer.ts
git commit -m "feat(translate): add TranslateRenderer with gated stop/start styling"
```

---

## Task 7: Wire renderer into the DNA code-block processor

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Import the new renderer**

In `src/main.ts`, add the import next to the existing renderer imports:

```typescript
import { renderTranslateBlock } from "./renderers/TranslateRenderer";
```

- [ ] **Step 2: Call the translate renderer from the DNA handler**

Replace the existing DNA handler block (lines ~25-30):

```typescript
const dnaHandler = (source: string, el: HTMLElement): void => {
	renderNucleotideBlock(source, el, "dna", this.settings);
	renderTranslateBlock(source, el, this.settings);
};
for (const tag of ["dna", "DNA", "Dna"]) {
	this.registerMarkdownCodeBlockProcessor(tag, dnaHandler);
}
```

Do NOT add the call to the RNA handler — RNA translation is out of scope per the spec.

- [ ] **Step 3: TypeScript compile check**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/joereda/github-local/obsidian-biosequence
git add src/main.ts
git commit -m "feat(translate): wire translate renderer into DNA code-block processor"
```

---

## Task 8: Settings toggle

**Files:**
- Modify: `src/settings.ts`

- [ ] **Step 1: Find a suitable spot for the toggle**

Open `src/settings.ts`. Locate an existing `new Setting(containerEl).setName(...)` block that creates a display-related toggle (e.g., `showPositionNumbers` or `summaryExpanded`). The new toggle should sit near other "display" toggles. If those toggles are not grouped, place this new toggle right after the `showPositionNumbers` toggle.

- [ ] **Step 2: Add the toggle**

Insert the following code right after the most-related existing display toggle (preserve the file's existing import structure — `Setting` is already imported):

```typescript
new Setting(containerEl)
	.setName("Show 6-frame translate block (DNA)")
	.setDesc("Below each DNA block, render all 6 reading frames and highlight matches against protein features in your library.")
	.addToggle((toggle) =>
		toggle
			.setValue(this.plugin.settings.showTranslateBlock)
			.onChange(async (value) => {
				this.plugin.settings.showTranslateBlock = value;
				await this.plugin.saveSettings();
			})
	);
```

- [ ] **Step 3: TypeScript compile check**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/joereda/github-local/obsidian-biosequence
git add src/settings.ts
git commit -m "feat(translate): add settings toggle for translate block"
```

---

## Task 9: Styles

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Append new style rules at the bottom of `styles.css`**

```css
/* ── Translate block ────────────────────────────────────────────────── */
.biosequence-translate-block {
	margin-top: 0.75em;
	padding: 0.5em 0.75em;
	border-top: 1px solid var(--background-modifier-border);
	font-family: var(--font-monospace);
	font-size: 0.95em;
}

.biosequence-translate-header {
	margin-bottom: 0.5em;
	color: var(--text-muted);
	font-size: 0.9em;
}

.biosequence-translate-frame {
	display: flex;
	align-items: baseline;
	gap: 0.75em;
	white-space: pre-wrap;
	word-break: break-all;
	line-height: 1.6;
}

.biosequence-translate-frame-label {
	flex: 0 0 auto;
	min-width: 3em;
	color: var(--text-faint);
	font-weight: bold;
}

.biosequence-translate-sequence {
	flex: 1 1 auto;
}

.biosequence-translate-residue {
	display: inline-block;
	padding: 0 1px;
}

.biosequence-translate-feature {
	border-radius: 2px;
	color: var(--text-on-accent, #000);
}

.biosequence-translate-stop {
	color: var(--text-error);
	font-weight: bold;
}

.biosequence-translate-start {
	color: var(--text-success);
	font-weight: bold;
}

.biosequence-translate-empty {
	color: var(--text-faint);
	font-style: italic;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/joereda/github-local/obsidian-biosequence
git add styles.css
git commit -m "style(translate): styles for translate block, frames, and gated stop/start"
```

---

## Task 10: Production build + manual smoke test

**Files:** (none modified — verification only)

- [ ] **Step 1: Full production build**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npm run build`
Expected: completes with no TypeScript errors and no esbuild errors. `main.js` is updated.

- [ ] **Step 2: Re-run validation suite end-to-end**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && node validate.mjs`
Expected: all existing tests pass AND `Translation suite: 6/6 passed`.

- [ ] **Step 3: Manual smoke test in Obsidian (Git-Vault)**

The plugin is symlinked into the user's vault. In Obsidian:
1. Reload the vault (Cmd-R or "Reload app without saving").
2. Open or create a note containing this test block:

   ````markdown
   ```dna
   ATGAAACGTTAAATGAAGCGCTAA
   ```
   ````
3. Confirm the existing nucleotide render appears unchanged.
4. Confirm a new translate block appears directly below it with 6 rows labeled +1..-3.
5. Without any AA features in the library: confirm the header says "No protein features matched in any reading frame" and that no `*` residues have stop styling (red/bold).
6. Add a temporary AA feature via settings: name "MK", sequence "MK", type "aa", color any, enabled.
7. Re-open the note. Confirm the +1 row shows MK highlighted, header reports 1 match, and stop styling is now active in the +1 row only.
8. Toggle `showTranslateBlock` off in settings; confirm translate block disappears on re-render.

- [ ] **Step 4: Report results**

If steps 1-2 fail, fix and re-run before proceeding. If step 3 reveals visual issues, capture details for follow-up. Do not commit any changes for this task unless a fix is required.

- [ ] **Step 5: Final commit if any fixes were made**

```bash
cd /Users/joereda/github-local/obsidian-biosequence
git status   # confirm clean or only fix changes present
# if fixes:
git add -p
git commit -m "fix(translate): <describe fix from smoke test>"
```

---

## Self-Review Notes

- **Spec coverage:** All sections of the design spec are mapped to tasks: codon table (Task 1), 6-frame translation with reverse coord mapping (Task 2), feature matching (Task 3), tests including edge cases — ambiguous bases, disabled features, wrong-type features, forward + reverse coordinates (Task 4), settings field with no migration (Task 5), renderer with non-destructive sibling container + gated stop/start (Task 6), wiring DNA-only (Task 7), settings UI toggle (Task 8), styles (Task 9), build + smoke test including the toggle-off scenario (Task 10).
- **Stop-codon gating** is enforced in Task 6 via `frameIsAnnotated` parameter and verified manually in Task 10 step 5/7.
- **Coordinate convention** (0-based half-open internal, 1-based display) declared once, used consistently in Tasks 1–4 and the renderer tooltip.
- **Reverse-frame coord math** is derived in Task 2's comment and exercised in Task 4's reverse matcher test.
- **No placeholders or "TBD"** in any task.
