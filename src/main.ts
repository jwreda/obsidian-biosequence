import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice, Platform, Plugin, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import { BiosequenceSettings, DEFAULT_SETTINGS, FeatureEntry } from "./types";
import { BiosequenceSettingTab } from "./settings";
import { renderAminoAcidBlock } from "./renderers/AminoAcidRenderer";
import { renderNucleotideBlock } from "./renderers/NucleotideRenderer";
import { renderAlignmentBlock } from "./renderers/AlignmentRenderer";
import { AlignmentModal } from "./alignment/AlignmentModal";
import { runMafft } from "./alignment/mafftRunner";
import { parseFasta } from "./alignment/fastaParser";
import {
	buildLibraryNote,
	extractLibraryBlock,
	mergeFeatureLibraries,
	parseTsvEditorContent,
	replaceLibraryBlock,
	serializeFeaturesToTsv,
} from "./features/featureLibraryFile";

/**
 * Tie a rendered block's observers and document listeners to the block's
 * lifetime, so they are released when the note re-renders or closes.
 */
function bindLifecycle(el: HTMLElement, ctx: MarkdownPostProcessorContext, cleanup: () => void): void {
	const child = new MarkdownRenderChild(el);
	child.register(cleanup);
	ctx.addChild(child);
}

export default class BiosequencePlugin extends Plugin {
	settings: BiosequenceSettings = DEFAULT_SETTINGS;
	private settingTab: BiosequenceSettingTab | null = null;
	/** The library as last read from or written to the library note, as TSV. */
	private libraryTsvInFile: string | null = null;
	/** Writes to the library note wait until the vault has finished loading. */
	private vaultReady = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.loadFeatureLibrary();

		const aaHandler = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
			bindLifecycle(el, ctx, renderAminoAcidBlock(source, el, this.settings));
		};
		for (const tag of ["aa", "AA", "Aa"]) {
			this.registerMarkdownCodeBlockProcessor(tag, aaHandler);
		}

		const dnaHandler = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
			bindLifecycle(el, ctx, renderNucleotideBlock(source, el, "dna", this.settings));
		};
		for (const tag of ["dna", "DNA", "Dna"]) {
			this.registerMarkdownCodeBlockProcessor(tag, dnaHandler);
		}

		const rnaHandler = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
			bindLifecycle(el, ctx, renderNucleotideBlock(source, el, "rna", this.settings));
		};
		for (const tag of ["rna", "RNA", "Rna"]) {
			this.registerMarkdownCodeBlockProcessor(tag, rnaHandler);
		}

		this.settingTab = new BiosequenceSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		this.app.workspace.onLayoutReady(() => void (async () => {
			this.vaultReady = true;
			// Write the note now if loading found entries it does not hold yet
			// (first run after upgrading, or this device had its own library).
			await this.saveSettings();
			const onChange = (file: TAbstractFile): void => {
				void this.onLibraryFileChanged(file);
			};
			this.registerEvent(this.app.vault.on("modify", onChange));
			this.registerEvent(this.app.vault.on("create", onChange));
		})());

		// Register alignment code block processor
		this.registerMarkdownCodeBlockProcessor("alignment", (source, el, ctx) => {
			bindLifecycle(el, ctx, renderAlignmentBlock(source, el, this.settings));
		});

		// Register alignment command (desktop only -- requires child_process)
		if (Platform.isDesktop) {
			this.addCommand({
				id: "align",
				name: "Align two sequences (MAFFT)",
				callback: () => {
					new AlignmentModal(this.app, (seq1, seq2, header1, header2, seqType) => void (async () => {
						try {
							const rawOutput = await runMafft(
								seq1, seq2, header1, header2,
								this.settings.mafftPath
							);
							const entries = parseFasta(rawOutput);
							if (entries.length < 2) {
								throw new Error("MAFFT returned fewer than 2 sequences");
							}


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
							await leaf.openFile(file);
							new Notice(`Alignment saved to ${filename}`);
						} catch (e) {
							new Notice(
								`Alignment failed: ${(e as Error).message}`
							);
						}
					})()).open();
				},
			});
		}
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as
			(Partial<BiosequenceSettings> & { showFrameAnnotations?: boolean }) | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
		// Deep-merge nested objects to handle partial saves
		this.settings.conservationSymbols = Object.assign(
			{},
			DEFAULT_SETTINGS.conservationSymbols,
			saved?.conservationSymbols
		);
		// Ensure featureLibrary entries have all required fields. Libraries
		// saved by version 0.1.1 and earlier live here in data.json;
		// loadFeatureLibrary moves them into the library note.
		this.settings.featureLibrary = [];
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
			&& !saved.frameAnnotationMode) {
			this.settings.frameAnnotationMode = saved.showFrameAnnotations
				? "all"
				: "none";
			await this.saveSettings();
		}
	}

	async saveSettings(): Promise<void> {
		const libraryStored = await this.saveFeatureLibrary();
		if (libraryStored) {
			const data: Partial<BiosequenceSettings> = { ...this.settings };
			delete data.featureLibrary;
			await this.saveData(data);
		} else {
			// Until the note holds the library, keep it in data.json too, so
			// nothing is lost if the note cannot be written.
			await this.saveData(this.settings);
		}
	}

	/** Vault path of the library note, always ending in .md */
	libraryPath(): string {
		let path = this.settings.featureLibraryPath.trim() || DEFAULT_SETTINGS.featureLibraryPath;
		if (!path.toLowerCase().endsWith(".md")) path += ".md";
		return normalizePath(path);
	}

	/**
	 * Load the library from the library note, folding in any entries this
	 * device still has in data.json from before the library moved to a note.
	 * Runs before the vault index is ready, so it reads through the adapter.
	 */
	private async loadFeatureLibrary(): Promise<void> {
		const legacy = this.settings.featureLibrary;
		const path = this.libraryPath();
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(path))) {
			// No note yet: keep this device's library; it is written to the
			// note once the vault is ready.
			this.libraryTsvInFile = null;
			return;
		}
		const fromFile = this.parseLibraryNote(await adapter.read(path), path);
		if (fromFile === null) {
			// The note has no library table. Keep what this device had, and
			// add the table to the note on the next save.
			this.libraryTsvInFile = null;
			return;
		}
		this.libraryTsvInFile = serializeFeaturesToTsv(fromFile);
		this.settings.featureLibrary = mergeFeatureLibraries(fromFile, legacy);
	}

	/** Features in a library note, or null when it has no library table. */
	private parseLibraryNote(text: string, path: string): FeatureEntry[] | null {
		const block = extractLibraryBlock(text);
		if (block === null) {
			new Notice(`BioSequence: no feature table found in "${path}". The library was not loaded from it.`);
			return null;
		}
		const { features, errors } = parseTsvEditorContent(block);
		if (errors.length > 0) {
			new Notice(
				`BioSequence: ${errors.length} line${errors.length === 1 ? "" : "s"} in "${path}" could not be read (${errors[0] ?? ""}).`
			);
		}
		return features;
	}

	/**
	 * Write the library to its note if it changed since the note was last
	 * read or written. Returns whether the note now holds the library.
	 */
	private async saveFeatureLibrary(): Promise<boolean> {
		const tsv = serializeFeaturesToTsv(this.settings.featureLibrary);
		if (tsv === this.libraryTsvInFile) return true;
		if (!this.vaultReady) return false;
		// A device that never had a library does not need an empty note.
		if (this.libraryTsvInFile === null && this.settings.featureLibrary.length === 0
			&& !(this.app.vault.getAbstractFileByPath(this.libraryPath()) instanceof TFile)) {
			return true;
		}
		const path = this.libraryPath();
		try {
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile && this.libraryTsvInFile === null) {
				// The note appeared after startup (e.g. Sync delivered it).
				// Keep its entries rather than overwrite them.
				const block = extractLibraryBlock(await this.app.vault.read(existing));
				if (block !== null) {
					this.settings.featureLibrary = mergeFeatureLibraries(
						parseTsvEditorContent(block).features,
						this.settings.featureLibrary
					);
				}
			}
			const toWrite = serializeFeaturesToTsv(this.settings.featureLibrary);
			// Set before writing so the modify event from our own write is ignored
			this.libraryTsvInFile = toWrite;
			if (existing instanceof TFile) {
				await this.app.vault.process(existing, (data) => replaceLibraryBlock(data, toWrite));
			} else if (existing) {
				throw new Error(`"${path}" is a folder`);
			} else {
				await this.ensureFolder(path);
				await this.app.vault.create(path, buildLibraryNote(toWrite));
			}
			return true;
		} catch (e) {
			this.libraryTsvInFile = null;
			new Notice(`BioSequence: could not save the feature library to "${path}": ${(e as Error).message}`);
			return false;
		}
	}

	private async ensureFolder(filePath: string): Promise<void> {
		const slash = filePath.lastIndexOf("/");
		if (slash <= 0) return;
		const folder = filePath.slice(0, slash);
		const existing = this.app.vault.getAbstractFileByPath(folder);
		if (existing instanceof TFolder) return;
		if (existing) throw new Error(`"${folder}" is a file`);
		await this.app.vault.createFolder(folder);
	}

	/** Reload the library when its note changes, e.g. when Sync brings a new version. */
	private async onLibraryFileChanged(file: TAbstractFile): Promise<void> {
		if (!(file instanceof TFile) || file.path !== this.libraryPath()) return;
		const text = await this.app.vault.read(file);
		const block = extractLibraryBlock(text);
		// Ignore a note that is mid-edit without its table; keep the library as is.
		if (block === null) return;
		const tsv = serializeFeaturesToTsv(parseTsvEditorContent(block).features);
		if (tsv === this.libraryTsvInFile) return;
		const features = this.parseLibraryNote(text, file.path);
		if (features === null) return;
		// If this device's library never made it into the note (for example
		// Sync delivered the note just after startup), fold it in rather than
		// dropping it.
		const neverStored = this.libraryTsvInFile === null;
		const merged = neverStored
			? mergeFeatureLibraries(features, this.settings.featureLibrary)
			: features;
		this.settings.featureLibrary = merged;
		this.libraryTsvInFile = tsv;
		if (merged.length > features.length) await this.saveSettings();
		this.settingTab?.refreshIfOpen();
	}

	/**
	 * Point the library at a different note. If that note exists, its library
	 * is used; otherwise the current library is written there.
	 */
	async setLibraryPath(newPath: string): Promise<void> {
		this.settings.featureLibraryPath = newPath.trim() || DEFAULT_SETTINGS.featureLibraryPath;
		const path = this.libraryPath();
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			const features = this.parseLibraryNote(await this.app.vault.read(file), path);
			if (features !== null) {
				this.settings.featureLibrary = features;
				this.libraryTsvInFile = serializeFeaturesToTsv(features);
			} else {
				this.libraryTsvInFile = null;
			}
		} else {
			this.libraryTsvInFile = null;
		}
		await this.saveSettings();
	}
}
