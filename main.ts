import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import obsidiosaurusProcess from 'src/mainProcessor'
import { Config } from 'src/types'
import pino from 'pino';
import path from 'path';

export const logger = pino();

export const config: Config = {
	obsidianVaultDirectory: "./vault",
	docusaurusWebsiteDirectory: "./website",
	obsidianAssetSubfolderName: "assets",
	docusaurusAssetSubfolderName: "assets",
	mainLanguage: "en",
	secondaryLanguages: "de, fr",
	convertedImageType: "webp",
	convertedImageMaxWidth: "2500",
	debug: true
}
export default class Obsidisaurus extends Plugin {
	settings: Config;

	async onload() {
		await this.loadSettings();
		if (config.debug) {
			logger.info("🟢 Obsidiosaurus Plugin loaded");
		}

		const ribbonIconEl = this.addRibbonIcon('file-up', 'Obsidiosaurus', async (evt: MouseEvent) => {
			try {
				logger.info("🚀 Obsidiosaurus started");
				new Notice("🚀 Obsidiosaurus started")
				// @ts-ignore, it says there is no property basePath, but it is?
				const basePath: string = path.dirname(this.app.vault.adapter.basePath);
				await obsidiosaurusProcess(basePath)
			} catch (error) {
				if (config.debug) {
					const errorMessage = `❌ Obsidiosaurus crashed in function with the following error:\n${error.stack}`;
					logger.error(errorMessage);
					new Notice(`❌ Obsidiosaurus crashed. \n${errorMessage}`);
				} else {
					logger.error(`❌ Obsidiosaurus crashed with error message: \n${error} `);
					new Notice("❌ Obsidiosaurus crashed. \n Check log files for more info")
				}
			}
		});

		ribbonIconEl.addClass('my-plugin-ribbon-class');

		this.addSettingTab(new SettingTab(this.app, this));

	}

	onunload() {
		if (config.debug) {
			logger.info('⚪ Obsidiosaurus Plugin unloaded');
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, config, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}


class SettingTab extends PluginSettingTab {
	plugin: Obsidisaurus;

	constructor(app: App, plugin: Obsidisaurus) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h1', { text: 'Directories' });

		new Setting(containerEl)
			.setName('Obsidian Directory')
			.setDesc('Path to your obsidian vault')
			.addText(text => text
				.setPlaceholder('Enter path')
				.setValue(this.plugin.settings.obsidianVaultDirectory)
				.onChange(async (value) => {
					this.plugin.settings.obsidianVaultDirectory = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Docusaurus Directory')
			.setDesc('Path to your docusaurus instance')
			.addText(text => text
				.setPlaceholder('Enter paths')
				.setValue(this.plugin.settings.docusaurusWebsiteDirectory)
				.onChange(async (value) => {
					this.plugin.settings.docusaurusWebsiteDirectory = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h1', { text: 'Assets' });
		new Setting(containerEl)
			.setName('Obsidian Asset Folder')
			.setDesc('Name of Obsidian Asset Folder')
			.addText(text => text
				.setPlaceholder('Enter folders')
				.setValue(this.plugin.settings.obsidianAssetSubfolderName)
				.onChange(async (value) => {
					this.plugin.settings.obsidianAssetSubfolderName = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Docusaurus Asset Folder')
			.setDesc('Name of Docusaurus Asset Folder')
			.addText(text => text
				.setPlaceholder('Enter folders')
				.setValue(this.plugin.settings.docusaurusAssetSubfolderName)
				.onChange(async (value) => {
					this.plugin.settings.docusaurusAssetSubfolderName = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Image Type')
			.setDesc('Format in which to convert all images')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'jpg': 'JPG',
					'webp': 'WebP',
					'png': 'PNG'
				})
				.setValue(this.plugin.settings.convertedImageType)
				.onChange(async (value) => {
					this.plugin.settings.convertedImageType = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Image Width')
			.setDesc('Set the max width for the images in [px]')
			.addText(number => number
				.setPlaceholder('Enter number')
				.setValue(this.plugin.settings.convertedImageMaxWidth)
				.onChange(async (value) => {
					this.plugin.settings.convertedImageMaxWidth = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h1', { text: 'Language' });

		new Setting(containerEl)
			.setName('Main Language')
			.setDesc('Your main language code to publish')
			.addText(text => text
				.setPlaceholder('Enter language code')
				.setValue(this.plugin.settings.mainLanguage)
				.onChange(async (value) => {
					this.plugin.settings.mainLanguage = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Docusaurus Asset Folder')
			.setDesc('Name of Docusaurus Asset Folder')
			.addText(text => text
				.setPlaceholder('Enter language codes e.g. "fr,de,.."')
				.setValue(this.plugin.settings.secondaryLanguages)
				.onChange(async (value) => {
					this.plugin.settings.secondaryLanguages = value;
					await this.plugin.saveSettings();
				}));

	}
}

