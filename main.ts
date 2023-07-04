import { App, Plugin, PluginSettingTab, Setting, Notice, FileSystemAdapter } from 'obsidian';
import obsidiosaurusProcess from 'src/mainProcessor'
import { Config } from 'src/types'
import pino from 'pino';
import path from 'path';
import { setSettings } from 'config';

export const logger = pino();

export const config: Config = {
	obsidianVaultDirectory: "./vault",
	docusaurusWebsiteDirectory: "./website",
	obsidianAssetSubfolderName: "assets",
	docusaurusAssetSubfolderName: "assets",
	mainLanguage: "en",
	convertedImageType: "webp",
	convertedImageMaxWidth: "2500",
	debug: false,
	developer: false
}

export default class Obsidisaurus extends Plugin {
	settings: Config;

	async onload() {
		await this.loadSettings();
		if (this.settings.debug) {
			logger.info("🟢 Obsidiosaurus Plugin loaded");
		}

		const ribbonIconEl = this.addRibbonIcon('file-up', 'Obsidiosaurus', async (evt: MouseEvent) => {
			try {
				logger.info("🚀 Obsidiosaurus started");
				new Notice("🚀 Obsidiosaurus started")
				// @ts-ignore, it says there is no property basePath, but it is?
				if(this.app.vault.adapter instanceof FileSystemAdapter) {
					const basePath = path.dirname(this.app.vault.adapter.getBasePath());
					await obsidiosaurusProcess(basePath);
				}
			} catch (error) {
				if (this.settings.debug) {
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
		setSettings(this.settings);
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
					'webp': 'WebP',
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
				.setPlaceholder('2500')
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

		containerEl.createEl('h1', { text: 'Dev Options' });

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Better logging for debugging')
			.addToggle((value) => {
				value.setValue(this.plugin.settings.debug).onChange((value) => {
					this.plugin.settings.debug = value;
					this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Developer mode')
			.setDesc('Only for plugin developers')
			.addToggle((value) => {
				value.setValue(this.plugin.settings.debug).onChange((value) => {
					this.plugin.settings.debug = value;
					this.plugin.saveSettings();
				});
			});


	}
}

