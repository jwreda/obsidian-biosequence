import { App, PluginSettingTab, Setting } from "obsidian";
import type BiosequencePlugin from "./main";
import { AAColorSchemeId, FrameAnnotationMode, NucleotideColorSchemeId, AnnotationDisplayMode, FeatureEntry } from "./types";
import { getAASchemeList, getNucleotideSchemeList } from "./colorSchemes/index";
import { FeatureEditorModal } from "./features/FeatureEditorModal";
import { FeatureImportModal } from "./features/FeatureImportModal";
import { SEGMENT_PALETTE } from "./parsing/segmentParser";

function normalizeHexColor(raw: string): string | null {
	const hex = raw.replace(/^#/, "");
	if (/^[0-9a-fA-F]{6}$/.test(hex)) {
		return "#" + hex.toLowerCase();
	}
	return null;
}

function serializeFeaturesToTsv(features: FeatureEntry[]): string {
	const header = "Name\tSequence\tType\tColor\tEnabled";
	const rows = features.map(f =>
		`${f.name}\t${f.sequence}\t${f.type}\t${f.color}\t${f.enabled}`
	);
	return [header, ...rows].join("\n");
}

function parseTsvEditorContent(text: string): { features: FeatureEntry[]; errors: string[] } {
	const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
	const features: FeatureEntry[] = [];
	const errors: string[] = [];

	let startIdx = 0;
	const firstLine = lines[0];
	if (firstLine !== undefined && /^name\t/i.test(firstLine)) {
		startIdx = 1;
	}

	for (let i = startIdx; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;

		const parts = line.split("\t");
		if (parts.length < 2) {
			errors.push(`Line ${i + 1}: too few columns`);
			continue;
		}

		const name = (parts[0] ?? "").trim();
		const sequence = (parts[1] ?? "").replace(/\s/g, "").toUpperCase();
		const typeStr = (parts[2] ?? "aa").trim().toLowerCase();
		const type: "aa" | "dna" | "rna" = (typeStr === "dna" || typeStr === "rna") ? typeStr : "aa";

		// Parse color
		let color: string;
		const rawColor = (parts[3] ?? "").trim();
		if (rawColor.length > 0) {
			const normalized = normalizeHexColor(rawColor);
			if (normalized) {
				color = normalized;
			} else {
				errors.push(`Line ${i + 1}: invalid color "${rawColor}"`);
				color = SEGMENT_PALETTE[features.length % SEGMENT_PALETTE.length] ?? "#7eb8da";
			}
		} else {
			color = SEGMENT_PALETTE[features.length % SEGMENT_PALETTE.length] ?? "#7eb8da";
		}

		// Parse enabled
		const enabledStr = (parts[4] ?? "true").trim().toLowerCase();
		const enabled = enabledStr !== "false" && enabledStr !== "0";

		if (name.length > 0 && sequence.length > 0) {
			features.push({
				id: crypto.randomUUID(),
				name,
				sequence,
				type,
				color,
				enabled,
			});
		} else {
			errors.push(`Line ${i + 1}: missing name or sequence`);
		}
	}

	return { features, errors };
}

export class BiosequenceSettingTab extends PluginSettingTab {
	plugin: BiosequencePlugin;
	private tsvEditorActive: boolean = false;
	private featureFilter: string = "";

	constructor(app: App, plugin: BiosequencePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Amino acid sequences").setHeading();

		new Setting(containerEl)
			.setName("Default color scheme")
			.setDesc("Color scheme used for amino acid code blocks")
			.addDropdown((dropdown) => {
				for (const scheme of getAASchemeList()) {
					dropdown.addOption(scheme.id, scheme.name);
				}
				dropdown
					.setValue(this.plugin.settings.defaultAAScheme)
					.onChange(async (value) => {
						this.plugin.settings.defaultAAScheme = value as AAColorSchemeId;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl).setName("Nucleotide sequences").setHeading();

		new Setting(containerEl)
			.setName("Default DNA color scheme")
			.setDesc("Color scheme used for DNA code blocks")
			.addDropdown((dropdown) => {
				for (const scheme of getNucleotideSchemeList()) {
					dropdown.addOption(scheme.id, scheme.name);
				}
				dropdown
					.setValue(this.plugin.settings.defaultDNAScheme)
					.onChange(async (value) => {
						this.plugin.settings.defaultDNAScheme = value as NucleotideColorSchemeId;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Default RNA color scheme")
			.setDesc("Color scheme used for RNA code blocks")
			.addDropdown((dropdown) => {
				for (const scheme of getNucleotideSchemeList()) {
					dropdown.addOption(scheme.id, scheme.name);
				}
				dropdown
					.setValue(this.plugin.settings.defaultRNAScheme)
					.onChange(async (value) => {
						this.plugin.settings.defaultRNAScheme = value as NucleotideColorSchemeId;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl).setName("Display").setHeading();

		new Setting(containerEl)
			.setName("Max residues per line")
			.setDesc(
				"Maximum residues per line (default: 60). " +
				"The actual count auto-adjusts to fit the container width."
			)
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.residuesPerLine))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						if (!isNaN(parsed) && parsed > 0 && parsed <= 200) {
							this.plugin.settings.residuesPerLine = parsed;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Show position numbers")
			.setDesc("Display residue position numbers in the left gutter")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showPositionNumbers)
					.onChange(async (value) => {
						this.plugin.settings.showPositionNumbers = value;
						await this.plugin.saveSettings();
					})
			);

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
						this.plugin.settings.frameAnnotationMode = value as FrameAnnotationMode;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Font size")
			.setDesc("Sequence display font size in pixels (default: 14)")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.sequenceFontSize))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						if (!isNaN(parsed) && parsed >= 8 && parsed <= 24) {
							this.plugin.settings.sequenceFontSize = parsed;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Annotation display")
			.setDesc("How to show feature annotations on sequences")
			.addDropdown((dropdown) => {
				dropdown.addOption("ribbons", "Ribbons (below each line)");
				dropdown.addOption("badges", "Compact Badges (right side)");
				dropdown
					.setValue(this.plugin.settings.annotationDisplayMode)
					.onChange(async (value) => {
						this.plugin.settings.annotationDisplayMode = value as AnnotationDisplayMode;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Search highlight color")
			.setDesc("Accent color used to highlight matches in the Search color scheme")
			.addColorPicker((picker) =>
				picker
					.setValue(this.plugin.settings.searchHighlightColor)
					.onChange(async (value) => {
						this.plugin.settings.searchHighlightColor = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Expand properties by default")
			.setDesc("Whether the sequence properties panel starts expanded or collapsed")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.summaryExpanded)
					.onChange(async (value) => {
						this.plugin.settings.summaryExpanded = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Alignment (MAFFT)").setHeading();

		new Setting(containerEl)
			.setName("MAFFT binary path")
			.setDesc("Path to the MAFFT executable. Default uses PATH lookup.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.mafftPath)
					.setPlaceholder("mafft")
					.onChange(async (value) => {
						this.plugin.settings.mafftPath = value || "mafft";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Alignment output directory")
			.setDesc("Vault directory for saving alignment result files")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.alignmentOutputDir)
					.setPlaceholder("BioSequence/alignments")
					.onChange(async (value) => {
						this.plugin.settings.alignmentOutputDir = value || "BioSequence/alignments";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Conservation symbols").setHeading();
		containerEl.createEl("p", {
			text: "Characters displayed in the conservation row between aligned sequences. Each field accepts a single character. Use a space to leave a position blank.",
			cls: "setting-item-description",
		});

		const symbols = this.plugin.settings.conservationSymbols;

		new Setting(containerEl)
			.setName("Identity")
			.setDesc("Both residues are identical (default: |). Use a space for blank.")
			.addText((text) =>
				text
					.setValue(symbols.identity)
					.setPlaceholder("|")
					.onChange(async (value) => {
						if (value.length <= 1) {
							this.plugin.settings.conservationSymbols.identity = value || " ";
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Similar")
			.setDesc("Strong similarity, BLOSUM62 groups (default: :). Use a space for blank.")
			.addText((text) =>
				text
					.setValue(symbols.similar)
					.setPlaceholder(":")
					.onChange(async (value) => {
						if (value.length <= 1) {
							this.plugin.settings.conservationSymbols.similar = value || " ";
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Weak")
			.setDesc("Weak similarity (default: .). Use a space for blank.")
			.addText((text) =>
				text
					.setValue(symbols.weak)
					.setPlaceholder(".")
					.onChange(async (value) => {
						if (value.length <= 1) {
							this.plugin.settings.conservationSymbols.weak = value || " ";
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Mismatch")
			.setDesc("Both residues present but different (default: X). Use a space for blank.")
			.addText((text) =>
				text
					.setValue(symbols.mismatch)
					.setPlaceholder("X")
					.onChange(async (value) => {
						if (value.length <= 1) {
							this.plugin.settings.conservationSymbols.mismatch = value || " ";
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Gap")
			.setDesc("At least one sequence has a gap (default: -). Use a space for blank.")
			.addText((text) =>
				text
					.setValue(symbols.gap)
					.setPlaceholder("-")
					.onChange(async (value) => {
						if (value.length <= 1) {
							this.plugin.settings.conservationSymbols.gap = value || " ";
							await this.plugin.saveSettings();
						}
					})
			);

		// Feature Library section
		this.renderFeatureLibrary(containerEl);
	}

	private renderFeatureLibrary(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Feature library").setHeading();
		containerEl.createEl("p", {
			text: "Define sequences to automatically highlight on rendered sequences. Matched by exact substring.",
			cls: "setting-item-description",
		});

		// Toolbar
		const toolbar = containerEl.createDiv({ cls: "biosequence-feature-toolbar" });

		if (!this.tsvEditorActive) {
			const selectAllBtn = toolbar.createEl("button", { text: "Select All" });
			selectAllBtn.addEventListener("click", async () => {
				for (const f of this.plugin.settings.featureLibrary) f.enabled = true;
				await this.plugin.saveSettings();
				this.display();
			});

			const deselectAllBtn = toolbar.createEl("button", { text: "Deselect All" });
			deselectAllBtn.addEventListener("click", async () => {
				for (const f of this.plugin.settings.featureLibrary) f.enabled = false;
				await this.plugin.saveSettings();
				this.display();
			});

			const addBtn = toolbar.createEl("button", { text: "Add Feature", cls: "mod-cta" });
			addBtn.addEventListener("click", () => {
				new FeatureEditorModal(this.app, null, async (feature) => {
					this.plugin.settings.featureLibrary.push(feature);
					await this.plugin.saveSettings();
					this.display();
				}).open();
			});

			const importBtn = toolbar.createEl("button", { text: "Import" });
			importBtn.addEventListener("click", () => {
				new FeatureImportModal(this.app, async (features) => {
					this.plugin.settings.featureLibrary.push(...features);
					await this.plugin.saveSettings();
					this.display();
				}).open();
			});
		}

		const tsvBtn = toolbar.createEl("button", { text: this.tsvEditorActive ? "Row Editor" : "TSV Editor" });
		tsvBtn.addEventListener("click", () => {
			this.tsvEditorActive = !this.tsvEditorActive;
			this.display();
		});

		if (this.tsvEditorActive) {
			this.renderTsvEditor(containerEl);
			return;
		}

		// Search/filter bar
		const searchBar = containerEl.createDiv({ cls: "biosequence-feature-search" });
		const searchInput = searchBar.createEl("input", {
			type: "text",
			placeholder: "Filter features\u2026",
			cls: "biosequence-feature-search-input",
		}) as HTMLInputElement;
		searchInput.value = this.featureFilter;

		const clearBtn = searchBar.createEl("button", {
			text: "\u00D7",
			cls: "biosequence-feature-search-clear",
			title: "Clear filter",
		});
		clearBtn.style.visibility = this.featureFilter ? "visible" : "hidden";

		// Feature list
		const listContainer = containerEl.createDiv({ cls: "biosequence-feature-list" });

		if (this.plugin.settings.featureLibrary.length === 0) {
			listContainer.createEl("p", {
				text: "No features defined. Click 'Add Feature' or 'Import' to get started.",
				cls: "setting-item-description",
			});
			return;
		}

		for (const feature of this.plugin.settings.featureLibrary) {
			this.renderFeatureRow(listContainer, feature);
		}

		// Filter logic (DOM-based: toggles row visibility without re-rendering)
		const filterRows = (): void => {
			const term = searchInput.value.toLowerCase();
			this.featureFilter = term;
			clearBtn.style.visibility = term ? "visible" : "hidden";
			const rows = listContainer.querySelectorAll<HTMLElement>(".biosequence-feature-row");
			for (const row of Array.from(rows)) {
				const name = row.dataset["featureName"] ?? "";
				const seq = row.dataset["featureSeq"] ?? "";
				row.style.display = (name.includes(term) || seq.includes(term)) ? "" : "none";
			}
		};

		searchInput.addEventListener("input", filterRows);

		clearBtn.addEventListener("click", () => {
			searchInput.value = "";
			this.featureFilter = "";
			filterRows();
			searchInput.focus();
		});

		// Apply persisted filter after rendering all rows
		if (this.featureFilter) {
			filterRows();
		}
	}

	private renderTsvEditor(containerEl: HTMLElement): void {
		const editorContainer = containerEl.createDiv({ cls: "biosequence-feature-list" });

		// Textarea pre-filled with serialized features
		const textarea = editorContainer.createEl("textarea", {
			cls: "biosequence-tsv-editor-textarea",
			placeholder: "Name\tSequence\tType\tColor\tEnabled\nIgk Leader\tMETDTLLLWVLLLWVPGSTGD\taa\t#7eb8da\ttrue",
		});
		textarea.value = serializeFeaturesToTsv(this.plugin.settings.featureLibrary);

		// Intercept Tab key to insert tab character
		textarea.addEventListener("keydown", (e) => {
			if (e.key === "Tab") {
				e.preventDefault();
				const start = textarea.selectionStart;
				const end = textarea.selectionEnd;
				textarea.value = textarea.value.substring(0, start) + "\t" + textarea.value.substring(end);
				textarea.selectionStart = textarea.selectionEnd = start + 1;
				// Trigger input event for live preview
				textarea.dispatchEvent(new Event("input"));
			}
		});

		// Live preview
		const preview = editorContainer.createDiv({ cls: "biosequence-tsv-editor-preview" });

		const updatePreview = (): void => {
			const text = textarea.value.trim();
			if (text.length === 0) {
				preview.textContent = "Empty — all features will be removed on save";
				preview.className = "biosequence-tsv-editor-preview";
				return;
			}
			const result = parseTsvEditorContent(text);
			if (result.errors.length === 0) {
				preview.textContent = `${result.features.length} feature${result.features.length !== 1 ? "s" : ""} parsed (no errors)`;
				preview.className = "biosequence-tsv-editor-preview";
			} else {
				preview.textContent = `${result.features.length} feature${result.features.length !== 1 ? "s" : ""} parsed (${result.errors.length} error${result.errors.length !== 1 ? "s" : ""}): ${result.errors[0]}${result.errors.length > 1 ? ` (+${result.errors.length - 1} more)` : ""}`;
				preview.className = "biosequence-tsv-editor-preview biosequence-tsv-editor-error";
			}
		};

		textarea.addEventListener("input", updatePreview);
		updatePreview(); // Initial preview

		// Action buttons
		const actions = editorContainer.createDiv({ cls: "biosequence-tsv-editor-actions" });

		const cancelBtn = actions.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => {
			this.tsvEditorActive = false;
			this.display();
		});

		const saveBtn = actions.createEl("button", { text: "Save", cls: "mod-cta" });
		saveBtn.addEventListener("click", async () => {
			const text = textarea.value.trim();
			if (text.length === 0) {
				this.plugin.settings.featureLibrary = [];
			} else {
				const result = parseTsvEditorContent(text);
				this.plugin.settings.featureLibrary = result.features;
			}
			await this.plugin.saveSettings();
			this.tsvEditorActive = false;
			this.display();
		});
	}

	private renderFeatureRow(container: HTMLElement, feature: FeatureEntry): void {
		const row = container.createDiv({ cls: "biosequence-feature-row" });
		row.dataset["featureName"] = feature.name.toLowerCase();
		row.dataset["featureSeq"] = feature.sequence.toLowerCase();

		// Enable checkbox
		const checkbox = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
		checkbox.checked = feature.enabled;
		checkbox.addEventListener("change", async () => {
			feature.enabled = checkbox.checked;
			await this.plugin.saveSettings();
		});

		// Color swatch + hidden color input
		const swatch = row.createDiv({ cls: "biosequence-feature-swatch" });
		swatch.style.backgroundColor = feature.color;

		const colorInput = row.createEl("input", { type: "color" }) as HTMLInputElement;
		colorInput.value = feature.color;
		colorInput.style.display = "none";
		colorInput.addEventListener("input", async () => {
			feature.color = colorInput.value;
			swatch.style.backgroundColor = colorInput.value;
			await this.plugin.saveSettings();
		});
		swatch.addEventListener("click", () => colorInput.click());

		// Name
		row.createSpan({ cls: "biosequence-feature-name", text: feature.name });

		// Sequence preview
		const seqPreview =
			feature.sequence.length > 20
				? feature.sequence.substring(0, 20) + "\u2026"
				: feature.sequence;
		row.createSpan({ cls: "biosequence-feature-seq", text: seqPreview });

		// Type badge
		row.createSpan({
			cls: "biosequence-feature-type",
			text: feature.type.toUpperCase(),
		});

		// Edit button
		const editBtn = row.createEl("button", { cls: "biosequence-feature-btn", text: "Edit" });
		editBtn.addEventListener("click", () => {
			new FeatureEditorModal(this.app, feature, async (updated) => {
				const idx = this.plugin.settings.featureLibrary.findIndex(
					(f) => f.id === updated.id
				);
				if (idx >= 0) {
					this.plugin.settings.featureLibrary[idx] = updated;
				}
				await this.plugin.saveSettings();
				this.display();
			}).open();
		});

		// Delete button
		const deleteBtn = row.createEl("button", {
			cls: "biosequence-feature-btn biosequence-feature-btn-danger",
			text: "Del",
		});
		deleteBtn.addEventListener("click", async () => {
			this.plugin.settings.featureLibrary = this.plugin.settings.featureLibrary.filter(
				(f) => f.id !== feature.id
			);
			await this.plugin.saveSettings();
			this.display();
		});
	}
}
