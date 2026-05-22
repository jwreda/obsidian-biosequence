# Frame Annotation UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add (a) feature-wide hover highlight + DNA codon highlight on cell mouseenter, (b) contrast-aware text color for matched cells, and (c) a five-mode frame display selector (`none` / `all` / `forward` / `reverse` / specific `FrameId`) exposed both as a global setting and as a per-block toolbar dropdown.

**Architecture:** A new pure helper `visibleFramesForMode(mode, matches): Set<FrameId>` in `src/features/proteinFeatureMatcher.ts` encapsulates mode → visible-frames mapping. `src/renderers/annotationRenderer.ts` exports its existing `highlightResidues` / `clearHighlights` helpers so `FrameAnnotationRenderer` can reuse them in hover handlers. `FrameAnnotationRenderer` tags each matched cell with `data-match-key`, sets per-cell contrast color via the existing `autoContrast` helper, and attaches mouseenter/mouseleave listeners. `NucleotideRenderer` adds a toolbar `<select>` and a `currentFrameMode` closure variable mirroring the existing scheme / display-mode pattern. The setting rename comes with a one-time silent migration in `main.ts`.

**Tech Stack:** TypeScript, Obsidian plugin API, esbuild + tsc, Node-based `validate.mjs`.

**Reference spec:** `docs/superpowers/specs/2026-05-21-frame-annotation-ux-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/features/proteinFeatureMatcher.ts` | Modify | Add `FrameAnnotationMode` type + `visibleFramesForMode` helper |
| `src/renderers/annotationRenderer.ts` | Modify | Export existing `highlightResidues` + `clearHighlights` |
| `src/types.ts` | Modify | Replace `showFrameAnnotations: boolean` with `frameAnnotationMode: FrameAnnotationMode` |
| `src/main.ts` | Modify | Add one-time migration `showFrameAnnotations` → `frameAnnotationMode` in `loadSettings` |
| `src/settings.ts` | Modify | Replace the existing toggle with a dropdown |
| `styles.css` | Modify | Drop hardcoded `color: #000`; add `.biosequence-frame-cell-hover` rule |
| `src/renderers/FrameAnnotationRenderer.ts` | Modify | Add `seqDiv` parameter, `data-match-key`, contrast color, hover handlers |
| `src/renderers/NucleotideRenderer.ts` | Modify | Add toolbar dropdown, `currentFrameMode` closure, mode-aware gate, pass `seqDiv` through |
| `validate.mjs` | Modify | Add 5 unit tests for `visibleFramesForMode` |

---

## Task 1: `FrameAnnotationMode` type + `visibleFramesForMode` helper + tests

**Files:**
- Modify: `src/features/proteinFeatureMatcher.ts` (append at end)
- Modify: `validate.mjs` (translation test suite)

- [ ] **Step 1: Append type and helper to `src/features/proteinFeatureMatcher.ts`**

Open `src/features/proteinFeatureMatcher.ts`. After the existing `annotatedFrameIds` function (the file currently ends around line 89), append:

```typescript

/** Display mode for inline frame annotations. */
export type FrameAnnotationMode =
	| "none"
	| "all"
	| "forward"
	| "reverse"
	| FrameId;

const FORWARD_FRAMES: FrameId[] = ["+1", "+2", "+3"];
const REVERSE_FRAMES: FrameId[] = ["-1", "-2", "-3"];

/**
 * Resolve which frame IDs should render under a given display mode.
 *
 *  - "none": always empty.
 *  - "all": every frame in {+1..-3} that has at least one match.
 *  - "forward": forward frames that have at least one match.
 *  - "reverse": reverse frames that have at least one match.
 *  - Specific FrameId: that single frame, regardless of match presence
 *    (ORF-inspection mode).
 */
export function visibleFramesForMode(
	mode: FrameAnnotationMode,
	matches: ProteinMatch[]
): Set<FrameId> {
	if (mode === "none") return new Set();
	if (mode === "all") return annotatedFrameIds(matches);
	if (mode === "forward") {
		const annotated = annotatedFrameIds(matches);
		return new Set(FORWARD_FRAMES.filter((id) => annotated.has(id)));
	}
	if (mode === "reverse") {
		const annotated = annotatedFrameIds(matches);
		return new Set(REVERSE_FRAMES.filter((id) => annotated.has(id)));
	}
	// Specific frame: always rendered, no match filter.
	return new Set([mode]);
}
```

- [ ] **Step 2: Add an inline copy of the helper to `validate.mjs` so Node tests can run it standalone**

Open `validate.mjs`. Locate the inline `annotatedFrameIds` function added in the prior task (it should be just above `testMatcherForward`, around line 588). Immediately after `annotatedFrameIds`, append:

```javascript
const FORWARD_FRAMES = ["+1", "+2", "+3"];
const REVERSE_FRAMES = ["-1", "-2", "-3"];

function visibleFramesForMode(mode, matches) {
	if (mode === "none") return new Set();
	if (mode === "all") return annotatedFrameIds(matches);
	if (mode === "forward") {
		const annotated = annotatedFrameIds(matches);
		return new Set(FORWARD_FRAMES.filter((id) => annotated.has(id)));
	}
	if (mode === "reverse") {
		const annotated = annotatedFrameIds(matches);
		return new Set(REVERSE_FRAMES.filter((id) => annotated.has(id)));
	}
	return new Set([mode]);
}
```

- [ ] **Step 3: Add 5 new tests just after `testAnnotatedFrameIdsNoMatches`**

Locate `testAnnotatedFrameIdsNoMatches` (it's the most recently added test). Immediately after its closing brace, append:

```javascript
function testVisibleFramesNone() {
	const dna = "ATGAAACGTTAA";
	const features = [{ id: "a", name: "MK", sequence: "MK", type: "aa", color: "#fff", enabled: true }];
	const ms = matchProteinFeatures(translateAllFrames(dna), features);
	const v = visibleFramesForMode("none", ms);
	const ok = v.size === 0;
	console.log(`visibleFramesForMode none: ${ok ? "pass" : "FAIL"}`, Array.from(v));
	return ok;
}

function testVisibleFramesAll() {
	const dna = "ATGAAACGTTAA";
	const features = [
		{ id: "a", name: "MK", sequence: "MK", type: "aa", color: "#fff", enabled: true },
		{ id: "b", name: "LT", sequence: "LT", type: "aa", color: "#fff", enabled: true },
	];
	const ms = matchProteinFeatures(translateAllFrames(dna), features);
	const v = visibleFramesForMode("all", ms);
	const ok = v.size === 2 && v.has("+1") && v.has("-1");
	console.log(`visibleFramesForMode all: ${ok ? "pass" : "FAIL"}`, Array.from(v));
	return ok;
}

function testVisibleFramesForward() {
	const dna = "ATGAAACGTTAA";
	const features = [
		{ id: "a", name: "MK", sequence: "MK", type: "aa", color: "#fff", enabled: true },
		{ id: "b", name: "LT", sequence: "LT", type: "aa", color: "#fff", enabled: true },
	];
	const ms = matchProteinFeatures(translateAllFrames(dna), features);
	const v = visibleFramesForMode("forward", ms);
	const ok = v.size === 1 && v.has("+1");
	console.log(`visibleFramesForMode forward: ${ok ? "pass" : "FAIL"}`, Array.from(v));
	return ok;
}

function testVisibleFramesReverse() {
	const dna = "ATGAAACGTTAA";
	const features = [
		{ id: "a", name: "MK", sequence: "MK", type: "aa", color: "#fff", enabled: true },
		{ id: "b", name: "LT", sequence: "LT", type: "aa", color: "#fff", enabled: true },
	];
	const ms = matchProteinFeatures(translateAllFrames(dna), features);
	const v = visibleFramesForMode("reverse", ms);
	const ok = v.size === 1 && v.has("-1");
	console.log(`visibleFramesForMode reverse: ${ok ? "pass" : "FAIL"}`, Array.from(v));
	return ok;
}

function testVisibleFramesSpecificNoMatches() {
	// Specific-frame mode must render the chosen frame even with zero matches.
	const ms = []; // empty matches
	const v = visibleFramesForMode("+2", ms);
	const ok = v.size === 1 && v.has("+2");
	console.log(`visibleFramesForMode +2 (no matches): ${ok ? "pass" : "FAIL"}`, Array.from(v));
	return ok;
}
```

- [ ] **Step 4: Wire the new tests into the `trResults` array**

Locate the `trResults` array (around line 626 after the prior task's additions). Add 5 entries:

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
	testVisibleFramesNone(),
	testVisibleFramesAll(),
	testVisibleFramesForward(),
	testVisibleFramesReverse(),
	testVisibleFramesSpecificNoMatches(),
];
```

- [ ] **Step 5: Run the suite**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && node validate.mjs 2>&1 | tail -8`

Expected: `Translation suite: 13/13 passed`. (The legacy `RESULTS: 22/22 tests passed` line should also remain green.)

- [ ] **Step 6: Type-check**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck 2>&1 | tail -5`

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/proteinFeatureMatcher.ts validate.mjs
git commit -m "feat: add visibleFramesForMode helper for mode-based frame filtering"
```

---

## Task 2: Export `highlightResidues` and `clearHighlights` from `annotationRenderer.ts`

**Files:**
- Modify: `src/renderers/annotationRenderer.ts:33` and `:44` (add `export` keyword)

- [ ] **Step 1: Add `export` to both helper declarations**

Open `src/renderers/annotationRenderer.ts`. Change line 33:

```typescript
function highlightResidues(containerDiv: HTMLElement, start: number, end: number, color: string): void {
```

to:

```typescript
export function highlightResidues(containerDiv: HTMLElement, start: number, end: number, color: string): void {
```

Change line 44:

```typescript
function clearHighlights(containerDiv: HTMLElement): void {
```

to:

```typescript
export function clearHighlights(containerDiv: HTMLElement): void {
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck 2>&1 | tail -5`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderers/annotationRenderer.ts
git commit -m "refactor: export highlightResidues + clearHighlights for cross-renderer reuse"
```

---

## Task 3: Settings rename `showFrameAnnotations` → `frameAnnotationMode` + migration

**Files:**
- Modify: `src/types.ts:127` (interface field) and `src/types.ts:202` (default)
- Modify: `src/main.ts:121-143` (loadSettings adds migration)
- Modify: `src/settings.ts:182-192` (toggle → dropdown)

- [ ] **Step 1: Import `FrameAnnotationMode` and rename field in `src/types.ts`**

Open `src/types.ts`. Add this import at the top of the file (after the file's existing top-of-file comments, before any other top-level statement):

```typescript
import type { FrameAnnotationMode } from "./features/proteinFeatureMatcher";
```

If the file has no other imports, place this as the first line. Re-export the type from `src/types.ts` so consumers of `types.ts` can pick it up without reaching into the matcher:

```typescript
export type { FrameAnnotationMode } from "./features/proteinFeatureMatcher";
```

Now replace the existing line `showTranslateBlock: boolean;` — actually, by this point in the project the field is named `showFrameAnnotations: boolean;` (renamed in the prior plan). Replace:

```typescript
	showFrameAnnotations: boolean;
```

with:

```typescript
	frameAnnotationMode: FrameAnnotationMode;
```

And in `DEFAULT_SETTINGS` (around line 202), replace:

```typescript
	showFrameAnnotations: true,
```

with:

```typescript
	frameAnnotationMode: "all",
```

- [ ] **Step 2: Add migration to `src/main.ts` `loadSettings`**

Open `src/main.ts`. Locate `async loadSettings(): Promise<void> { ... }` (currently starts around line 121). Replace the entire method body with:

```typescript
	async loadSettings(): Promise<void> {
		const saved = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
		// Deep-merge nested objects to handle partial saves
		this.settings.conservationSymbols = Object.assign(
			{},
			DEFAULT_SETTINGS.conservationSymbols,
			saved?.conservationSymbols
		);
		// Ensure featureLibrary entries have all required fields
		if (Array.isArray(saved?.featureLibrary)) {
			this.settings.featureLibrary = saved.featureLibrary.map(
				(entry: Partial<FeatureEntry>) => ({
					id: entry.id ?? crypto.randomUUID(),
					name: entry.name ?? "Unnamed",
					sequence: entry.sequence ?? "",
					type: entry.type ?? "aa",
					color: entry.color ?? "#7eb8da",
					enabled: entry.enabled ?? true,
				})
			);
		}
		// One-time migration: showFrameAnnotations (boolean) → frameAnnotationMode
		// True maps to the "all" mode; false maps to "none". Drop the old key.
		if (saved && Object.prototype.hasOwnProperty.call(saved, "showFrameAnnotations")
			&& !(saved as any).frameAnnotationMode) {
			this.settings.frameAnnotationMode = (saved as any).showFrameAnnotations
				? "all"
				: "none";
			await this.saveSettings();
		}
	}
```

- [ ] **Step 3: Replace the toggle with a dropdown in `src/settings.ts`**

Open `src/settings.ts`. Replace the entire existing block (around line 182):

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

with:

```typescript
		new Setting(containerEl)
			.setName("Default frame display (DNA)")
			.setDesc("Default frame-annotation mode for new DNA blocks. Per-block override is available in the block's toolbar.")
			.addDropdown((dropdown) => {
				dropdown.addOption("none", "Off");
				dropdown.addOption("all", "All 6 frames (matches only)");
				dropdown.addOption("forward", "Forward frames (matches only)");
				dropdown.addOption("reverse", "Reverse frames (matches only)");
				dropdown.addOption("+1", "Frame +1");
				dropdown.addOption("+2", "Frame +2");
				dropdown.addOption("+3", "Frame +3");
				dropdown.addOption("-1", "Frame -1");
				dropdown.addOption("-2", "Frame -2");
				dropdown.addOption("-3", "Frame -3");
				dropdown
					.setValue(this.plugin.settings.frameAnnotationMode)
					.onChange(async (value) => {
						this.plugin.settings.frameAnnotationMode =
							value as typeof this.plugin.settings.frameAnnotationMode;
						await this.plugin.saveSettings();
					});
			});
```

- [ ] **Step 4: Type-check (expect downstream renderer errors that Tasks 5–6 will fix)**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck 2>&1 | tail -20`

Expected: errors only in `src/renderers/NucleotideRenderer.ts` complaining about `settings.showFrameAnnotations`. That's expected — Task 6 fixes the renderer. No other errors should appear.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/main.ts src/settings.ts
git commit -m "feat: replace showFrameAnnotations bool with FrameAnnotationMode + migration"
```

---

## Task 4: CSS — drop hardcoded text colors, add hover rule

**Files:**
- Modify: `styles.css:1108-1129` (frame-cell rules region)

- [ ] **Step 1: Replace the `.biosequence-frame-cell-feature` and combined stop/start override rules**

Open `styles.css`. Locate the block that begins at `.biosequence-frame-cell-feature {` (around line 1108). Replace:

```css
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

with:

```css
.biosequence-frame-cell-feature {
	cursor: help;
	font-weight: 600;
	/* Text color is applied inline per cell via autoContrast(match.color). */
}

.biosequence-frame-cell-stop {
	color: var(--text-error);
	font-weight: bold;
}

.biosequence-frame-cell-start {
	color: var(--text-success);
	font-weight: bold;
}

.biosequence-frame-cell-feature.biosequence-frame-cell-stop {
	/* Semantic stop color wins over the matched-feature contrast color. */
	color: var(--text-error);
}

.biosequence-frame-cell-feature.biosequence-frame-cell-start {
	/* Semantic start color wins over the matched-feature contrast color. */
	color: var(--text-success);
}

.biosequence-frame-cell-hover {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 1px;
	filter: brightness(1.1);
	z-index: 1;
}
```

The two key changes: `.biosequence-frame-cell-feature` no longer hardcodes `color`, and the combined stop/start rule now explicitly preserves the semantic color (overriding any inline contrast color the renderer sets). The new `.biosequence-frame-cell-hover` rule provides the visual link between sibling cells on hover.

- [ ] **Step 2: Sanity-check no other `color: #000` lingers in the frame-cell area**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && grep -n "biosequence-frame-cell" styles.css`

Expected: the listed rules above match. No `color: #000` in any frame-cell selector.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "style: drop hardcoded frame-cell text color; add hover rule"
```

---

## Task 5: Renderer — `data-match-key`, contrast color, hover handlers, `seqDiv` param

**Files:**
- Modify: `src/renderers/FrameAnnotationRenderer.ts`

The renderer gains a new `seqDiv` parameter (passed by `NucleotideRenderer` in Task 6) so hover handlers can highlight DNA residues via `highlightResidues(seqDiv, ...)`. Each matched cell gets a `data-match-key` attribute for cross-line querying. Stop/start cells receive only the semantic color (no inline contrast color), while plain matched cells get `cell.style.color = autoContrast(match.color)`.

- [ ] **Step 1: Update imports at the top of `src/renderers/FrameAnnotationRenderer.ts`**

Replace the existing import block (currently lines 12–14):

```typescript
import { BiosequenceSettings } from "../types";
import { Frame, FrameId } from "../calculations/translation";
import { ProteinMatch } from "../features/proteinFeatureMatcher";
```

with:

```typescript
import { BiosequenceSettings } from "../types";
import { Frame, FrameId } from "../calculations/translation";
import { ProteinMatch } from "../features/proteinFeatureMatcher";
import { autoContrast } from "../colorSchemes/aminoAcid";
import { highlightResidues, clearHighlights } from "./annotationRenderer";
```

- [ ] **Step 2: Add `seqDiv` parameter to `renderFrameAnnotations`**

Update the function signature (currently lines 38–45):

```typescript
export function renderFrameAnnotations(
	lineWrapper: HTMLElement,
	lineDiv: HTMLElement,
	lineStart: number,
	lineEnd: number,
	ctx: FrameAnnotationContext,
	settings: BiosequenceSettings
): void {
```

Replace with:

```typescript
export function renderFrameAnnotations(
	lineWrapper: HTMLElement,
	lineDiv: HTMLElement,
	seqDiv: HTMLElement,
	lineStart: number,
	lineEnd: number,
	ctx: FrameAnnotationContext,
	settings: BiosequenceSettings
): void {
```

- [ ] **Step 3: Update the matched-cell rendering block to set data-match-key, contrast color, and hover listeners**

Inside the per-codon loop, locate the existing block that decides whether the cell carries a feature (currently lines 143–157):

```typescript
			const all = allAt.get(codon.aaIndex);
			if (all && all.length > 0) {
				const match = all[0]!;
				cell.classList.add("biosequence-frame-cell-feature");
				cell.style.backgroundColor = match.color;
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
```

Replace with:

```typescript
			const all = allAt.get(codon.aaIndex);
			if (all && all.length > 0) {
				const match = all[0]!;
				cell.classList.add("biosequence-frame-cell-feature");
				cell.style.backgroundColor = match.color;
				// Contrast-aware text color for legibility on dark feature
				// backgrounds. Stop/start cells override this via CSS so the
				// semantic glyph color wins.
				cell.style.color = autoContrast(match.color);
				// Tag for cross-line hover linking. The key identifies a single
				// ProteinMatch uniquely (one feature, one frame, one occurrence).
				cell.dataset["matchKey"] = `${match.featureId}|${match.frame}|${match.aaStart}`;
				const tip = all
					.map(
						(m) =>
							`${m.name} | frame ${m.frame} | aa ${m.aaStart + 1}–${m.aaEnd} | nt ${m.ntStart + 1}–${m.ntEnd}`
					)
					.join("\n");
				cell.title = tip;

				// Hover: light up every sibling cell with the same match key
				// across all wrapped lines, and highlight the source codons on
				// the DNA strand using the existing residue highlight helper.
				cell.addEventListener("mouseenter", () => {
					const key = cell.dataset["matchKey"];
					if (!key) return;
					const siblings = seqDiv.querySelectorAll<HTMLElement>(
						`.biosequence-frame-cell[data-match-key="${CSS.escape(key)}"]`
					);
					for (const sib of Array.from(siblings)) {
						sib.classList.add("biosequence-frame-cell-hover");
					}
					highlightResidues(seqDiv, match.ntStart, match.ntEnd, match.color);
				});
				cell.addEventListener("mouseleave", () => {
					const key = cell.dataset["matchKey"];
					if (!key) return;
					const siblings = seqDiv.querySelectorAll<HTMLElement>(
						`.biosequence-frame-cell[data-match-key="${CSS.escape(key)}"]`
					);
					for (const sib of Array.from(siblings)) {
						sib.classList.remove("biosequence-frame-cell-hover");
					}
					clearHighlights(seqDiv);
				});
			} else {
				cell.title = `${codon.aa} (frame ${frameId}, aa ${codon.aaIndex + 1}, nt ${ntStart + 1}–${ntStart + 3})`;
			}
```

- [ ] **Step 4: Type-check**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck 2>&1 | tail -10`

Expected: the type error from Task 3 about `settings.showFrameAnnotations` should still be present (Task 6 fixes it). Additionally, expect a new error at the existing `renderFrameAnnotations(...)` call site in `NucleotideRenderer.ts` complaining about missing positional arg. Both will be fixed in Task 6. No errors should appear inside `FrameAnnotationRenderer.ts` itself.

- [ ] **Step 5: Commit**

```bash
git add src/renderers/FrameAnnotationRenderer.ts
git commit -m "feat: add hover linking + contrast color to frame cells"
```

---

## Task 6: Toolbar dropdown + `currentFrameMode` closure + mode-aware gate

**Files:**
- Modify: `src/renderers/NucleotideRenderer.ts`

- [ ] **Step 1: Update the imports at the top of `NucleotideRenderer.ts`**

Locate the existing block of frame-annotation imports (currently around lines 34–40):

```typescript
import { translateAllFrames } from "../calculations/translation";
import { matchProteinFeatures, annotatedFrameIds } from "../features/proteinFeatureMatcher";
import {
	renderFrameAnnotations,
	FrameAnnotationContext,
} from "./FrameAnnotationRenderer";
```

Replace with:

```typescript
import { translateAllFrames } from "../calculations/translation";
import {
	matchProteinFeatures,
	visibleFramesForMode,
	FrameAnnotationMode,
} from "../features/proteinFeatureMatcher";
import {
	renderFrameAnnotations,
	FrameAnnotationContext,
} from "./FrameAnnotationRenderer";
```

(`annotatedFrameIds` is no longer imported here; it's now only used inside `visibleFramesForMode`.)

- [ ] **Step 2: Extend `renderToolbar` signature with frame-mode parameters**

Locate the `renderToolbar` function signature (currently lines 146–155). Replace it with:

```typescript
function renderToolbar(
	container: HTMLElement,
	type: SequenceType,
	currentSchemeId: NucleotideColorSchemeId,
	sequence: string,
	onSchemeChange: (id: NucleotideColorSchemeId) => void,
	currentDisplayMode: AnnotationDisplayMode,
	onDisplayModeToggle: () => void,
	onRefresh: () => void,
	frameModeOptions: { current: FrameAnnotationMode; onChange: (mode: FrameAnnotationMode) => void } | null
): void {
```

- [ ] **Step 3: Add the frame-mode `<select>` inside `renderToolbar`**

Inside `renderToolbar`, locate the existing `// Display mode toggle` block (currently lines 207–213):

```typescript
	// Display mode toggle
	const modeBtn = toolbar.createEl("button", {
		cls: "biosequence-copy-btn",
		text: currentDisplayMode === "ribbons" ? "☰ Badges" : "☰ Ribbons",
		title: `Switch to ${currentDisplayMode === "ribbons" ? "badge" : "ribbon"} annotations`,
	});
	modeBtn.addEventListener("click", onDisplayModeToggle);
```

Immediately after that block, insert the new frame-mode select:

```typescript
	// Frame-annotation mode select (DNA only).
	if (frameModeOptions) {
		const frameSelect = toolbar.createEl("select", {
			cls: "biosequence-scheme-select biosequence-frame-mode-select",
		});
		const FRAME_MODE_OPTIONS: Array<{ value: FrameAnnotationMode; label: string }> = [
			{ value: "none", label: "Frames: off" },
			{ value: "all", label: "Frames: all 6" },
			{ value: "forward", label: "Frames: forward" },
			{ value: "reverse", label: "Frames: reverse" },
			{ value: "+1", label: "Frame: +1" },
			{ value: "+2", label: "Frame: +2" },
			{ value: "+3", label: "Frame: +3" },
			{ value: "-1", label: "Frame: -1" },
			{ value: "-2", label: "Frame: -2" },
			{ value: "-3", label: "Frame: -3" },
		];
		for (const opt of FRAME_MODE_OPTIONS) {
			const optEl = frameSelect.createEl("option", { text: opt.label, value: opt.value });
			if (opt.value === frameModeOptions.current) optEl.selected = true;
		}
		frameSelect.addEventListener("change", () => {
			frameModeOptions.onChange(frameSelect.value as FrameAnnotationMode);
		});
	}
```

- [ ] **Step 4: Add the `currentFrameMode` closure variable in `renderNucleotideBlock`**

Locate the existing closure declarations (currently around lines 459–462):

```typescript
	let currentSchemeId = defaultScheme;
	let currentDisplayMode: AnnotationDisplayMode = settings.annotationDisplayMode;
	let selectionCleanup: (() => void) | null = null;
	let searchTerm = "";
```

Replace with:

```typescript
	let currentSchemeId = defaultScheme;
	let currentDisplayMode: AnnotationDisplayMode = settings.annotationDisplayMode;
	let currentFrameMode: FrameAnnotationMode = settings.frameAnnotationMode;
	let selectionCleanup: (() => void) | null = null;
	let searchTerm = "";
```

- [ ] **Step 5: Update the frame-context computation to use the new mode**

Locate the existing block (currently lines 469–476):

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

Replace with:

```typescript
		// Compute frame-annotation context (DNA only, gated by per-block mode).
		let frameContext: FrameAnnotationContext | null = null;
		if (type === "dna" && currentFrameMode !== "none" && parsed.sequence.length >= 3) {
			const frames = translateAllFrames(parsed.sequence);
			const matches = matchProteinFeatures(frames, settings.featureLibrary);
			const visibleFrameIds = visibleFramesForMode(currentFrameMode, matches);
			frameContext = { frames, matches, visibleFrameIds };
		}
```

- [ ] **Step 6: Pass the frame-mode options into `renderToolbar`**

Locate the existing `renderToolbar(...)` call (currently lines 494–509):

```typescript
		renderToolbar(
			container,
			type,
			currentSchemeId,
			parsed.sequence,
			(newId) => {
				currentSchemeId = newId;
				render(residuesPerLine);
			},
			currentDisplayMode,
			() => {
				currentDisplayMode = currentDisplayMode === "ribbons" ? "badges" : "ribbons";
				render(residuesPerLine);
			},
			() => render(residuesPerLine)
		);
```

Replace with:

```typescript
		renderToolbar(
			container,
			type,
			currentSchemeId,
			parsed.sequence,
			(newId) => {
				currentSchemeId = newId;
				render(residuesPerLine);
			},
			currentDisplayMode,
			() => {
				currentDisplayMode = currentDisplayMode === "ribbons" ? "badges" : "ribbons";
				render(residuesPerLine);
			},
			() => render(residuesPerLine),
			type === "dna"
				? {
					current: currentFrameMode,
					onChange: (mode) => {
						currentFrameMode = mode;
						render(residuesPerLine);
					},
				}
				: null
		);
```

- [ ] **Step 7: Pass `seqDiv` into `renderFrameAnnotations` from the per-line loop**

Locate the call inside `renderColoredSequence` (currently lines 346–355):

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

Replace with:

```typescript
		// Render protein-feature frame rows for this line (DNA only, gated).
		if (frameContext && frameContext.visibleFrameIds.size > 0) {
			renderFrameAnnotations(
				lineWrapper,
				lineDiv,
				seqDiv,
				start,
				end,
				frameContext,
				settings
			);
		}
```

- [ ] **Step 8: Type-check + build + tests**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck && npm run build && node validate.mjs 2>&1 | tail -12`

Expected: TypeScript clean, build clean, `RESULTS: 22/22 tests passed`, `Translation suite: 13/13 passed`.

- [ ] **Step 9: Commit**

```bash
git add src/renderers/NucleotideRenderer.ts
git commit -m "feat: toolbar frame-mode selector with per-block override"
```

---

## Task 7: Final verification and hand-off

**Files:** None modified; integration check only.

- [ ] **Step 1: Confirm everything is clean**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && npx tsc -noEmit -skipLibCheck && npm run build && node validate.mjs 2>&1 | tail -15`

Expected: TypeScript clean, build clean, `RESULTS: 22/22 tests passed`, `Translation suite: 13/13 passed`.

- [ ] **Step 2: Verify the working tree and recent commits**

Run: `cd /Users/joereda/github-local/obsidian-biosequence && git status && echo --- && git log --oneline -10`

Expected: working tree clean, last 6 commits are from Tasks 1–6.

- [ ] **Step 3: Manual smoke test (operator)**

The following requires a running Obsidian instance and is not automatable. Report these steps to the human:

1. Reload the vault.
2. Open a note with a DNA block containing a known match (e.g. add an AA feature `MK` and a DNA block `ATGAAACGTTAAATGAAGCGCTAA`).
3. Confirm a `Frames: all 6` dropdown appears in the DNA block's toolbar, defaulted from `settings.frameAnnotationMode`.
4. Hover a matched `M` or `K` cell:
   - Every sibling cell of the same feature outlines.
   - The source codons on the DNA line(s) light up in the feature color (residue highlight).
   - The tooltip shows `name | frame ±N | aa | nt`.
   - Mouseleave clears both highlights.
5. Pick a feature with a dark background color (e.g. dark navy `#1a237e`): confirm matched cells render with light text (autoContrast applied).
6. Cycle the toolbar dropdown through all 10 options. Confirm:
   - `Frames: off` removes all rows.
   - `Frames: all 6` / `forward` / `reverse` show only frames with matches.
   - `Frame +2` shows the +2 row regardless of whether it has matches (raw translation visible).
7. Open settings → change "Default frame display (DNA)" → reload the note → confirm the new default seeds the toolbar.
8. Open the existing `data.json` (`.obsidian/plugins/biosequence/data.json`) before reloading once with the old `showFrameAnnotations: true` key, then reload: confirm `frameAnnotationMode: "all"` is written and the old key is gone.

- [ ] **Step 4: Report local commit count**

The branch is now further ahead of `origin/main`. Report the commit count to the user but do not push without explicit approval.

---

## Spec → Plan Coverage Map

| Spec requirement | Implemented in |
|---|---|
| Hover highlights sibling cells with same `ProteinMatch` | Task 5 (mouseenter handler, `data-match-key`) |
| Hover highlights source codons on DNA strand | Task 5 (`highlightResidues(seqDiv, ntStart, ntEnd, color)`) |
| Tooltip unchanged | Task 5 (existing `cell.title` retained) |
| Mouseleave clears all highlights | Task 5 (mouseleave handler) |
| Plain cells inert on hover | Task 5 (listeners only attached inside `if (all && all.length > 0)`) |
| Contrast-aware text color via `autoContrast` | Task 5 (`cell.style.color = autoContrast(match.color)`) |
| `.biosequence-frame-cell-feature` no longer hardcodes color | Task 4 |
| Stop/start semantic color wins over contrast color | Task 4 (combined selectors override to var-based color) |
| `FrameAnnotationMode` type and 5-mode behavior | Task 1 |
| Single-frame mode renders even with no matches | Task 1 (`visibleFramesForMode` returns `{mode}` directly) |
| Setting renamed `showFrameAnnotations` → `frameAnnotationMode` | Task 3 |
| Settings dropdown with 10 options | Task 3 |
| One-time silent migration from boolean | Task 3 (loadSettings hook) |
| Toolbar select with same options, per-block override | Task 6 |
| Toolbar select positioned after display-mode button | Task 6 (insertion order in `renderToolbar`) |
| Toolbar select on DNA blocks only | Task 6 (`type === "dna" ? {...} : null`) |
| `currentFrameMode` closure mirrors `currentSchemeId` pattern | Task 6 (declared alongside other `current*` vars) |
| Frame context computed only when mode != "none" | Task 6 (gate change) |
| `seqDiv` threaded to renderer for hover | Task 6 step 7 |
| `highlightResidues` / `clearHighlights` exported | Task 2 |
| `visibleFramesForMode` unit tests (5 cases) | Task 1 |
| Hover behavior verification | Task 7 manual smoke |
| Migration verification | Task 7 manual smoke |
