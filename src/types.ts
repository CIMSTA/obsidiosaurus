export interface Config {
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
    debug: true,
}

export interface MainFolder {
    [key: string]: { type: string };
  }

export interface 