# BioSequence

Biological sequence viewer for Obsidian — render amino acid, DNA, and RNA sequences with per-residue coloring, biophysical property calculations, and pairwise alignment.

<!-- TODO: Add screenshot of amino acid sequence with summary panel -->

## Features

### Core Sequence Rendering
- **Three sequence types**: Amino acid (`aa`), DNA (`dna`), and RNA (`rna`) code blocks
- **Per-residue coloring** with 8 amino acid and 3 nucleotide color schemes
- **Position numbering** with configurable display in left gutter
- **Responsive reflow** — automatically adjusts residues per line based on container width
- **FASTA header support** — parses and displays headers starting with `>`
- **Invalid residue highlighting** — unrecognized characters highlighted with red wavy underline
- **Interactive hover effects** — residues scale up with tooltip showing residue and position
- **One-click copy** to clipboard

### Color Schemes

**Amino Acid Schemes:**
- **Unique** — distinct color per amino acid
- **RasMol** — classic RasMol molecular visualization coloring (default)
- **ClustalX** — simplified ClustalX group colors
- **Zappo** — physicochemical property-based coloring
- **Hydrophobicity** — gradient from hydrophilic (blue) to hydrophobic (red)
- **Polarity** — gradient by residue polarity
- **Charge** — positive (blue), negative (red), neutral (gray)
- **Chemical Type** — grouped by chemical property (aliphatic, aromatic, etc.)

**Nucleotide Schemes:**
- **Default** — distinct color per base (A/T/G/C/U)
- **Purine/Pyrimidine** — two-color grouping by base type
- **Complementary Pairs** — paired colors (A-T, G-C)

All color schemes include:
- Per-block switching via dropdown (no page reload)
- Collapsible legend with color swatches
- Auto-contrast text color for readability

### Biophysical Property Calculations

**For Amino Acid Sequences:**
| Property | Algorithm | Reference |
|----------|-----------|-----------|
| Molecular Weight | Sum of residue weights + H₂O | Standard amino acid weights |
| Theoretical pI | Bjellqvist bisection method | Bjellqvist et al. 1993 |
| Extinction Coefficient (280nm) | Pace method | Pace et al. 1995 |
| Absorbance 0.1% (1 g/L) | Derived from ext. coeff. and MW | Both reduced and oxidized (disulfide) |
| GRAVY | Mean Kyte-Doolittle hydropathicity | Kyte & Doolittle 1982 |
| Aliphatic Index | Ikai formula | Ikai 1980 |
| Instability Index | DIWV dipeptide weight matrix | Guruprasad et al. 1990 |
| Stability Classification | Stable if II < 40, unstable otherwise | Color-coded visualization |
| Molecular Formula | Atom counts (C, H, N, O, S) | Calculated from composition |
| Amino Acid Composition | Count and percentage per residue | Collapsible table |

**For Nucleotide Sequences:**
| Property | Description |
|----------|-------------|
| Length | Total nucleotides |
| GC Content | Count and percentage of G+C bases |
| Molecular Weight | Sum of nucleotide weights |
| Complement | Watson-Crick complement |
| Reverse Complement | Reversed complement sequence |
| Melting Temperature (Tm) | Calculated Tm |
| Base Counts | Individual A/T/G/C/U counts |

### Sequence Annotations

Two flexible annotation approaches:

**Inline annotations** — wrap segments with `[Name: SEQUENCE]`:
````
```aa
[Signal peptide: MWQHVL]ALVLLLGFHSGQEA[A domain: ANSLLDCAQKFN]
```
````

**Range annotations** — define regions below a `---` delimiter:
````
```aa
MWQHVLALVLLLGFHSGQEAANSLLDCAQKFN
---
1-6: Signal peptide
7-22: Linker
23-33: A domain
```
````

Both can be combined in a single code block. Annotations render as:
- **Ribbons** (default) — colored bars below each sequence line with labels
- **Badges** — compact colored dots with labels in a bar below the sequence

Additional annotation features:
- Hover highlighting of annotated residues
- Collapsible annotation legend
- Tooltips showing overlapping features at each position
- Configurable display mode in settings

### Feature Library

A persistent library of named sequence motifs that auto-highlight on rendered sequences:
- **Manage features** in plugin settings (add, edit, delete)
- **Auto-matching** — enabled features automatically found as substrings
- **Per-feature customization** — name, sequence, type, color, enabled toggle
- **Bulk import** — import multiple features from structured text
- **Quick toggles** — select all / deselect all
- **Visual distinction** — library features render with dashed border

### Interactive Selection
- **Click and drag** to select residue ranges
- **Selection bar** shows selected range and subsequence
- **Copy selection** button for extracting subsequences
- Fully keyboard-accessible

### Sequence Alignment (Desktop Only)

**MAFFT Integration:**
- Command: "Align two sequences (MAFFT)" in command palette
- Modal UI for entering two sequences with headers
- Executes `mafft --auto` for optimal alignment strategy
- Creates new vault note with aligned sequences

**Alignment Rendering (`alignment` code block):**
- Multi-FASTA input with gap characters
- Interleaved display: Seq1 / Conservation / Seq2
- Auto-detects sequence type (aa/dna/rna) from content
- Conservation symbols: `|` identity, `:` similar, `.` weak, `X` mismatch, `-` gap
- All symbols configurable in settings
- Summary statistics: alignment length, identity %, similarity %, gap counts
- Color scheme dropdown (uses appropriate AA or nucleotide schemes)
- Responsive reflow with labeled columns

## Quick Start

### Amino Acid Sequences

````
```aa
MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH
```
````

### DNA Sequences

````
```dna
ATGGTGCTGTCTCCTGCCGACAAGACCAACGTCAAGGCCGCCTGGGGTAAG
```
````

### RNA Sequences

````
```rna
AUGGUGCUGUCUCCCUGCCGACAAGACCAACGUCAAGGCCGCCUGGGGUAAG
```
````

## Installation

### BRAT (Recommended for Beta Testing)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. Open Settings → BRAT → Add Beta plugin
3. Enter `jwreda/obsidian-biosequence`
4. Enable BioSequence in Settings → Community Plugins

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/jwreda/obsidian-biosequence/releases/latest)
2. Create folder `.obsidian/plugins/biosequence/` in your vault
3. Copy the downloaded files into that folder
4. Restart Obsidian
5. Enable BioSequence in Settings → Community Plugins

### Community Plugins (Coming Soon)

BioSequence will be available in the Obsidian Community Plugins browser after initial release.

## Configuration

All settings are configurable via Settings → BioSequence:

| Setting | Description | Default |
|---------|-------------|---------|
| Default AA color scheme | Color scheme for amino acid sequences | RasMol |
| Default DNA color scheme | Color scheme for DNA sequences | Default |
| Default RNA color scheme | Color scheme for RNA sequences | Default |
| Max residues per line | Maximum residues before wrapping | 60 |
| Show position numbers | Display position gutter | Enabled |
| Font size | Sequence font size (8-24px) | 14px |
| Annotation display mode | Ribbons or badges | Ribbons |
| Assume disulfide bonds | For extinction coefficient calculation | Disabled |
| MAFFT binary path | Path to MAFFT executable | `mafft` |
| Alignment output directory | Where to save alignment notes | `Plasmid design/alignments` |
| Conservation symbols | Customize alignment symbols | `|`, `:`, `.`, `X`, `-` |
| Feature Library | Manage auto-matching motifs | Empty |

## MAFFT Alignment Setup

The alignment feature requires MAFFT to be installed on your system (desktop only).

### Installation

**macOS (Homebrew):**
```bash
brew install mafft
```

**Linux (apt):**
```bash
sudo apt-get install mafft
```

**Windows:**
Download from [MAFFT website](https://mafft.cbrc.jp/alignment/software/) and add to PATH.

### Usage

1. Open command palette (Cmd/Ctrl + P)
2. Search for "Align two sequences (MAFFT)"
3. Enter two sequences with FASTA headers
4. Select sequence type
5. Click "Align"

A new note will be created with the alignment in an `alignment` code block.

## Compatibility

- **Obsidian version**: 1.0.0 or higher
- **Platforms**: Desktop (macOS, Windows, Linux) and mobile (iOS, Android)
  - Alignment feature is desktop-only due to MAFFT requirement
- **Themes**: Fully compatible with light and dark themes (uses Obsidian CSS variables)
- **Dependencies**: Zero runtime dependencies for core features; MAFFT optional for alignment

## Development

### Setup

```bash
git clone https://github.com/jwreda/obsidian-biosequence.git
cd obsidian-biosequence
npm install
```

### Build

```bash
npm run dev    # Watch mode for development
npm run build  # Production build
```

### Development Workflow

Create a symlink to your vault for live testing:

```bash
ln -s /path/to/obsidian-biosequence /path/to/vault/.obsidian/plugins/biosequence
```

After running `npm run dev`, changes will be automatically compiled. Reload Obsidian (Cmd/Ctrl + R) to see updates.

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

Joe Reda

## Acknowledgments

- Color schemes inspired by RasMol, ClustalX, and Zappo
- Biophysical calculations based on established algorithms (Bjellqvist, Pace, Kyte-Doolittle, Ikai, Guruprasad)
- MAFFT alignment by Katoh et al.

---

**Repository**: [github.com/jwreda/obsidian-biosequence](https://github.com/jwreda/obsidian-biosequence)
