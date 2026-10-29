import { App, Modal, Notice } from "obsidian";
import { FeatureEntry } from "../types";
import { parseImport, detectFormat } from "./featureImporter";

export class FeatureImportModal extends Modal {
	private onImport: (features: FeatureEntry[]) => void;

	constructor(app: App, onImport: (features: FeatureEntry[]) => void) {
		super(app);
		this.onImport = onImport;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Import features" });

		contentEl.createEl("p", {
			text: "Paste features in TSV or FASTA format.",
			cls: "setting-item-description",
		});

		// Format help
		const help = contentEl.createEl("details", {
			cls: "biosequence-import-help",
		});
		help.createEl("summary", { text: "Format examples" });
		const helpContent = help.createDiv();
		helpContent.createEl("p", { text: "TSV (tab-separated):" });
		helpContent.createEl("pre", {
			text: "Name\tSequence\tType\nIgk Leader\tMETDTLLLWVLLLWVPGSTGD\tAA\nT7 Promoter\tTAATACGACTCACTATA\tDNA",
		});
		helpContent.createEl("p", { text: "FASTA-like:" });
		helpContent.createEl("pre", {
			text: ">Igk Leader [aa]\nMETDTLLLWVLLLWVPGSTGD\n>T7 Promoter [dna]\nTAATACGACTCACTATA",
		});

		// Textarea
		const textarea = contentEl.createEl("textarea", {
			cls: "biosequence-import-textarea",
			placeholder: "Paste features here...",
		});

		// Preview area
		const preview = contentEl.createDiv({
			cls: "biosequence-import-preview",
		});

		// Update preview on input
		textarea.addEventListener("input", () => {
			const text = textarea.value.trim();
			if (text.length === 0) {
				preview.textContent = "";
				return;
			}
			try {
				const features = parseImport(text);
				const format = detectFormat(text);
				const aaCnt = features.filter((f) => f.type === "aa").length;
				const dnaCnt = features.filter((f) => f.type === "dna").length;
				const rnaCnt = features.filter((f) => f.type === "rna").length;
				const parts = [];
				if (aaCnt > 0) parts.push(`${aaCnt} AA`);
				if (dnaCnt > 0) parts.push(`${dnaCnt} DNA`);
				if (rnaCnt > 0) parts.push(`${rnaCnt} RNA`);
				preview.textContent = `Detected ${format.toUpperCase()} format: ${features.length} features (${parts.join(", ")})`;
				preview.classList.remove("biosequence-import-preview-error");
			} catch {
				preview.textContent = "Could not parse input";
				preview.classList.add("biosequence-import-preview-error");
			}
		});

		// Import button
		const btnContainer = contentEl.createDiv({
			cls: "biosequence-import-actions",
		});
		const importBtn = btnContainer.createEl("button", {
			text: "Import",
			cls: "mod-cta",
		});
		importBtn.addEventListener("click", () => {
			const text = textarea.value.trim();
			if (text.length === 0) {
				new Notice("Nothing to import");
				return;
			}
			try {
				const features = parseImport(text);
				if (features.length === 0) {
					new Notice("No valid features found in input");
					return;
				}
				this.onImport(features);
				new Notice(`Imported ${features.length} features`);
				this.close();
			} catch {
				new Notice("Failed to parse import data");
			}
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
