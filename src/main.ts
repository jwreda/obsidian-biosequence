import { Plugin } from "obsidian";
import { BiosequenceSettings, DEFAULT_SETTINGS } from "./types";
import { BiosequenceSettingTab } from "./settings";
import { renderAminoAcidBlock } from "./renderers/AminoAcidRenderer";
import { renderNucleotideBlock } from "./renderers/NucleotideRenderer";

export default class BiosequencePlugin extends Plugin {
	settings: BiosequenceSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor("aa", (source, el) => {
			renderAminoAcidBlock(source, el, this.settings);
		});

		this.registerMarkdownCodeBlockProcessor("dna", (source, el) => {
			renderNucleotideBlock(source, el, "dna", this.settings);
		});

		this.registerMarkdownCodeBlockProcessor("rna", (source, el) => {
			renderNucleotideBlock(source, el, "rna", this.settings);
		});

		this.addSettingTab(new BiosequenceSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
