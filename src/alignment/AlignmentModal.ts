import { App, Modal, Notice, Setting, TFile, FuzzySuggestModal } from "obsidian";
import { SequenceType } from "../types";

/**
 * Modal that lets the user input two sequences for pairwise alignment.
 *
 * Sequences can be pasted directly or picked from vault files that contain
 * biosequence code blocks (```aa, ```dna, ```rna).
 */

/** Callback shape for when the user submits two sequences. */
type AlignmentSubmitCallback = (
	seq1: string,
	seq2: string,
	header1: string,
	header2: string,
	type: SequenceType
) => void;

/** A biosequence block extracted from a vault file. */
interface ExtractedBlock {
	type: string;
	content: string;
	header: string;
	sequence: string;
}

/**
 * FuzzySuggestModal for picking a markdown file from the vault.
 */
class FileSuggestModal extends FuzzySuggestModal<TFile> {
	private files: TFile[];
	private onChoose: (file: TFile) => void;

	constructor(app: App, files: TFile[], onChoose: (file: TFile) => void) {
		super(app);
		this.files = files;
		this.onChoose = onChoose;
		this.setPlaceholder("Search for a file...");
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(item: TFile): string {
		return item.path;
	}

	onChooseItem(item: TFile): void {
		this.onChoose(item);
	}
}

/**
 * FuzzySuggestModal for picking among multiple biosequence blocks in a file.
 */
class BlockSuggestModal extends FuzzySuggestModal<ExtractedBlock> {
	private blocks: ExtractedBlock[];
	private onChoose: (block: ExtractedBlock) => void;

	constructor(
		app: App,
		blocks: ExtractedBlock[],
		onChoose: (block: ExtractedBlock) => void
	) {
		super(app);
		this.blocks = blocks;
		this.onChoose = onChoose;
		this.setPlaceholder("Select a sequence block...");
	}

	getItems(): ExtractedBlock[] {
		return this.blocks;
	}

	getItemText(item: ExtractedBlock): string {
		const preview =
			item.content.length > 200
				? item.content.substring(0, 200) + "..."
				: item.content;
		return `[${item.type.toUpperCase()}] ${preview}`;
	}

	onChooseItem(item: ExtractedBlock): void {
		this.onChoose(item);
	}
}

/**
 * Extract biosequence blocks from file content.
 * Matches ```aa, ```dna, ```rna blocks (case-insensitive).
 */
function extractBiosequenceBlocks(content: string): ExtractedBlock[] {
	const blocks: ExtractedBlock[] = [];
	const regex = /```(?:aa|AA|Aa|dna|DNA|Dna|rna|RNA|Rna)\n([\s\S]*?)```/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(content)) !== null) {
		const fullMatch = match[0] ?? "";
		const blockContent = match[1] ?? "";

		// Determine the type from the opening tag
		const typeMatch = fullMatch.match(/^```(aa|dna|rna)/i);
		const blockType = typeMatch ? (typeMatch[1] ?? "aa").toLowerCase() : "aa";

		// Parse header and sequence from block content
		const lines = blockContent.split("\n").filter((l) => l.trim().length > 0);
		let header = "";
		const seqLines: string[] = [];

		for (const line of lines) {
			if (line.startsWith(">")) {
				header = line.substring(1).trim();
			} else {
				seqLines.push(line.trim());
			}
		}

		blocks.push({
			type: blockType,
			content: blockContent.trim(),
			header: header,
			sequence: seqLines.join("").replace(/\s/g, ""),
		});
	}

	return blocks;
}

export class AlignmentModal extends Modal {
	private onSubmit: AlignmentSubmitCallback;
	private seqType: SequenceType = "aa";
	private textarea1: HTMLTextAreaElement | null = null;
	private textarea2: HTMLTextAreaElement | null = null;
	private header1 = "Sequence_1";
	private header2 = "Sequence_2";

	constructor(app: App, onSubmit: AlignmentSubmitCallback) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Pairwise Sequence Alignment" });

		// Sequence type dropdown
		new Setting(contentEl)
			.setName("Sequence type")
			.setDesc("Select the type of sequences to align")
			.addDropdown((dropdown) => {
				dropdown.addOption("aa", "Amino Acid (AA)");
				dropdown.addOption("dna", "DNA");
				dropdown.addOption("rna", "RNA");
				dropdown.setValue(this.seqType).onChange((value) => {
					this.seqType = value as SequenceType;
				});
			});

		// Sequence 1
		contentEl.createEl("h3", { text: "Sequence 1" });
		this.textarea1 = contentEl.createEl("textarea", {
			cls: "biosequence-alignment-input",
			attr: {
				rows: "6",
				placeholder:
					"Paste sequence here (with or without FASTA header)...",
			},
		});

		const btnRow1 = contentEl.createDiv({
			cls: "biosequence-alignment-btn-row",
		});
		const pickBtn1 = btnRow1.createEl("button", {
			text: "Pick from vault",
		});
		pickBtn1.addEventListener("click", () => {
			this.pickFromVault(1);
		});

		// Sequence 2
		contentEl.createEl("h3", { text: "Sequence 2" });
		this.textarea2 = contentEl.createEl("textarea", {
			cls: "biosequence-alignment-input",
			attr: {
				rows: "6",
				placeholder:
					"Paste sequence here (with or without FASTA header)...",
			},
		});

		const btnRow2 = contentEl.createDiv({
			cls: "biosequence-alignment-btn-row",
		});
		const pickBtn2 = btnRow2.createEl("button", {
			text: "Pick from vault",
		});
		pickBtn2.addEventListener("click", () => {
			this.pickFromVault(2);
		});

		// Align CTA button
		const ctaRow = contentEl.createDiv({
			cls: "biosequence-alignment-cta-row",
		});
		ctaRow.style.marginTop = "16px";
		ctaRow.style.textAlign = "right";

		const alignBtn = ctaRow.createEl("button", {
			text: "Align",
			cls: "mod-cta",
		});
		alignBtn.addEventListener("click", () => {
			this.handleSubmit();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Open a fuzzy file picker, extract biosequence blocks from the chosen file,
	 * and populate the specified textarea.
	 */
	private pickFromVault(seqNum: 1 | 2): void {
		const mdFiles = this.app.vault
			.getFiles()
			.filter((f) => f.extension === "md");

		new FileSuggestModal(this.app, mdFiles, async (file: TFile) => {
			const content = await this.app.vault.read(file);
			const blocks = extractBiosequenceBlocks(content);

			if (blocks.length === 0) {
				new Notice("No biosequence blocks found in file");
				return;
			}

			if (blocks.length === 1) {
				this.applyBlock(blocks[0]!, seqNum, file);
			} else {
				// Multiple blocks: let user pick
				new BlockSuggestModal(
					this.app,
					blocks,
					(block: ExtractedBlock) => {
						this.applyBlock(block, seqNum, file);
					}
				).open();
			}
		}).open();
	}

	/**
	 * Apply a selected block to the appropriate textarea.
	 */
	private applyBlock(
		block: ExtractedBlock,
		seqNum: 1 | 2,
		file: TFile
	): void {
		const textarea = seqNum === 1 ? this.textarea1 : this.textarea2;
		if (!textarea) return;

		// Build display content with header if available
		const displayLines: string[] = [];
		if (block.header) {
			displayLines.push(`>${block.header}`);
		}
		displayLines.push(block.sequence);
		textarea.value = displayLines.join("\n");

		// Set the header for output naming
		const header =
			block.header || file.basename;
		if (seqNum === 1) {
			this.header1 = header;
		} else {
			this.header2 = header;
		}

		// Auto-set sequence type from block type
		if (
			block.type === "dna" ||
			block.type === "rna" ||
			block.type === "aa"
		) {
			this.seqType = block.type as SequenceType;
		}
	}

	/**
	 * Parse raw textarea content into header + clean sequence.
	 */
	private parseTextarea(raw: string): {
		header: string;
		sequence: string;
	} {
		const lines = raw
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 0);
		let header = "";
		const seqLines: string[] = [];

		for (const line of lines) {
			if (line.startsWith(">")) {
				header = line.substring(1).trim();
			} else {
				seqLines.push(line);
			}
		}

		// Clean sequence: remove whitespace, digits, asterisks
		const sequence = seqLines
			.join("")
			.replace(/[\s\d*]/g, "")
			.toUpperCase();
		return { header, sequence };
	}

	/**
	 * Auto-detect sequence type from characters.
	 */
	private detectType(sequence: string): SequenceType | null {
		const upper = sequence.toUpperCase();
		const hasU = upper.includes("U");
		const hasT = upper.includes("T");
		const nucOnly = /^[ATUGCN]+$/i.test(upper);
		const aaOnly = /^[ACDEFGHIKLMNPQRSTVWY]+$/i.test(upper);

		if (nucOnly && hasU && !hasT) return "rna";
		if (nucOnly && hasT && !hasU) return "dna";
		if (nucOnly) return "dna"; // Default nucleotide assumption
		if (aaOnly) return "aa";
		return null;
	}

	/**
	 * Validate and submit the two sequences.
	 */
	private handleSubmit(): void {
		const raw1 = this.textarea1?.value ?? "";
		const raw2 = this.textarea2?.value ?? "";

		const parsed1 = this.parseTextarea(raw1);
		const parsed2 = this.parseTextarea(raw2);

		if (parsed1.sequence.length === 0) {
			new Notice("Sequence 1 is empty");
			return;
		}
		if (parsed2.sequence.length === 0) {
			new Notice("Sequence 2 is empty");
			return;
		}

		// Use parsed headers if available, otherwise fall back to defaults
		const h1 = parsed1.header || this.header1;
		const h2 = parsed2.header || this.header2;

		// Auto-detect type if possible and warn on mismatch
		const detected1 = this.detectType(parsed1.sequence);
		const detected2 = this.detectType(parsed2.sequence);

		if (detected1 && detected2 && detected1 !== detected2) {
			new Notice(
				`Warning: Sequence types may not match (${detected1} vs ${detected2}). Using selected type: ${this.seqType.toUpperCase()}`
			);
		} else if (detected1 && detected1 !== this.seqType) {
			new Notice(
				`Note: Detected type ${detected1.toUpperCase()} differs from selected ${this.seqType.toUpperCase()}`
			);
		}

		this.close();
		this.onSubmit(parsed1.sequence, parsed2.sequence, h1, h2, this.seqType);
	}
}
