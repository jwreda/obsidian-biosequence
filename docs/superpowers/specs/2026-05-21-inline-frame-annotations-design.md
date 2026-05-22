# Inline Frame Annotations (Translate Redesign)

**Status:** Approved design, ready for implementation plan
**Date:** 2026-05-21
**Author:** brainstormed with Claude
**Supersedes:** `2026-05-21-biosequence-translate-design.md` (separate 6-frame block)

## Motivation

The first translate implementation rendered all 6 frames as a separate stacked block beneath the DNA render. In practice — tested on a real plasmid — this layout is hard to read: the protein context lives far from the DNA it describes, and every frame consumes vertical space even when empty. The user's mental model is closer to how the plugin already handles DNA features: feature ribbons drawn directly below the source nucleotides, aligned and labeled per line.

This redesign integrates translated protein-feature hits into the existing per-line render. Frame rows sit immediately below the ribbon rows for each wrapped DNA line. Only frames that actually contain feature hits render at all. Reading flow stays vertical and local: nt → DNA-feature ribbons → relevant protein frames, on every line.

## Goals

1. Render translated AA matches as labeled rows interleaved with each wrapped DNA line, with each AA cell aligned over its source codon.
2. Show only the frames that contain ≥1 protein-feature match across the sequence. Silent frames don't render.
3. Reuse the line-wrapping, position-mapping, and reflow infrastructure already used for DNA feature ribbons — no parallel layout system.
4. Preserve the existing protein-feature matching logic (already implemented in `proteinFeatureMatcher.ts`); only the rendering layer changes.
5. Drop the standalone 6-frame block entirely.

## Non-Goals

- Per-frame lane stacking when two protein features overlap on AA positions within the same frame (rare; first match wins for color, tooltip lists all).
- Configurable codon tables (still standard table only).
- RNA-block frame annotations.
- Cross-linking nt highlights from protein-feature hover.
- Codon-spans-line-break clipping (acceptable visual overflow).

## User-Visible Behavior

For each DNA code block:

1. The existing nucleotide render (sequence + DNA-feature ribbons) is unchanged.
2. **For each wrapped DNA line** (e.g., 60 nt per line by default):
   - The line wrapper now contains, in order:
     - The DNA sequence line (gutter + residues + right gutter)
     - The existing DNA-feature ribbon rows (one per overlap lane)
     - **New: a frame-annotation row for each frame that contains at least one protein-feature match anywhere in the sequence.** Rows render in fixed order `+1, +2, +3, -1, -2, -3`, but only the frames that pass the "has-match" filter appear.
3. Each frame-annotation row contains:
   - A **left label gutter** matching the nt-position gutter width (3.5em), right-aligned, reading the frame ID (`+1`, `+2`, `+3`, `-1`, `-2`, `-3`). The label uses a muted color.
   - One **AA cell per codon whose first nucleotide lies in this line's [start, end) range**. Each cell is positioned absolutely within the row, anchored to the left edge of its first source residue, with width equal to 3× the residue width (one codon's DNA span).
   - The AA glyph (single letter, including `*` for stop and `X` for ambiguous) renders centered in the cell.
4. **Feature highlight:** An AA cell whose AA position falls inside a matched protein feature gets the feature's library color as background. Hover tooltip: `<feature name> | frame ±N | aa <a>–<b> | nt <x>–<y>`.
5. **Stop / start styling:** Within visible (annotated) frames, `*` glyphs render with the stop style and `M` glyphs render with the start style. Because non-annotated frames don't render rows at all, the "gate stops on per-frame hits" rule becomes implicit — there is no need to check per-frame annotation state inside the row renderer.
6. **No header summary block.** Match-count summary is no longer rendered separately; the presence/absence of frame rows is the summary.
7. **No matches anywhere:** No frame rows render. The block looks identical to the pre-feature DNA render.
8. **Reflow:** On container resize, the existing reflow observer fully re-renders the nucleotide block (already does this today); frame rows rebuild as part of that pass. No new observer.

### Edge cases

- **Codon spans a line break:** The AA cell anchors to its first nt's residue. If the codon's last nt would fall on the next line, the cell visually extends past the right gutter of the current line. This is acceptable — it's absolutely positioned, so it doesn't disturb the flex layout of the line. The same codon does not render on the next line.
- **Lines containing no codon starts for a frame:** The frame row for that line still renders (with the label and zero cells). This keeps row alignment predictable across the block. Empty rows render at a fixed minimum height (~1.2em).
- **Multiple features in the same frame at overlapping AA positions:** First-matched feature wins for background color; tooltip lists all overlapping feature names. (No per-frame lane stacking.)
- **Feature span longer than one DNA line:** Each AA cell renders on its respective line; visual continuity comes from same color + tooltip. No connector lines drawn.
- **Frame contains only stops/`X` and zero feature hits anywhere:** Not annotated → row does not render.
- **Lowercase / FASTA headers / whitespace:** Already handled by existing `parseNucleotideSequence`. Translation operates on the sanitized sequence.
- **DNA shorter than 3 nt:** No codons in any frame → no matches → no rows.
- **Disabled features** (`enabled: false` in library): Not considered for matching.

## Architecture

### Insertion point

Inside `renderColoredSequence` (the existing per-line loop in `NucleotideRenderer.ts`), after the call to `renderLineRibbons` for a given line, call a new helper `renderFrameAnnotations(lineWrapper, lineStart, lineEnd, frames, matches, visibleFrameIds, settings)`.

To avoid recomputing frames and matches on every line, compute them once at the top of `renderColoredSequence` (or `renderNucleotideBlock`, whichever is cleaner) and thread the resulting `frames`, `matches`, and `visibleFrameIds` into the per-line loop.

### New module

**`src/renderers/FrameAnnotationRenderer.ts`**

- `renderFrameAnnotations(lineWrapper, lineStart, lineEnd, frames, matches, visibleFrameIds, settings)`:
  - If `visibleFrameIds.size === 0`, return.
  - Build a `Map<position, HTMLElement>` over the residue spans in `lineWrapper`'s `.biosequence-residues` (reusing the same `data-pos` lookup pattern as `annotationRenderer.ts`).
  - For each frame ID in fixed display order, skipping any not in `visibleFrameIds`:
    - Build a `.biosequence-frame-row` div containing two children: a `.biosequence-frame-label` span (3.5em width, right-aligned, muted, containing the frame ID) and a `.biosequence-frame-cells` div (`position: relative`, `flex: 1`).
    - For each codon in the frame whose **first forward-strand nt** falls in `[lineStart, lineEnd)`:
      - Look up that nt's residue element in the posMap.
      - Compute the cell's `left` from `residueEl.getBoundingClientRect()` relative to `.biosequence-frame-cells`.
      - Compute cell `width = 3 × residueWidth` (read from the residue's measured width, not hardcoded).
      - Build `.biosequence-frame-cell` (absolute, centered AA glyph) inside the cells container.
      - Apply feature background + tooltip if matched. Apply stop/start class if `aa === '*'` / `'M'`.
    - Append the row to `lineWrapper`.

The renderer is pure: given the same inputs, it emits the same DOM. No state, no observers of its own.

### Removed module

**`src/renderers/TranslateRenderer.ts`** — deleted. Its callers in `main.ts` are removed.

### Settings

Rename the existing `BiosequenceSettings.showTranslateBlock` to `showFrameAnnotations` (default `true`). Update the toggle label in `settings.ts` to "Show 6-frame annotations on DNA blocks". The old key, if present in `data.json`, is silently ignored — the new key defaults to `true` via the existing deep-merge load logic, so existing users get the new feature on by default.

The setting gates all frame-annotation rendering: if `false`, neither frames nor matches are computed, and no rows render.

### Styling

Add to `styles.css`:

- `.biosequence-frame-row`: `position: relative; min-height: 1.2em; display: flex; align-items: center;` — flex aligns the label gutter with the absolutely-positioned cells container.
- `.biosequence-frame-label`: `width: 3.5em; flex-shrink: 0; text-align: right; padding-right: 0.5em; color: var(--text-muted); font-size: 0.85em; font-family: var(--font-monospace);`
- `.biosequence-frame-cells`: `position: relative; flex: 1;` — the container that cells absolutely position within.
- `.biosequence-frame-cell`: `position: absolute; text-align: center; font-family: var(--font-monospace); font-size: var(--biosequence-font-size, 14px); display: flex; align-items: center; justify-content: center; border-radius: 2px;`
- `.biosequence-frame-cell-feature`: `cursor: help;`
- `.biosequence-frame-cell-stop`: `color: var(--text-error); font-weight: bold;`
- `.biosequence-frame-cell-start`: `color: var(--text-success); font-weight: bold;`

Delete the prior `.biosequence-translate-block` / `.biosequence-translate-*` rules.

## Data Flow

1. Obsidian calls the DNA processor with `source`, `el`.
2. `parseNucleotideSequence(source, "dna")` → parsed DNA (unchanged).
3. `renderNucleotideBlock(parsed, settings, el)` is called.
4. At the top of `renderColoredSequence`, if `settings.showFrameAnnotations`:
   a. `frames = translateAllFrames(parsed.sequence)`.
   b. `matches = matchProteinFeatures(frames, settings.featureLibrary)`.
   c. `visibleFrameIds = annotatedFrameIds(matches)`.
5. The per-line loop runs as today: line wrapper → line div → ribbon rows. After ribbon rows, if `visibleFrameIds.size > 0`, call `renderFrameAnnotations(lineWrapper, start, end, frames, matches, visibleFrameIds, settings)`.
6. The frame-annotation rows are siblings to the ribbon rows inside `lineWrapper`. The next iteration creates the next line wrapper.
7. Reflow: the existing observer triggers `renderColoredSequence` again with a new `residuesPerLine`. Frame rows rebuild automatically.

## Testing

Existing unit tests in `validate.mjs` for `translateAllFrames` and `matchProteinFeatures` continue to pass unchanged — those functions are untouched.

New automated checks:

1. **Visible frame computation:** Given a fixture DNA + AA feature library where exactly frames `+1` and `-2` match, assert `annotatedFrameIds(matches)` returns `{+1, -2}`.
2. **No-match short-circuit:** Given a fixture DNA with no matching features, assert `annotatedFrameIds(matches).size === 0` so the renderer can skip cleanly.

Renderer DOM-level verification stays manual (Obsidian smoke test):

1. Reload vault; open a note with a DNA block containing a known protein-feature hit (e.g., `MK` in `+1` from `ATGAAACGTTAA...`).
2. Verify exactly one frame row (`+1`) appears under each wrapped line, with the `M` and `K` cells colored, aligned directly under their source codons.
3. Resize the editor pane to force reflow; verify cells re-align without drift.
4. Toggle `showFrameAnnotations` off in settings → frame rows disappear entirely; DNA render is unchanged.
5. Remove the AA feature from the library; reload → no frame rows render.

## Open Questions Resolved

- **Frames-only-with-hits** (vs. always all 6) — only-with-hits.
- **Inline per-line rendering** (vs. separate block) — inline.
- **Per-frame lane stacking on overlapping AA features** — not in v2; first match wins.
- **Codons spanning line breaks** — anchor to first-nt line; allow visual extension.
- **Settings key migration** — rename to `showFrameAnnotations`; old key silently dropped.

## Out of Scope / Follow-ups

- Per-frame lane stacking for overlapping AA-feature matches.
- Visual connector when an AA cell of a feature wraps across lines.
- Hover-on-AA highlights the corresponding nt range in the DNA line above.
- Configurable codon tables and RNA-block frame annotations (still deferred from v1).
