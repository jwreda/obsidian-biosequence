# 6-Frame Translate Block + Protein Feature Scan

**Status:** Approved design, ready for implementation plan
**Date:** 2026-05-21
**Author:** brainstormed with Claude

## Motivation

When reviewing plasmid DNA sequences in Obsidian, the user wants to immediately recognize whether any region encodes a protein already in their feature library. The existing plugin matches DNA-typed features against the DNA sequence directly, but offers no way to detect protein-typed features that would only appear after translation. Plasmids can encode in any of six reading frames (three forward, three reverse-complement), so a complete answer requires scanning all six.

## Goals

1. For every `dna` / `DNA` code block, present a translation view that lets the user spot known protein features regardless of reading frame or strand.
2. Reuse the existing protein-typed feature library — no new database, no new UI for managing features.
3. Render the translation view **below** the existing nucleic-acid render, **without modifying** the source block or the existing render output.
4. Keep the visual presentation calm — six frames stacked vertically can become noisy; gate noisy annotations (stop codons) on per-frame evidence of relevance.

## Non-Goals (v1)

- Configurable codon tables (mitochondrial, bacterial, etc.). v1 uses the standard table.
- ORF-only display modes or minimum-ORF-length filters.
- Translating `rna` blocks (forward-only would be the natural scope; deferred).
- Editing translations or copying individual frames as new code blocks.

## User-Visible Behavior

For each DNA block, a new sibling block appears immediately below the existing render, containing:

- **Header summary line:** e.g., `"2 protein features matched across 6 frames (+1: 1, -2: 1)"`. If zero matches, header reads `"No protein features matched in any reading frame"` and frames render in plain form.
- **Six frame rows**, in order `+1`, `+2`, `+3`, `-1`, `-2`, `-3`. Each row shows:
  - A left-aligned frame label (`+1`, etc.) with a small badge showing match count for that frame.
  - The translated protein sequence, with each residue visually aligned to its source codon's nucleotide position in the parent DNA block (so a residue in frame +1 sits over its three source nucleotides). Reverse frames are aligned to their codon positions on the original strand (i.e., the rightmost residue of `-1` aligns under the leftmost nucleotides of the source).
  - **Feature hits**: residues belonging to a matched protein feature are highlighted using the feature's library `color`. Hover tooltip: `<feature name> | frame ±N | aa <start>–<end> | nt <start>–<end>`.
  - **Stop codons (`*`)**: rendered with a distinct stop style **only in frames that have at least one feature hit**. In frames with no hits, stops render as ordinary residue characters (still `*` glyphs, but no special styling, no visual prominence).
  - **Start codons (Met / `M`)**: highlighted in any frame that has at least one feature hit, to help the reader orient against the matched ORF. (Same gating rule as stops — keeps unannotated frames quiet.)

### Stop-codon gating: edge cases

The rule is "show stop styling only in frames with ≥1 feature hit." Concretely:

- **Multiple features in one frame** → still gated on, applies to all stops in that frame.
- **Feature spans no stops** → stops outside the feature are still shown (gating is per-frame, not per-feature-window). This is intentional: once a frame is "interesting," seeing the full ORF context helps.
- **Feature itself contains `*`** → not possible by construction. Protein features in the library are user-defined amino-acid strings; the substring-match implementation will not find a feature crossing a stop because `*` will not appear in `FeatureEntry.sequence`. No special handling needed, but the matcher MUST treat `*` as a non-match character (i.e., a feature like `MKR` will not match across `MK*R` even if the gap were bridged) — guaranteed by plain substring semantics.
- **Frame containing only stops** (extremely rare, e.g., contrived input) → no feature hit possible, so stops stay plain. Acceptable.
- **DNA shorter than 3nt or with length not divisible by 3** → partial trailing codons are not translated. Frame can be empty; render the row with the label and "—" placeholder.
- **Ambiguous bases (N, R, Y, etc.)** → any codon containing a non-ACGT base translates to `X`. `X` is treated as a residue, will not match library features unless the feature literally contains `X`.
- **Lowercase / whitespace / FASTA headers in source** → reuse existing `parseNucleotideSequence` output; do not re-parse.
- **User toggles a feature's `enabled: false`** → not considered for matching; recompute on re-render.

## Architecture

### Insertion point

In `main.ts`, the DNA code-block processor currently calls the nucleic-acid renderer with the source string and the `HTMLElement el` provided by Obsidian. After that call, invoke `renderTranslateBlock(parsed, settings, el)`. The translate renderer creates its **own sibling container** inside `el` (e.g., `<div class="biosequence-translate-block">`), not inside the existing nucleic-acid container. This guarantees:

- The existing renderer's `container.empty()` inside its own internal `render()` does not touch the translate block.
- The source markdown is never modified — both blocks are pure rendered output.
- If the user disables the feature in settings, the translate block simply isn't appended.

If the existing nucleic-acid renderer re-renders on reflow (via its reflow observer), the translate block must also be re-evaluated so feature highlighting stays consistent if settings/library change. Approach: the translate block registers its own lightweight observer on the same `el`, or — simpler — `renderTranslateBlock` registers a callback that the nucleic-acid renderer invokes after each re-render. Choose during implementation; prefer the simpler one.

### New modules

| Module | Responsibility |
|---|---|
| `src/calculations/translation.ts` | Standard codon table; `translateFrame(seq: string, frame: 1\|2\|3): { protein: string; codonStarts: number[] }` returning the protein string for a forward frame and an array mapping each aa index to its nt start position on the forward strand. `translateAllFrames(seq: string): Frame[]` returns all six, where reverse frames are computed by translating the reverse complement and recording nt coordinates **on the original forward-strand orientation**. |
| `src/features/proteinFeatureMatcher.ts` | `matchProteinFeatures(frames: Frame[], features: FeatureEntry[]): ProteinMatch[]`. For each frame, substring-match every enabled `type: "aa"` feature; emit `{ frame: '+1'\|'+2'\|'+3'\|'-1'\|'-2'\|'-3', featureId, aaStart, aaEnd, ntStart, ntEnd }`. Coordinates are inclusive, 1-based for display, 0-based internally — pick one and document. |
| `src/renderers/TranslateRenderer.ts` | `renderTranslateBlock(parsed, settings, parentEl)`. Computes frames, runs matcher, renders header + six rows. Reuses `biosequence-residue` styling and the feature `color` field for consistency with the DNA block. |

### Settings

Add one boolean to `BiosequenceSettings`:

- `showTranslateBlock: boolean` — default `true`. UI: single toggle in the existing settings tab, near other display toggles. No migration concerns (older `data.json` files without the key default to `true` via existing deep-merge).

No additions to the feature library schema. No new modals.

### Styling

Add to `styles.css`:
- `.biosequence-translate-block` — container, top margin to separate from DNA block.
- `.biosequence-translate-frame` — row.
- `.biosequence-translate-frame-label` — frame label badge.
- `.biosequence-translate-residue` — base residue cell; inherits from `.biosequence-residue` sizing so alignment matches.
- `.biosequence-translate-stop` — stop styling (applied **only** in frames with hits).
- `.biosequence-translate-start` — Met styling (applied only in frames with hits).
- `.biosequence-translate-feature` — feature highlight; background uses inline `style="background-color: <feature.color>"` set by the renderer.

## Data Flow

1. Obsidian calls the DNA processor with `source`, `el`.
2. Existing `parseNucleotideSequence(source)` → parsed DNA.
3. Existing `renderNucleotideBlock(parsed, settings, el)` runs unchanged.
4. New `renderTranslateBlock(parsed, settings, el)`:
   a. If `settings.showTranslateBlock === false`, return.
   b. `frames = translateAllFrames(parsed.sequence)`.
   c. `matches = matchProteinFeatures(frames, settings.featureLibrary)`.
   d. Compute per-frame match counts; determine which frames have ≥1 hit (the "annotated frames" set).
   e. Render header + six rows. For each row, emit residue spans; apply feature-highlight class+color where a match covers the residue; apply stop/start classes only when frame is in the annotated set.

## Testing

Extend `validate.mjs`:

1. **Codon table correctness** — translate a fixture covering all 64 codons; compare to a reference table.
2. **Forward frames** — known mRNA (e.g., a short cassette) → expected protein for `+1/+2/+3`.
3. **Reverse frames** — same input → expected proteins for `-1/-2/-3` (verified against NCBI ORF Finder output for the fixture).
4. **Coordinate mapping** — for each match in a planted feature scenario, verify `ntStart`/`ntEnd` round-trip to the codon nucleotides on the forward strand for both forward and reverse frames.
5. **Feature matching across frames** — plant a known protein feature into the codon-encoded sequence in frame `-2`; assert exactly one match, correct frame, correct coordinates.
6. **Ambiguous bases** — codon containing `N` → `X` residue; feature containing `X` matches, feature without `X` does not.
7. **Stop-codon gating** — assert via DOM inspection (or via the matcher returning the "annotated frames" set the renderer consumes) that frames with zero hits do not receive the stop/start CSS class.

## Open Questions Resolved

- **All 6 frames always rendered** (vs. ORF-only / hit-only) — yes.
- **Standard codon table only** — yes, v1.
- **No minimum ORF length filter** — yes.
- **AA-feature match = substring presence** — yes, same model as DNA features.
- **Stop codon styling gated on per-frame feature hit** — yes (added per user request after initial proposal).

## Out of Scope / Follow-ups

- Codon table selector (mitochondrial / bacterial / custom).
- Translating RNA blocks (forward 3 frames only would suffice).
- Highlighting matches in the DNA block based on the nt coordinates of a protein feature hit (cross-block linking).
- Exporting a frame to a new `aa` block.
