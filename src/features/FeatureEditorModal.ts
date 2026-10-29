import { App, Modal, Notice, Setting } from "obsidian";
import { FeatureEntry, SequenceType } from "../types";
import { SEGMENT_PALETTE } from "../parsing/segmentParser";

export class FeatureEditorModal extends Modal {
	private feature: FeatureEntry;
	private isNew: boolean;
	private onSave: (feature: FeatureEntry) => void;

	constructor(
		app: App,
		feature: FeatureEntry | null,
		onSave: (feature: FeatureEntry) => void
	) {
		super(app);
		this.isNew = feature === null;
		this.onSave = onSave;
		this.feature = feature
			? { ...feature }
			: {
					id: crypto.randomUUID(),
					name: "",
					sequence: "",
					type: "aa",
					color:
						SEGMENT_PALETTE[
							Math.floor(Math.random() * SEGMENT_PALETTE.length)
						] ?? "#7eb8da",
					enabled: true,
			  };
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", {
			text: this.isNew ? "Add feature" : "Edit feature",
		});

		new Setting(contentEl)
			.setName("Name")
			.setDesc("Feature name (e.g., 'Igk Leader', 'T7 Promoter')")
			.addText((text) =>
				text
					.setValue(this.feature.name)
					.setPlaceholder("Feature name")
					.onChange((v) => {
						this.feature.name = v;
					})
			);

		// Sequence textarea (use a raw textarea since Setting doesn't have addTextArea with good sizing)
		const seqSetting = new Setting(contentEl)
			.setName("Sequence")
			.setDesc(
				"The sequence to match (whitespace stripped, case-insensitive)"
			);

		const textarea = seqSetting.controlEl.createEl("textarea", {
			cls: "biosequence-feature-editor-textarea",
			placeholder: "METDTLLLWVLLLWVPGSTGD",
		});
		textarea.value = this.feature.sequence;
		textarea.addEventListener("input", () => {
			this.feature.sequence = textarea.value.replace(/\s/g, "").toUpperCase();
		});

		new Setting(contentEl)
			.setName("Type")
			.setDesc("Sequence type")
			.addDropdown((dd) => {
				dd.addOption("aa", "Amino acid");
				dd.addOption("dna", "DNA");
				dd.addOption("rna", "RNA");
				dd.setValue(this.feature.type).onChange((v) => {
					this.feature.type = v as SequenceType;
				});
			});

		new Setting(contentEl)
			.setName("Color")
			.setDesc("Display color for this feature")
			.addColorPicker((cp) =>
				cp.setValue(this.feature.color).onChange((v) => {
					this.feature.color = v;
				})
			);

		// Save button
		const btnContainer = contentEl.createDiv({
			cls: "biosequence-feature-editor-actions",
		});
		const saveBtn = btnContainer.createEl("button", {
			text: "Save",
			cls: "mod-cta",
		});
		saveBtn.addEventListener("click", () => {
			if (!this.feature.name.trim()) {
				new Notice("Feature name is required");
				return;
			}
			if (!this.feature.sequence.trim()) {
				new Notice("Feature sequence is required");
				return;
			}
			// Clean sequence before saving
			this.feature.sequence = this.feature.sequence
				.replace(/\s/g, "")
				.toUpperCase();
			this.onSave(this.feature);
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
