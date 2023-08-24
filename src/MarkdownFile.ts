import * as fs from "fs";
import * as path from "path";
import { CONFIG } from "../main";

/***************************************************************************************************************
 * Class MarkdownFile that represents a Markdown file
 * Includes attributes such as file path, name and modification dates.
 ***************************************************************************************************************/
export class MarkdownFile {
	absolutepath: string;
	relativePath: string;
	dateModified: string;

	constructor(baseFolderPath: string, fullPath: string) {
		this.absolutepath = fullPath;
		this.relativePath = fullPath.replace(baseFolderPath, "");
		this.dateModified = this.getLastModifiedDate();
	}

	/**
	 * getLastModifiedDate fetches the last modified date of the file
	 *
	 * @returns {string} last modification date in ISO8601 format
	 */
	getLastModifiedDate(): string {
		try {
			this.dateModified = fs
				.statSync(this.absolutepath)
				.mtime.toISOString();
			//console.log(`Last modified date for ${this.path}: ${this.dateModified}`);
		} catch (error) {
			console.error(
				`Error getting last modified date for ${this.absolutepath}: ${error}`
			);
		}
		return this.dateModified;
	}

	/**
	 * Deletes file from specified path and removes any empty directories
	 */
	deleteFile(): void {
		try {
			console.log(`Deleting ${this.relativePath}`);
			fs.unlinkSync(this.absolutepath);
			console.log(`${this.relativePath} deleted successfully`);
		} catch (error) {
			console.error(`Error deleting ${this.relativePath}: ${error}`);
		}
	}
}

/***************************************************************************************************************
 * Class MarkdownSourceFile that represents a Markdown file located in Source
 * Includes addtional attribues like fileName, pathSegments, Language, ...
 ***************************************************************************************************************/
export class MarkdownSourceFile extends MarkdownFile {
	fileName: string;
	fileNameSanitized: string;
	fileType: string;
	mainFolder: string;
	parentFolder: string;
	pathSegments: string[];
	language: string;
	isMainLanguage: boolean;
	targetPath: string;

	constructor(baseFolderPath: string, fullPath: string, fileName: string) {
		super(baseFolderPath, fullPath);
		this.fileName = fileName;
	}

	prepareConversion() {
		this.fileNameSanitized = this.sanitizeFileName(this.fileName);
		this.pathSegments = this.segmentPath(this.relativePath);
		this.fileType = this.getType(this.pathSegments[0]);
		this.mainFolder = this.pathSegments[0];
		this.parentFolder = this.getParentFolder(this.pathSegments);
		this.language = this.getLanguage(this.fileName);
		this.isMainLanguage = this.checkIfMainLanguage();
	}

	checkIfMainLanguage() {
		return this.language === CONFIG.mainLanguage;
	}

	sanitizeFileName(fileName: string) {
		return fileName.split("__")[0];
	}

	getType(folderName: string): string {
		let type: string;

		if (folderName.endsWith("__blog")) {
			type = "blogMulti";
		} else if (folderName === "blog") {
			type = "blog";
		} else if (folderName === "docs") {
			type = "docs";
		} else {
			throw new Error("Unknown folder type");
		}

		return type;
	}

	getLanguage(fileName: string) {
		const languageCodeMatch = fileName.match(/__([a-z]{2})(?:\.\w+)?$/i);

		if (languageCodeMatch) {
			const extractedLanguageCode = languageCodeMatch[1].toLowerCase();
			//console.log("Extracted Language Code:", extractedLanguageCode);
			return extractedLanguageCode;
		}

		const defaultLanguageCode = CONFIG.mainLanguage.toLowerCase();
		//console.log("Using Default Language Code:", defaultLanguageCode);
		return defaultLanguageCode;
	}

	getParentFolder(pathSegments: string[]) {
		if (pathSegments.length >= 2) {
			return pathSegments[pathSegments.length - 2];
		} else {
			throw new Error("Expected pathSegments");
		}
	}

	segmentPath(relativePath: string): string[] {
		let segments = relativePath.split(path.sep);
		if (segments[0] === "") {
			segments.shift();
		}
		return segments;
	}

	// Get the main path for Docusaurus where to put file
	getDocusaurusMainPath(): string {
		type FileType = "docs" | "blog" | "blogMulti";

		const fileTypeToPathMap: Record<FileType, string> = {
			docs: this.isMainLanguage
				? ""
				: path.join(
						"i18n",
						this.language,
						"docusaurus-plugin-content-docs",
						"current"
				  ),
			blog: this.isMainLanguage
				? ""
				: path.join(
						"i18n",
						this.language,
						"docusaurus-plugin-content-blog"
				  ),
			blogMulti: this.isMainLanguage
				? ""
				: path.join(
						"i18n",
						this.language,
						`docusaurus-plugin-content-blog-${this.mainFolder}`
				  ),
		};

		return fileTypeToPathMap[this.fileType as FileType];
	}

	// Helper function to handle '+' at the end of the parent folder
	processParentFolderEndsWithPlus(targetPathSegments: string[]): string[] {
		if (this.parentFolder.endsWith("+")) {
			targetPathSegments.pop();

			if (!this.isMainLanguage) {
				targetPathSegments.shift();
			}

			if (targetPathSegments.length > 0) {
				let lastSegment =
					targetPathSegments[targetPathSegments.length - 1];

				if (lastSegment.endsWith("+")) {
					lastSegment = lastSegment.slice(0, -1);
					targetPathSegments[targetPathSegments.length - 1] =
						lastSegment;
				}
			}
		}

		return targetPathSegments;
	}

	// Helper function to ensure the path ends with '.md'
	ensurePathEndsWithMd(relativePathFromSource: string): string {
		if (!relativePathFromSource.endsWith(".md")) {
			relativePathFromSource += ".md";
		}

		return relativePathFromSource;
	}

	getDestinationFilePath(targetFolder: string) {
		const docusaurusMainPath = this.getDocusaurusMainPath();
		let targetPathSegments = this.pathSegments;

		targetPathSegments =
			this.processParentFolderEndsWithPlus(targetPathSegments);

		let relativePathFromSource = targetPathSegments.join(path.sep);

		relativePathFromSource = this.ensurePathEndsWithMd(
			relativePathFromSource
		);

		let destinationFilePath = path.join(
			docusaurusMainPath,
			relativePathFromSource
		);
		this.targetPath = path.join(targetFolder, destinationFilePath);

		return this.targetPath;
	}

	convertMarkdownFile(targetFolder: string) {
		this.prepareConversion();
		let targetPath = this.getDestinationFilePath(targetFolder);
		fs.mkdirSync(path.dirname(targetPath), { recursive: true });
		fs.copyFileSync(this.absolutepath, targetPath);
		//console.log(`Converted: ${sourcePath} to ${targetPath}`);
	}
}
