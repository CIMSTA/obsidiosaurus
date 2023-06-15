export interface Config {
	obsidianVaultDirectory: string,
	docusaurusWebsiteDirectory: string,
	obsidianAssetSubfolderName: string,
	docusaurusAssetSubfolderName: string,
	mainLanguage: string,
	secondaryLanguages: string,
	convertedImageType: string,
	convertedImageMaxWidth: string,
	debug: true,
}

export interface MainFolder {
	name: string;
	size?: string;
	type: string;
	files: string[];
}

export interface SourceFileInfo {
	fileName: string;
	fileNameClean: string;
	fileExtension: string;
	mainFolder: string;
	parentFolder: string;
	type: string;
	pathSourceAbsolute: string;
	pathSourceRelative: string;
	pathSourceRelativeSplit: string[];
	pathTargetAbsolute: string;
	pathTargetRelative: string;
	dateModified: Date;
	dateModifiedTarget: Date;
	size: number;
	sizeTarget: number;
	language: string;
}

export interface AssetFileInfo {
	fileName: string;
	fileExtension: string;
	fileNameWithExtension: string;
    AssetTypeInDocument: AssetType[];
}

export interface AssetType {
	type: string;
	files: string[];
  }
  

export interface FilesToProcess {
	index: number;
	reason: string;
	pathKey?: string;
}


export interface Admonition{
    type: string;
    title: string;
    whitespaces: number;
}