import { App, PluginSettingTab, Setting } from "obsidian";
import type BiosequencePlugin from "./main";
import { AAColorSchemeId, NucleotideColorSchemeId } from "./types";
import { getAASchemeList, getNucleotideSchemeList } from "./colorSchemes/index";

export class BiosequenceSettingTab extends PluginSettingTab {
	plugin: BiosequencePlugin;

	constructor(app: App, plugin: BiosequencePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Amino Acid Sequences" });

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

		new Setting(containerEl)
			.setName("Assume disulfide bonds")
			.setDesc("For extinction coefficient: assume all Cys pairs form disulfide bonds")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.assumeDisulfideBonds)
					.onChange(async (value) => {
						this.plugin.settings.assumeDisulfideBonds = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h2", { text: "Nucleotide Sequences" });

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

		containerEl.createEl("h2", { text: "Display" });

		new Setting(containerEl)
			.setName("Residues per line")
			.setDesc("Number of residues per line before wrapping (default: 60)")
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
	}
}
