# Inline Frame Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone 6-frame translate block with per-line, per-frame annotation rows interleaved into the existing nucleotide render, so protein-feature matches sit directly under their source codons in the wrapped DNA sequence.

**Architecture:** Delete `src/renderers/TranslateRenderer.ts` (the separate block) and its CSS. Add `src/renderers/FrameAnnotationRenderer.ts` whose single function appends per-frame rows to a line wrapper, with each AA cell absolutely positioned over its codon via the same `data-pos` posMap pattern that `annotationRenderer.ts` uses for ribbons. Compute frames/matches once per render inside `renderNucleotideBlock` (only for DNA blocks with the new `showFrameAnnotations` setting on) and thread them into the per-line loop. Reuse existing reflow — full re-render rebuilds frame rows automatically.

**Tech Stack:** TypeScript, Obsidian plugin API, esbuild + tsc, Node-based validate.mjs harness.

**Reference spec:** `docs/superpowers/specs/2026-05-21-inline-frame-annotations-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Modify | Rename `showTranslateBlock` → `showFrameAnnotations` in interface + DEFAULT_SETTINGS |
| `src/settings.ts` | Modify | Replace the "Show 6-frame translate block" toggle with "Show 6-frame annotations on DNA blocks" |
| `src/main.ts` | Modify | Remove the `renderTranslateBlock` import and call from the DNA handler |
| `src/renderers/TranslateRenderer.ts` | Delete | No longer needed (standalone block removed) |
| `src/renderers/FrameAnnotationRenderer.ts` | Create | Pure DOM function: append frame rows to a line wrapper for the line's nt range |
| `src/renderers/NucleotideRenderer.ts` | Modify | Precompute frames/matches/visibleFrameIds (DNA only); pass to `renderColoredSequence`; call `renderFrameAnnotations` after `renderLineRibbons` in the per-line loop |
| `styles.css` | Modify | Add `.biosequence-frame-*` rules; delete `.biosequence-translate-*` rules |
| `validate.mjs` | Modify | Add `annotatedFrameIds` unit tests (visible-frame computation and no-match short-circuit) |
| `src/calculations/translation.ts` | Unchanged | Reused as-is |
| `src/features/proteinFeatureMatcher.ts` | Unchanged | Reused as-is |

---

## Task 1: Add `annotatedFrameIds` tests to validate.mjs

**Why first:** The renderer's gating on visible frames depends on `annotatedFrameIds`. Locking in its behavior with tests gives a safety net before any UI work.

**Files:**
- Modify: `validate.mjs:543-586` (translation test block)

- [ ] **Step 1: Open `validate.mjs` and locate the inline `matchProteinFeatures` stub**

It lives around line 500–541 (the test harness inlines a copy of the matcher so it can run standalone with Node). Right above the `testMatcherForward` function (line 543), add a small inline copy of `annotatedFrameIds`:

```javascript
function annotatedFrameIds(matches) {
	const set = new Set();
	for (const m of matches) set.add(m.frame);
	return set;
}
```

- [ ] **Step 2: Add two new tests just after `testAmbiguousBases` (around line 586)**

```javascript
function testAnnotatedFrameIdsSomeMatches() {
	// ATGAAACGTTAA: +1 has MKR*; rc TTAACGTTTCAT → -1 has LTFH.
	// "MK" matches +1; "LT" matches -1; "ZZ" matches neither.
	const dna = "ATGAAACGTTAA";
	const features = [
		{ id: "a", name: "MK", sequence: "MK", type: "aa", color: "#fff", enabled: true },
		{ id: "b", name: "LT", sequence: "LT", type: "aa", color: "#fff", enabled: true },
		{ id: "c", name: "ZZ", sequence: "ZZ", type: "aa", color: "#fff", enabled: true },
	];
	const ms = matchProteinFeatures(translateAllFrames(dna), features);
	const visible = annotatedFrameIds(ms);
	const ok = visible.size === 2 && visible.has("+1") && visible.has("-1");
	console.log(`annotatedFrameIds picks only matched frames: ${ok ? "pass" : "FAIL"}`, Array.from(visible));
	return ok;
}

function testAnnotatedFrameIdsNoMatches() {
	const dna = "ATGAAACGTTAA";
	const features = [
		{ id: "z", name: "ZZ", sequence: "ZZ", type: "aa", color: "#fff", enabled: true },
	];
	const ms = matchProteinFeatures(translateAllFrames(dna), features);
	const visible = annotatedFrameIds(ms);
	const ok = visible.size === 0;
	console.log(`annotatedFrameIds empty when no matches: ${ok ? "pass" : "FAIL"}`, Array.from(visible));
	return ok;
}
```

- [ ] **Step 3: Wire both into the translation suite results array**

Find the `trResults` array around line 596 and extend it:

```javascript
const trResults = [
	testCodonTable(),
	test6Frames(),
	testMatcherForward(),
	testMatcherReverse(),
	testMatcherDisabledAndWrongType(),
	testAmbiguousBases(),
	testAnnotatedFrameIdsSomeMatches(),
	testAnnotatedFrameIdsNoMatches(),
];
```

- [ ] **Step 4: Run the suite to confirm 24/24 + 8/8 passing**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && node validate.mjs 2>&1 | tail -15`

Expected: `Translation suite: 8/8 passed` and the existing `RESULTS: 22/22 tests passed` line above it.

- [ ] **Step 5: Commit**

```bash
git add validate.mjs
git commit -m "test: add annotatedFrameIds visibility tests"
```

---

## Task 2: Rename setting `showTranslateBlock` → `showFrameAnnotations`

**Files:**
- Modify: `src/types.ts:127` (interface) and `src/types.ts:202` (DEFAULT_SETTINGS)
- Modify: `src/settings.ts:182-192` (toggle UI)

- [ ] **Step 1: Update the interface field name in `src/types.ts`**

In the `BiosequenceSettings` interface, change:

```typescript
	showTranslateBlock: boolean;
```

to:

```typescript
	showFrameAnnotations: boolean;
```

- [ ] **Step 2: Update the DEFAULT_SETTINGS literal in `src/types.ts`**

Change:

```typescript
	showTranslateBlock: true,
```

to:

```typescript
	showFrameAnnotations: true,
```

- [ ] **Step 3: Update the toggle in `src/settings.ts:182-192`**

Replace the entire `new Setting(containerEl)` block currently named "Show 6-frame translate block (DNA)" with:

```typescript
		new Setting(containerEl)
			.setName("Show 6-frame annotations on DNA blocks")
			.setDesc("Interleave per-frame protein rows directly beneath each wrapped DNA line. Only frames containing at least one matched protein feature are shown.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showFrameAnnotations)
					.onChange(async (value) => {
						this.plugin.settings.showFrameAnnotations = value;
						await this.plugin.saveSettings();
					})
			);
```

- [ ] **Step 4: Type-check to catch any remaining `showTranslateBlock` references**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck 2>&1 | tail -20`

Expected: errors flagging the remaining `showTranslateBlock` in `src/renderers/TranslateRenderer.ts` (will be fixed in Task 3 when the file is deleted). No other errors.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/settings.ts
git commit -m "refactor: rename showTranslateBlock to showFrameAnnotations"
```

---

## Task 3: Remove the old TranslateRenderer wiring from main.ts and delete the file

**Files:**
- Modify: `src/main.ts:7` (import) and `src/main.ts:26-29` (DNA handler)
- Delete: `src/renderers/TranslateRenderer.ts`

- [ ] **Step 1: Remove the import in `src/main.ts:7`**

Delete this line:

```typescript
import { renderTranslateBlock } from "./renderers/TranslateRenderer";
```

- [ ] **Step 2: Simplify the DNA handler in `src/main.ts:26-29`**

Change:

```typescript
		const dnaHandler = (source: string, el: HTMLElement): void => {
			renderNucleotideBlock(source, el, "dna", this.settings);
			renderTranslateBlock(source, el, this.settings);
		};
```

to:

```typescript
		const dnaHandler = (source: string, el: HTMLElement): void => {
			renderNucleotideBlock(source, el, "dna", this.settings);
		};
```

- [ ] **Step 3: Delete the standalone renderer file**

```bash
rm /Users/joereda/github-local/obsidian-biosequence/src/renderers/TranslateRenderer.ts
```

- [ ] **Step 4: Type-check should now be clean**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck 2>&1 | tail -10`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/renderers/TranslateRenderer.ts
git commit -m "refactor: remove standalone translate block renderer"
```

---

## Task 4: Remove old `.biosequence-translate-*` CSS rules

**Files:**
- Modify: `styles.css:1063-1120` (the entire translate block region)

- [ ] **Step 1: Delete the translate block CSS**

Open `styles.css`. Locate the block starting at `.biosequence-translate-block {` (around line 1063) and extending through the last `.biosequence-translate-empty` rule (around line 1120). Delete all rules in that range, including:

- `.biosequence-translate-block`
- `.biosequence-translate-header`
- `.biosequence-translate-frame`
- `.biosequence-translate-frame-label`
- `.biosequence-translate-sequence`
- `.biosequence-translate-residue`
- `.biosequence-translate-feature`
- `.biosequence-translate-stop`
- `.biosequence-translate-start`
- `.biosequence-translate-empty`

If there are any other `.biosequence-translate-*` selectors (e.g. theme-dark variants nearby), delete those too. Use `grep -n "biosequence-translate" styles.css` to confirm zero remain after the edit.

- [ ] **Step 2: Confirm no translate selectors remain**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && grep -n "biosequence-translate" styles.css`

Expected: no output (empty result).

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "style: remove translate block CSS"
```

---

## Task 5: Create `FrameAnnotationRenderer.ts`

**Files:**
- Create: `src/renderers/FrameAnnotationRenderer.ts`

This module exports one function: `renderFrameAnnotations`. It receives a precomputed frame context, the line's nt range, and the line wrapper. For each visible frame (in fixed display order, filtered by `visibleFrameIds`), it appends one row containing an absolutely-positioned AA cell for every codon whose first nt lies in `[lineStart, lineEnd)`.

The cell's horizontal position is measured from the `data-pos`-indexed residue spans in the line div, exactly mirroring the ribbon renderer's posMap pattern. The cell's width is `3 × residueWidth` (read from the measured residue rect, not hardcoded), which by construction is one codon's DNA span. AA cells whose AA index falls inside a `ProteinMatch.aa[Start,End)` get the match's color as background and a multi-line tooltip listing every overlapping match.

`*` and `M` glyphs receive distinct styling (stop / start). Because frames with zero matches are filtered out before this function runs, that gating is implicit — every visible frame is annotated by definition.

- [ ] **Step 1: Create the file with full content**

```typescript
// src/renderers/FrameAnnotationRenderer.ts
//
// Per-line, per-frame protein annotation rows. Appended to each
// .biosequence-line-wrapper after the ribbon rows, this renderer draws one
// labeled row per visible frame (frames with >=1 protein-feature match) and
// places an AA cell over every codon whose first nucleotide lies in the
// line's [lineStart, lineEnd) range.
//
// AA cells are absolutely positioned, anchored to the residue span for the
// codon's first nt via the data-pos posMap pattern used by annotationRenderer.

import { BiosequenceSettings } from "../types";
import { Frame, FrameId } from "../calculations/translation";
import { ProteinMatch } from "../features/proteinFeatureMatcher";

export const FRAME_ORDER: FrameId[] = ["+1", "+2", "+3", "-1", "-2", "-3"];

export interface FrameAnnotationContext {
	frames: Frame[];
	matches: ProteinMatch[];
	visibleFrameIds: Set<FrameId>;
}

interface AaIndexEntry {
	aa: string;
	aaIndex: number;
}

/**
 * Append per-frame annotation rows to lineWrapper for the line spanning
 * forward-strand nt positions [lineStart, lineEnd).
 *
 * Preconditions:
 *  - lineWrapper already contains a .biosequence-line with .biosequence-residue
 *    spans bearing data-pos attributes for the line's nt range.
 *  - ctx.visibleFrameIds is non-empty (caller short-circuits the empty case).
 */
export function renderFrameAnnotations(
	lineWrapper: HTMLElement,
	lineDiv: HTMLElement,
	lineStart: number,
	lineEnd: number,
	ctx: FrameAnnotationContext,
	settings: BiosequenceSettings
): void {
	if (ctx.visibleFrameIds.size === 0) return;

	// Build posMap for this line's residue spans.
	const residueEls = lineDiv.querySelectorAll<HTMLElement>(
		".biosequence-residue[data-pos]"
	);
	const posMap = new Map<number, HTMLElement>();
	for (const el of Array.from(residueEls)) {
		const pos = parseInt(el.dataset["pos"] ?? "-1", 10);
		if (pos >= 0) posMap.set(pos, el);
	}
	if (posMap.size === 0) return;

	// Reference origin for the absolute-positioned cells: the
	// .biosequence-frame-cells container we'll create per row. Cells container
	// shares left edge with .biosequence-residues (both are flex children to
	// the right of the gutter), but we compute relative to the cells container
	// itself so it composes cleanly under any future layout change.

	const framesByID = new Map(ctx.frames.map((f) => [f.id, f]));
	const matchesByFrame = new Map<FrameId, ProteinMatch[]>();
	for (const id of FRAME_ORDER) matchesByFrame.set(id, []);
	for (const m of ctx.matches) matchesByFrame.get(m.frame)!.push(m);

	for (const frameId of FRAME_ORDER) {
		if (!ctx.visibleFrameIds.has(frameId)) continue;

		const frame = framesByID.get(frameId);
		if (!frame) continue;
		const frameMatches = matchesByFrame.get(frameId)!;

		// Find codons whose first nt falls on this line.
		const codonsOnLine: AaIndexEntry[] = [];
		for (let i = 0; i < frame.protein.length; i++) {
			const ntStart = frame.codonStartsForward[i]!;
			if (ntStart >= lineStart && ntStart < lineEnd) {
				codonsOnLine.push({ aa: frame.protein[i]!, aaIndex: i });
			}
		}

		// Always render the row for visible frames (even if no codons land here),
		// so frame ordering / label column stays stable line-to-line.
		const row = document.createElement("div");
		row.className = "biosequence-frame-row";

		// Mirror the DNA line's gutter presence so the cells container starts
		// at the same x-offset as `.biosequence-residues`. When position
		// numbers are off, the DNA line has no gutter, so we omit the frame
		// label too and surface the frame ID via the row's title attribute.
		if (settings.showPositionNumbers) {
			const label = document.createElement("span");
			label.className = "biosequence-frame-label";
			label.textContent = frameId;
			row.appendChild(label);
		}
		row.title = `Frame ${frameId}`;

		const cells = document.createElement("div");
		cells.className = "biosequence-frame-cells";
		row.appendChild(cells);

		// Append the row now so getBoundingClientRect for `cells` is meaningful.
		lineWrapper.appendChild(row);

		if (codonsOnLine.length === 0) {
			continue;
		}

		const cellsRect = cells.getBoundingClientRect();

		// Precompute aa→match lookup for this frame, restricted to this line.
		const matchAt = new Map<number, ProteinMatch>(); // first match wins
		const allAt = new Map<number, ProteinMatch[]>();
		for (const m of frameMatches) {
			for (let i = m.aaStart; i < m.aaEnd; i++) {
				if (!matchAt.has(i)) matchAt.set(i, m);
				if (!allAt.has(i)) allAt.set(i, []);
				allAt.get(i)!.push(m);
			}
		}

		for (const codon of codonsOnLine) {
			const ntStart = frame.codonStartsForward[codon.aaIndex]!;
			const anchorEl = posMap.get(ntStart);
			if (!anchorEl) continue;

			const anchorRect = anchorEl.getBoundingClientRect();
			const residueWidth = anchorRect.width;

			const cell = document.createElement("div");
			cell.className = "biosequence-frame-cell";
			cell.textContent = codon.aa;
			cell.style.left = `${anchorRect.left - cellsRect.left}px`;
			cell.style.width = `${residueWidth * 3}px`;

			const match = matchAt.get(codon.aaIndex);
			if (match) {
				cell.classList.add("biosequence-frame-cell-feature");
				cell.style.backgroundColor = match.color;
				const all = allAt.get(codon.aaIndex)!;
				const tip = all
					.map(
						(m) =>
							`${m.name} | frame ${m.frame} | aa ${m.aaStart + 1}–${m.aaEnd} | nt ${m.ntStart + 1}–${m.ntEnd}`
					)
					.join("\n");
				cell.title = tip;
			} else {
				cell.title = `${codon.aa} (frame ${frameId}, aa ${codon.aaIndex + 1}, nt ${ntStart + 1}–${ntStart + 3})`;
			}

			if (codon.aa === "*") cell.classList.add("biosequence-frame-cell-stop");
			else if (codon.aa === "M") cell.classList.add("biosequence-frame-cell-start");

			cells.appendChild(cell);
		}
	}

	lineWrapper.classList.add("has-frame-annotations");
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck 2>&1 | tail -10`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderers/FrameAnnotationRenderer.ts
git commit -m "feat: add FrameAnnotationRenderer for per-line protein rows"
```

---

## Task 6: Add `.biosequence-frame-*` CSS rules

**Files:**
- Modify: `styles.css` — append new rules at the end of the file

- [ ] **Step 1: Append the new CSS at the end of `styles.css`**

Append exactly this block:

```css
/* ── Inline frame annotations ───────────────────────────────────────── */

.biosequence-line-wrapper.has-frame-annotations {
	margin-bottom: 0.4em;
}

.biosequence-frame-row {
	display: flex;
	align-items: center;
	min-height: 1.2em;
	margin-top: 1px;
}

.biosequence-frame-label {
	width: 3.5em;
	flex-shrink: 0;
	text-align: right;
	padding-right: 0.5em;
	color: var(--text-muted);
	font-size: 0.85em;
	font-family: var(--font-monospace);
	box-sizing: content-box;
}

.biosequence-frame-cells {
	position: relative;
	flex: 1;
	min-height: 1.2em;
}

.biosequence-frame-cell {
	position: absolute;
	top: 0;
	height: 1.2em;
	display: flex;
	align-items: center;
	justify-content: center;
	font-family: var(--font-monospace);
	font-size: 0.85em;
	line-height: 1;
	border-radius: 2px;
	box-sizing: border-box;
	color: var(--text-normal);
	pointer-events: auto;
}

.biosequence-frame-cell-feature {
	cursor: help;
	color: #000;
	font-weight: 600;
}

.biosequence-frame-cell-stop {
	color: var(--text-error);
	font-weight: bold;
}

.biosequence-frame-cell-start {
	color: var(--text-success);
	font-weight: bold;
}

.biosequence-frame-cell-feature.biosequence-frame-cell-stop,
.biosequence-frame-cell-feature.biosequence-frame-cell-start {
	/* When a stop/start lands inside a matched feature, keep the feature
	   background but preserve the stop/start glyph color. */
	color: #000;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "style: add inline frame-annotation CSS"
```

---

## Task 7: Wire `renderFrameAnnotations` into `NucleotideRenderer`

**Files:**
- Modify: `src/renderers/NucleotideRenderer.ts`

The wiring has three pieces:
1. Compute `FrameAnnotationContext` once per render inside `renderNucleotideBlock` (only for `type === "dna"` and when `settings.showFrameAnnotations` is true), and thread it into `renderColoredSequence`.
2. Extend `renderColoredSequence`'s signature with a new optional `frameContext` parameter.
3. After the existing `renderLineRibbons` call inside the per-line loop, call `renderFrameAnnotations` if a context was provided.

- [ ] **Step 1: Add the new imports at the top of `src/renderers/NucleotideRenderer.ts`**

Just below the existing `import { applySearchHighlight } from "./searchHighlight";` line (currently `src/renderers/NucleotideRenderer.ts:33`), add:

```typescript
import { translateAllFrames } from "../calculations/translation";
import { matchProteinFeatures, annotatedFrameIds } from "../features/proteinFeatureMatcher";
import {
	renderFrameAnnotations,
	FrameAnnotationContext,
} from "./FrameAnnotationRenderer";
```

- [ ] **Step 2: Extend `renderColoredSequence`'s signature**

Replace the function declaration (currently `src/renderers/NucleotideRenderer.ts:249-259`) with this version. Only the parameter list changes — body changes come in Step 3.

```typescript
function renderColoredSequence(
	seqDiv: HTMLElement,
	sequence: string,
	scheme: ColorScheme,
	settings: BiosequenceSettings,
	invalidPositions: number[],
	residuesPerLine: number,
	allSegments: AnnotatedSegment[],
	displayMode: AnnotationDisplayMode,
	selectRange: (start: number, end: number) => void,
	frameContext: FrameAnnotationContext | null
): void {
```

- [ ] **Step 3: Call `renderFrameAnnotations` after the ribbon call**

Inside the per-line `for (let lineIdx = ...)` loop, the existing block (currently `src/renderers/NucleotideRenderer.ts:323-336`) reads:

```typescript
		// Render ribbon annotations for this line
		if (allSegments.length > 0 && displayMode === "ribbons") {
			renderLineRibbons(
				lineWrapper,
				lineDiv,
				seqDiv,
				allSegments,
				start,
				end,
				settings.showPositionNumbers,
				settings.sequenceFontSize,
				selectRange
			);
		}
```

Immediately after the closing brace of that `if` (and before the loop's own closing brace at line 337), insert:

```typescript
		// Render protein-feature frame rows for this line (DNA only, gated).
		if (frameContext && frameContext.visibleFrameIds.size > 0) {
			renderFrameAnnotations(
				lineWrapper,
				lineDiv,
				start,
				end,
				frameContext,
				settings
			);
		}
```

- [ ] **Step 4: Compute the frame context and pass it through in `renderNucleotideBlock`**

Inside the inner `render()` function (defined at `src/renderers/NucleotideRenderer.ts:445`), locate the existing `featureMatches` / `allSegments` lines (currently `src/renderers/NucleotideRenderer.ts:447-448`):

```typescript
		// Match library features and merge with inline/range segments
		const featureMatches = matchFeatures(parsed.sequence, settings.featureLibrary, type);
		const allSegments = mergeSegments(parsed.segments, featureMatches);
```

Add immediately after them:

```typescript
		// Compute frame-annotation context (DNA only, gated by setting).
		let frameContext: FrameAnnotationContext | null = null;
		if (type === "dna" && settings.showFrameAnnotations && parsed.sequence.length >= 3) {
			const frames = translateAllFrames(parsed.sequence);
			const matches = matchProteinFeatures(frames, settings.featureLibrary);
			const visibleFrameIds = annotatedFrameIds(matches);
			frameContext = { frames, matches, visibleFrameIds };
		}
```

Then update the existing `renderColoredSequence(...)` call (currently `src/renderers/NucleotideRenderer.ts:527-537`) to pass `frameContext` as the new final argument:

```typescript
		renderColoredSequence(
			seqDiv,
			parsed.sequence,
			scheme,
			settings,
			parsed.invalidPositions,
			residuesPerLine,
			allSegments,
			currentDisplayMode,
			selection.selectRange,
			frameContext
		);
```

- [ ] **Step 5: Type-check the whole project**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck 2>&1 | tail -10`

Expected: no errors.

- [ ] **Step 6: Production build to catch esbuild-level issues**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npm run build 2>&1 | tail -10`

Expected: build succeeds; no errors. (The build produces `main.js`, which is gitignored.)

- [ ] **Step 7: Run the unit test suite to ensure nothing pure regressed**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && node validate.mjs 2>&1 | tail -8`

Expected: `RESULTS: 22/22 tests passed`, `ALL TESTS PASSED`, `Translation suite: 8/8 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/renderers/NucleotideRenderer.ts
git commit -m "feat: interleave frame annotations into nucleotide line wrapper"
```

---

## Task 8: Final verification and hand-off

**Files:** None modified; this task verifies the integrated build.

- [ ] **Step 1: Re-run type check + build + tests in sequence to confirm a clean slate**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck && npm run build && node validate.mjs 2>&1 | tail -12`

Expected: TypeScript clean, build succeeds, `RESULTS: 22/22`, `Translation suite: 8/8 passed`.

- [ ] **Step 2: Sanity-check `git status` and the recent commit log**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && git status && echo --- && git log --oneline -10`

Expected: working tree clean (or only build artifacts that are gitignored), and the last 7 commits are the ones from Tasks 1–7.

- [ ] **Step 3: Manual smoke test in Obsidian (operator action — not automatable)**

Report this as the final hand-off step for the human:

1. Reload the Obsidian vault (Cmd-R or the "Reload without saving" command).
2. Open a test note containing a DNA code block with a known feature, e.g.:

   ````
   ```dna
   ATGAAACGTTAAATGAAGCGCTAAATGAAACGTTAAATGAAGCGCTAAATGAAACGTTAA
   ```
   ````

3. With no AA features in the library: confirm the DNA block renders normally, **no frame rows appear**.
4. Add a temporary AA feature `MK` (`type: "aa"`, `enabled: true`, any color) via the settings tab.
5. Reload the note. Confirm:
   - A `+1` frame row appears beneath each wrapped DNA line, with `MK` highlighted in the feature color.
   - The `M` cell sits visually directly above `ATG` and the `K` cell above `AAA` (codon-aligned).
   - The `*` (stop) glyph renders with the stop style; other `M` glyphs in `+1` render with the start style.
   - No `+2`, `+3`, `-1`, `-2`, `-3` rows appear (those frames have no matches).
6. Resize the Obsidian pane horizontally. Confirm AA cells re-align cleanly after reflow (no drift, no overlap with the right gutter, no missing cells at line breaks).
7. Open settings → toggle "Show 6-frame annotations on DNA blocks" off → reload the note → confirm **no frame rows render at all** and the DNA block looks identical to v0.
8. Toggle the setting back on; confirm rows reappear.

Report any visual issues or alignment drift back to the controller as a follow-up.

- [ ] **Step 4: Final note on unpushed commits**

After the above completes, this branch contains all redesign commits on local `main`. **Do not push without explicit user approval.** Report the local commit count to the user.

---

## Spec → Plan Coverage Map

| Spec requirement | Implemented in |
|---|---|
| Per-line, per-frame rows inside `.biosequence-line-wrapper` | Tasks 5, 7 |
| Only visible (annotated) frames render | Task 5 (loop guard) + Task 7 (skip when `visibleFrameIds.size === 0`) |
| AA cell width = 3 × residue width, anchored to first-nt residue | Task 5 (cell `left` + `width` computation) |
| Frame label gutter matches nt-position gutter width (3.5em) | Task 6 (`.biosequence-frame-label`) |
| Feature highlight color from library + multi-line tooltip | Task 5 (`matchAt` / `allAt`) |
| Stop/start styling implicit (only visible frames render) | Task 5 (unconditional class on `*` and `M`) |
| Codon spans line break → render on first-nt's line | Task 5 (`ntStart >= lineStart && ntStart < lineEnd`) |
| Settings rename `showTranslateBlock` → `showFrameAnnotations` | Task 2 |
| Setting gates all frame-annotation work | Task 7 (early skip in render) |
| Delete standalone block + CSS | Tasks 3, 4 |
| Reflow → full re-render rebuilds rows | Task 7 (frame context recomputed in `render()`, which the reflow observer calls) |
| `annotatedFrameIds` unit-test coverage | Task 1 |
| Manual Obsidian DOM smoke test | Task 8 |
