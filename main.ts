import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import obsidiosaurusProcess from 'src/mainProcessor'
import { Config } from 'src/types'
import pino from 'pino';

export const logger = pino();

export const config: Config = {
	obsidian_vault_directory: "./vault",
	docusaurus_directory: "./website",
	obsidian_asset_folder_name: "assets",
	docusaurus_asset_subfolder_name: "assets",
	i18n_supported: true,
	language_separator: "__",
	main_language: "en",
	secondary_languages: "de, fr",
	convert_images: true,
	converted_image_type: "webp",
	converted_image_max_width: "2500",
	excalidraw: false,
	diagram: false,
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
				const basePath: string = this.app.vault.adapter.basePath;
				await obsidiosaurusProcess(basePath)
			} catch (error) {
				logger.error(`❌ Obsidiosaurus crashed with error message: \n${error} `);
				new Notice("❌ Obsidiosaurus crashed. \n Check log files for more info")
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
				.setValue(this.plugin.settings.obsidian_vault_directory)
				.onChange(async (value) => {
					this.plugin.settings.obsidian_vault_directory = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Docusaurus Directory')
			.setDesc('Path to your docusaurus instance')
			.addText(text => text
				.setPlaceholder('Enter paths')
				.setValue(this.plugin.settings.docusaurus_directory)
				.onChange(async (value) => {
					this.plugin.settings.docusaurus_directory = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h1', { text: 'Assets' });
		new Setting(containerEl)
			.setName('Obsidian Asset Folder')
			.setDesc('Name of Obsidian Asset Folder')
			.addText(text => text
				.setPlaceholder('Enter folders')
				.setValue(this.plugin.settings.obsidian_asset_folder_name)
				.onChange(async (value) => {
					this.plugin.settings.obsidian_asset_folder_name = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Docusaurus Asset Folder')
			.setDesc('Name of Docusaurus Asset Folder')
			.addText(text => text
				.setPlaceholder('Enter folders')
				.setValue(this.plugin.settings.docusaurus_asset_subfolder_name)
				.onChange(async (value) => {
					this.plugin.settings.docusaurus_asset_subfolder_name = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Image Conversion')
			.setDesc('Enable image conversion')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.convert_images)
				.onChange(async (value) => {
					this.plugin.settings.convert_images = value;
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
				.setValue(this.plugin.settings.converted_image_type)
				.onChange(async (value) => {
					this.plugin.settings.converted_image_type = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Image Width')
			.setDesc('Set the max width for the images in [px]')
			.addText(number => number
				.setPlaceholder('Enter number')
				.setValue(this.plugin.settings.converted_image_max_width)
				.onChange(async (value) => {
					this.plugin.settings.converted_image_max_width = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Excalidraw')
			.setDesc('Enable Excalidraw drawings')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.convert_images)
				.onChange(async (value) => {
					this.plugin.settings.convert_images = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h1', { text: 'Language' });

		new Setting(containerEl)
			.setName('i18n Support')
			.setDesc('Enable 18n support')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.i18n_supported)
				.onChange(async (value) => {
					this.plugin.settings.i18n_supported = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Language Seperator')
			.setDesc('e.g.: note1__en.md')
			.addText(text => text
				.setPlaceholder('Enter seperator')
				.setValue(this.plugin.settings.language_separator)
				.onChange(async (value) => {
					this.plugin.settings.language_separator = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Main Language')
			.setDesc('Your main language code to publish')
			.addText(text => text
				.setPlaceholder('Enter language code')
				.setValue(this.plugin.settings.main_language)
				.onChange(async (value) => {
					this.plugin.settings.main_language = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Docusaurus Asset Folder')
			.setDesc('Name of Docusaurus Asset Folder')
			.addText(text => text
				.setPlaceholder('Enter language codes e.g. "fr,de,.."')
				.setValue(this.plugin.settings.secondary_languages)
				.onChange(async (value) => {
					this.plugin.settings.secondary_languages = value;
					await this.plugin.saveSettings();
				}));

	}
}

