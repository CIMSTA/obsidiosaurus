export interface Config {
	obsidianVaultDirectory: string;
	docusaurusWebsiteDirectory: string;
	obsidianAssetSubfolderName: string;
	docusaurusAssetSubfolderName: string;
	mainLanguage: string;
	convertedImageType: string;
	convertedImageMaxWidth: string;
	debug: boolean;
	developer: boolean;
}

export let config: Config;

export function setSettings(settings: Config) {
	config = settings;
}
