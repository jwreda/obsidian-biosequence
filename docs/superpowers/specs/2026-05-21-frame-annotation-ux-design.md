# Frame Annotation UX Improvements

**Status:** Approved design, ready for implementation plan
**Date:** 2026-05-21
**Author:** brainstormed with Claude
**Builds on:** `2026-05-21-inline-frame-annotations-design.md`

## Motivation

Real-plasmid testing of the inline frame annotations exposed three usability gaps:

1. **Cross-line feature recognition is hard.** A matched protein feature visually fragments across wrapped DNA lines. There is currently no way to confirm at a glance which cells belong together, and the source codons on the DNA line above aren't reinforced when the user hovers a hit.
2. **Black text on dark feature backgrounds is unreadable.** The renderer hardcodes `color: #000` for matched cells. Dark blues/purples in the feature library produce low-contrast cells.
3. **Single boolean toggle is too coarse.** Sometimes the user wants all 6 frames; sometimes they want to read just one ORF (regardless of matches); sometimes they want to silence half the strand. The current binary setting forces "all matched frames or nothing."

## Goals

1. On hover over a matched cell, visually link every other cell of the same `ProteinMatch` across wrapped lines and highlight the source codons on the DNA strand.
2. Pick legible text colors for matched cells automatically based on the feature's background color.
3. Replace the `showFrameAnnotations` boolean with a five-mode selector exposed both globally (settings) and per-block (toolbar dropdown). Modes: none / all 6 / forward only / reverse only / a single specific frame.

## Non-Goals

- Click-to-pin highlight (always release on mouseleave).
- Persisting per-block toolbar selection across reloads.
- Independent text-color customization per feature.
- Selecting multiple specific frames at once (use "all" / "forward" / "reverse" instead).
- Settings UI for mode-default beyond a single dropdown.

## User-Visible Behavior

### Hover highlight

1. Hover any cell that carries a feature background:
   - Every other cell in the same wrapped block that belongs to the same `ProteinMatch` (same `featureId + frame + aaStart`) receives an outline/glow (visually consistent with the existing ribbon hover styling).
   - The corresponding DNA nucleotide range `[match.ntStart, match.ntEnd)` gets the existing `segment-highlight` treatment using the feature's color (reuses `highlightResidues` from `src/renderers/annotationRenderer.ts`).
2. The cell's existing `title` tooltip continues to surface the multi-line `name | frame | aa | nt` text — no change to copy.
3. On mouseleave: all hover styling and DNA highlights clear. Releasing the highlight is unconditional — there is no click-to-pin.
4. Hover applies only to cells with a feature match. Plain cells (stop, start, raw AA without match) are inert on hover.

### Contrast-aware cell text color

1. When a cell is assigned a feature background color, the renderer computes the cell's text color via the existing `autoContrast(bgColor)` helper from `src/colorSchemes/aminoAcid.ts` and sets it inline.
2. `.biosequence-frame-cell-feature` no longer hardcodes `color: #000` (or any color) in CSS. The inline style wins.
3. Stop (`*`) and start (`M`) cells in matched ranges keep their existing semantic colors (`var(--text-error)` / `var(--text-success)`). The semantic color takes precedence over contrast color when both apply, since the legibility concern is dominated by the glyph's meaning. The renderer applies the contrast color only for plain matched residues; stop/start cells get only the semantic color.

### Translation mode toggle

1. New global setting `frameAnnotationMode`, replacing `showFrameAnnotations`. Type:
   ```ts
   type FrameAnnotationMode = "none" | "all" | "forward" | "reverse" | FrameId;
   // FrameId = "+1" | "+2" | "+3" | "-1" | "-2" | "-3"
   ```
   Default: `"all"`.
2. The Obsidian settings tab replaces the current "Show 6-frame annotations" toggle with a dropdown labeled "Default frame display (DNA)" with these labels in order:
   - `Off` (`"none"`)
   - `All 6 frames (matches only)` (`"all"`)
   - `Forward frames (matches only)` (`"forward"`)
   - `Reverse frames (matches only)` (`"reverse"`)
   - `Frame +1` … `Frame -3` (6 entries, one per `FrameId`)
3. The DNA block toolbar gains a new select with the same option set, positioned immediately after the existing scheme select. The select's initial value is `settings.frameAnnotationMode`; changes apply per-block in the current session (consistent with the existing `currentSchemeId` / `currentDisplayMode` pattern). Changes do not persist to settings.
4. Mode-to-frames behavior:
   | Mode | Which frames render |
   |---|---|
   | `none` | None |
   | `all` | All frames in `{+1,+2,+3,-1,-2,-3}` that have ≥1 protein-feature match |
   | `forward` | All frames in `{+1,+2,+3}` that have ≥1 protein-feature match |
   | `reverse` | All frames in `{-1,-2,-3}` that have ≥1 protein-feature match |
   | `FrameId` | That one frame, **always** (no match-presence filter) |
5. In single-frame mode, rows render even if the chosen frame has zero matches. Cells show plain glyphs (with stop/start styling). This is the "inspect this ORF's raw translation" use case.
6. Migration: existing users with `showFrameAnnotations: true|false` in `data.json` are silently mapped — `true → "all"`, `false → "none"` — on first load, and the old key is dropped on next save. No user-visible interruption.

### Edge cases

- **Hovering a cell whose feature span exceeds 60-nt line length:** highlight applies to every sibling cell anywhere in the rendered block, regardless of how many wraps. The DNA-line highlight similarly spans all source codons across wraps. Already free from the `highlightResidues` implementation.
- **Hovering a cell with multiple overlapping matches** (first-wins for color): only the first match's siblings highlight. Tooltip already lists all overlapping matches. (Don't expand hover behavior to all overlaps — keeps the highlight visually unambiguous.)
- **Single-frame mode + sequence too short for any codons in that frame** (e.g., 2-nt sequence, frame +1): row renders with the label only, zero cells. Already supported.
- **Single-frame mode chooses a reverse frame** (`-1/-2/-3`): same code path as forward; coordinate mapping in `translation.ts` already gives forward-strand nt positions for hover highlight.
- **Settings change while a block is rendered:** the global setting only seeds new block renders. Existing rendered blocks retain whatever per-block mode the user picked from their toolbar.
- **Reflow:** existing reflow observer triggers a full re-render; toolbar's `currentFrameMode` closure variable is preserved across renders (matches existing pattern for scheme/display-mode).

## Architecture

### New helper

`src/features/proteinFeatureMatcher.ts` gains one function and one exported type:

```ts
export type FrameAnnotationMode = "none" | "all" | "forward" | "reverse" | FrameId;

export function visibleFramesForMode(
    mode: FrameAnnotationMode,
    matches: ProteinMatch[]
): Set<FrameId>;
```

The function encapsulates the mode → visible-frames mapping. Renderer code stays dumb about modes.

### Renderer changes

`src/renderers/FrameAnnotationRenderer.ts`:

1. Each matched cell gets `data-match-key="${m.featureId}|${m.frame}|${m.aaStart}"`.
2. Each matched cell sets `cell.style.color = autoContrast(m.color)` (when not stop/start).
3. The renderer signature gains the `seqDiv: HTMLElement` parameter so hover handlers can call `highlightResidues(seqDiv, ...)`. Hover handlers attach inline as `mouseenter` / `mouseleave` listeners; they query the block container (`seqDiv.querySelectorAll`) for cells matching `data-match-key`.
4. The renderer no longer applies the unconditional hardcoded text color via CSS.

`src/renderers/NucleotideRenderer.ts`:

1. Toolbar gains a new `<select>` next to the scheme select. Wired through a new `onFrameModeChange` callback, identical to `onSchemeChange` pattern.
2. `currentFrameMode` closure variable holds the per-block mode, initialized from `settings.frameAnnotationMode`.
3. The DNA-only gate now reads `currentFrameMode !== "none" && parsed.sequence.length >= 3` (replaces `settings.showFrameAnnotations`).
4. `visibleFrameIds` computation calls `visibleFramesForMode(currentFrameMode, matches)`.
5. Single-frame mode requires rendering the chosen frame even when matches is empty for that frame. `visibleFramesForMode` handles this purely by returning the single `FrameId` regardless of `matches` content.
6. Pass `seqDiv` into `renderFrameAnnotations` so hover handlers can highlight DNA residues.

`src/renderers/annotationRenderer.ts`:

- `highlightResidues` and `clearHighlights` are already file-local. **Export both** so `FrameAnnotationRenderer` can reuse them. (No behavior change; just visibility.)

### Settings

`src/types.ts`:

1. Add `export type FrameAnnotationMode = ...`.
2. Replace `showFrameAnnotations: boolean` with `frameAnnotationMode: FrameAnnotationMode` in `BiosequenceSettings` and `DEFAULT_SETTINGS` (default `"all"`).

`src/main.ts`:

- `loadSettings` migration: if loaded data has `showFrameAnnotations` but not `frameAnnotationMode`, map `true → "all"`, `false → "none"`, write to settings, drop the old key.

`src/settings.ts`:

- Replace the toggle with a `Setting.addDropdown(...)` populated from the same option list as the toolbar.

### Styling

`styles.css`:

1. Remove `color: #000` from `.biosequence-frame-cell-feature` (inline contrast color wins).
2. Add `.biosequence-frame-cell-hover` rule: outline (e.g., `outline: 2px solid var(--interactive-accent); outline-offset: 1px;`) and slight brightness boost via `filter: brightness(1.1)`.
3. Toolbar select inherits existing `.biosequence-scheme-select` styling — add a class alias if needed.

## Data Flow

1. Toolbar's frame-mode select changes → closure `currentFrameMode` updates → `render()` called → frame context recomputed with new mode.
2. Inside `render()`:
   a. `featureMatches`, `allSegments` computed (unchanged).
   b. If `type === "dna" && currentFrameMode !== "none" && parsed.sequence.length >= 3`:
      - `frames = translateAllFrames(parsed.sequence)`
      - `matches = matchProteinFeatures(frames, settings.featureLibrary)`
      - `visibleFrameIds = visibleFramesForMode(currentFrameMode, matches)`
      - `frameContext = { frames, matches, visibleFrameIds }`
3. `renderColoredSequence` runs per-line; passes `seqDiv` through to `renderFrameAnnotations`.
4. `renderFrameAnnotations` builds rows with hover listeners and contrast-colored cells.
5. Hover: handler queries `seqDiv` for sibling cells by `data-match-key`, toggles `.biosequence-frame-cell-hover` on each, and calls `highlightResidues(seqDiv, m.ntStart, m.ntEnd, m.color)`.

## Testing

Extend `validate.mjs`:

1. **`visibleFramesForMode("none")`** → empty set, regardless of matches.
2. **`visibleFramesForMode("all", matches)`** → equals `annotatedFrameIds(matches)`.
3. **`visibleFramesForMode("forward", matches)`** → only `+1/+2/+3` frames present in `annotatedFrameIds`.
4. **`visibleFramesForMode("reverse", matches)`** → only `-1/-2/-3` frames present in `annotatedFrameIds`.
5. **`visibleFramesForMode("+2", [])`** → `{"+2"}` (single-frame mode bypasses match filter).
6. **Migration:** Not testable in `validate.mjs` (depends on `loadData`). Tested by inspection of the migration code path.

Manual smoke (Obsidian):

1. Hover a matched cell → all sibling cells outline; corresponding DNA codons highlight; tooltip shows.
2. Mouseleave → outlines and DNA highlights clear.
3. Pick a dark-blue feature → matched cells render with light text (contrast applied).
4. Toolbar dropdown → cycle through all 9 mode values; rows update accordingly.
5. Pick `Frame -2` with no `-2` matches → row renders with raw translation, no colored cells.
6. Refresh / reload → toolbar mode resets to `settings.frameAnnotationMode`; settings persists between reloads.

## Open Questions Resolved

- **Hover release:** mouseleave only; no click-to-pin.
- **Tooltip mechanism:** keep existing `title` attribute (browser tooltip).
- **Single-frame mode without matches:** render the row anyway (raw translation).
- **Migration:** silent mapping of the old boolean.
- **Mode persistence per-block:** session-only (matches existing scheme select).

## Out of Scope / Follow-ups

- Click-to-pin highlight.
- Custom tooltip component (rich HTML, not browser default).
- Per-feature text-color override.
- Selecting an arbitrary subset of frames (multi-select).
- Persisting per-block toolbar selection across vault reload.
