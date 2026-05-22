import { Notice, Platform, Plugin } from "obsidian";
import { BiosequenceSettings, DEFAULT_SETTINGS, FeatureEntry } from "./types";
import { BiosequenceSettingTab } from "./settings";
import { renderAminoAcidBlock } from "./renderers/AminoAcidRenderer";
import { renderNucleotideBlock } from "./renderers/NucleotideRenderer";
import { renderAlignmentBlock } from "./renderers/AlignmentRenderer";
import { renderTranslateBlock } from "./renderers/TranslateRenderer";
import { AlignmentModal } from "./alignment/AlignmentModal";
import { runMafft } from "./alignment/mafftRunner";
import { parseFasta } from "./alignment/fastaParser";
import { computeConservation } from "./alignment/conservation";

export default class BiosequencePlugin extends Plugin {
	settings: BiosequenceSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		const aaHandler = (source: string, el: HTMLElement): void => {
			renderAminoAcidBlock(source, el, this.settings);
		};
		for (const tag of ["aa", "AA", "Aa"]) {
			this.registerMarkdownCodeBlockProcessor(tag, aaHandler);
		}

		const dnaHandler = (source: string, el: HTMLElement): void => {
			renderNucleotideBlock(source, el, "dna", this.settings);
			renderTranslateBlock(source, el, this.settings);
		};
		for (const tag of ["dna", "DNA", "Dna"]) {
			this.registerMarkdownCodeBlockProcessor(tag, dnaHandler);
		}

		const rnaHandler = (source: string, el: HTMLElement): void => {
			renderNucleotideBlock(source, el, "rna", this.settings);
		};
		for (const tag of ["rna", "RNA", "Rna"]) {
			this.registerMarkdownCodeBlockProcessor(tag, rnaHandler);
		}

		this.addSettingTab(new BiosequenceSettingTab(this.app, this));

		// Register alignment code block processor
		this.registerMarkdownCodeBlockProcessor("alignment", (source, el) => {
			renderAlignmentBlock(source, el, this.settings);
		});

		// Register alignment command (desktop only -- requires child_process)
		if (Platform.isDesktop) {
			this.addCommand({
				id: "biosequence-align",
				name: "Align two sequences (MAFFT)",
				callback: () => {
					new AlignmentModal(this.app, async (seq1, seq2, header1, header2, seqType) => {
						try {
							const rawOutput = await runMafft(
								seq1, seq2, header1, header2,
								this.settings.mafftPath
							);
							const entries = parseFasta(rawOutput);
							if (entries.length < 2) {
								throw new Error("MAFFT returned fewer than 2 sequences");
							}

							const conservation = computeConservation(
								entries[0]!.sequence,
								entries[1]!.sequence
							);

							// Generate output file
							const outputDir = this.settings.alignmentOutputDir;
							const timestamp = new Date().toISOString().slice(0, 10);
							const safeName = (s: string) =>
								s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
							const filename = `${outputDir}/alignment-${safeName(header1)}-vs-${safeName(header2)}-${timestamp}.md`;

							// Ensure output directory exists
							const dirExists = this.app.vault.getAbstractFileByPath(outputDir);
							if (!dirExists) {
								await this.app.vault.createFolder(outputDir);
							}

							const content = [
								"---",
								`date: "[[${timestamp}]]"`,
								"type: alignment",
								`seq1: "[[${header1}]]"`,
								`seq2: "[[${header2}]]"`,
								`sequence-type: ${seqType}`,
								"tags:",
								"  - alignment",
								"  - biosequence",
								"---",
								"",
								`# Alignment: ${header1} vs ${header2}`,
								"",
								"```alignment",
								`>${entries[0]!.header}`,
								entries[0]!.sequence,
								`>${entries[1]!.header}`,
								entries[1]!.sequence,
								"```",
								"",
							].join("\n");

							const file = await this.app.vault.create(filename, content);
							const leaf = this.app.workspace.getLeaf(false);
							await leaf.openFile(file as any);
							new Notice(`Alignment saved to ${filename}`);
						} catch (e) {
							new Notice(
								`Alignment failed: ${(e as Error).message}`
							);
						}
					}).open();
				},
			});
		}
	}

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
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
