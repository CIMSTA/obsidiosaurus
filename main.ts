import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { exec } from 'child_process';
import path from 'path';

function runPythonScript(currentFolderPath: string) {
  // Concatenate the folder path with the filename
  const scriptFileName: string = path.join(currentFolderPath, '.obsidian', 'plugins', 'obsidiosaurus', 'obsidiosaurus.py');

  exec(`python ${scriptFileName} "${currentFolderPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script.py: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Error output: ${stderr}`);
      return;
    }
    console.log(`Script output: ${stdout}`);
  });
}


  // Call the runPythonScript function when you want to execute the Python script.
  
interface ObsidiosaurusSettings {
	obsidian_vault_directory: string,
	docusaurus_directory: string,
	ignored_folders: string,
	obsidian_asset_folder_name: string,
	docusaurus_asset_subfolder_name: string,
	i18n_supported: boolean,
	language_separator: string,
	main_language: string,
	secondary_languages: string,
	convert_images: boolean,
	converted_image_type: string,
	converted_image_max_width: string,
	excalidraw: boolean,
	diagram: boolean,
}

const OBSIDIOSAURUS_SETTINGS: ObsidiosaurusSettings = {
	obsidian_vault_directory: "./vault",
	docusaurus_directory: "./docusaurus",
	ignored_folders: ".git,.obsidian",
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
}


export default class Obsidisaurus extends Plugin {
	settings: ObsidiosaurusSettings;

	async onload() {
		await this.loadSettings();
		const basePath = (this.app.vault.adapter as any).basePath

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
			runPythonScript(basePath);

		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, OBSIDIOSAURUS_SETTINGS, await this.loadData());
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
		new Setting(containerEl)
			.setName('Ignored Folders')
			.setDesc('List of folders you dont want to publish')
			.addText(text => text
				.setPlaceholder('Enter folders')
				.setValue(this.plugin.settings.ignored_folders)
				.onChange(async (value) => {
					this.plugin.settings.ignored_folders = value;
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
