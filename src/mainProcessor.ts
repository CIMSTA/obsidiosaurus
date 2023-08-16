import { MainFolder, SourceFileInfo, FilesToProcess, Asset } from "./types";
import processMarkdown from "./markdownProcessor";
import { Notice } from "obsidian";
import { logger } from "main";
import { config } from "config";
import * as fs from "fs";
import * as path from "path";
import util from "util";

////////////////////////////////////////////////////////////////
// MAIN
////////////////////////////////////////////////////////////////

export default async function obsidiosaurusProcess(
	basePath: string
): Promise<boolean> {
	// Docusaurus and Obsidian Vault paths
	const websitePath = path.join(basePath, "website");
	const vaultPath = path.join(basePath, "vault");

	// Get the main folders of the vault e.g. docs, assets, ..
	const mainFolders = getMainfolders(vaultPath);
	mainFolders.forEach((folder) => processSingleFolder(folder, vaultPath));

	// Log folder structure when in debug mode
	if (config.debug) {
		logger.info(
			"📁 Folder structure with Files: %s",
			JSON.stringify(mainFolders)
		);
	}

	// Get all the file info from the main folders and separate assets from other files
	const allInfo = mainFolders.flatMap((folder) =>
		folder.files.map((file) =>
			getSourceFileInfo(basePath, folder, file, vaultPath)
		)
	);
	const allSourceFilesInfo: Partial<SourceFileInfo>[] = allInfo.filter(
		(info) => info.type !== "assets"
	);
	const allSourceAssetsInfo: Partial<SourceFileInfo>[] = allInfo.filter(
		(info) => info.type === "assets"
	);

	// Initialize or read the targetJson and assetJson
	let targetJson: SourceFileInfo[] = await initializeJsonFile(
		path.join(basePath, "allFilesInfo.json")
	);
	let assetJson = await initializeJsonFile(
		path.join(basePath, "assetInfo.json")
	);

	// Verify existence of files in target.json and remove if not present
	targetJson = await checkFilesExistence(targetJson);

	// Check if source files are newer or missing in vault and prepare for deletion
	const filesToDelete = await getFilesToDelete(
		allSourceFilesInfo,
		targetJson
	);

	// Process deletion of files and assets
	await deleteFiles(filesToDelete, targetJson, basePath);
	await removeAssetReferences(filesToDelete, assetJson, websitePath);

	// Write files and assets info to their respective JSON files
	targetJson = await writeJsonToFile(
		path.join(basePath, "allFilesInfo.json"),
		targetJson
	);
	await writeJsonToFile(
		path.join(basePath, "allSourceAssetsInfo.json"),
		allSourceAssetsInfo
	);

	// Compare source and target files to determine which ones to process
	const filesToProcess = await compareSource(allSourceFilesInfo, targetJson);

	// Process markdown conversion if there are files to process
	if (filesToProcess.length > 0) {
		new Notice(`⚙ Processing ${filesToProcess.length} Files`);

		// Get the indices of files to process and filter them from source files
		const filesToProcessIndices = filesToProcess.map((file) => file.index);
		const filesToMarkdownProcess = allSourceFilesInfo.filter((_, index) =>
			filesToProcessIndices.includes(index)
		);

		// Start the actual Markdown conversion and copy to Docusaurus folder
		await copyMarkdownFilesToTarget(
			filesToMarkdownProcess,
			basePath,
			targetJson,
			assetJson
		);

		// Write new allFilesInfo -> Used to compare for next run
		await writeJsonToFile(
			path.join(basePath, "allFilesInfo.json"),
			targetJson
		);
	} else {
		new Notice(`💤 Nothing to process`);
	}

	augmentPathForMacOS();

	// Find all assets that need to be processed and perform the conversion
	const assetsToProcess = await getAssetsToProcess(assetJson, websitePath);
	new Notice(`⚙ Processing ${assetsToProcess.length} Assets`);
	if (assetsToProcess.length > 0) {
		await copyAssetFilesToTarget(
			vaultPath,
			websitePath,
			assetJson,
			assetsToProcess
		);
	}

	// Delete unused markdown files from Docusaurus
	deleteUnusedFiles(targetJson, websitePath);

	logger.info("✅ Obsidiosaurus run successfully");
	new Notice("✅ Obsidiosaurus run successfully");

	return true;
}

////////////////////////////////////////////////////////////////
// UTILS
////////////////////////////////////////////////////////////////

/**
 * Initializes a JSON file with default content if the file does not exist.
 * Reads the file content and returns it as JSON if the file exists.
 *
 * @param {string} filePath - The path to the JSON file.
 * @param {string} defaultContent - The default content to initialize the file with.
 * @returns {Promise<Array>} A promise that resolves with the content of the JSON file as an array.
 */
async function initializeJsonFile(
	filePath: string,
	defaultContent: string = "[]"
) {
	let jsonContent = [];
	try {
		jsonContent = JSON.parse(await fs.promises.readFile(filePath, "utf-8"));
	} catch (error) {
		if (error.code === "ENOENT") {
			await fs.promises.writeFile(filePath, defaultContent);
			console.log(`Created ${filePath}`);
		} else {
			console.error(`Error reading file: ${filePath}`, error);
		}
	}
	return jsonContent;
}

/**
 * Writes JSON content to a file and then reads the file content and returns it as JSON.
 *
 * @param {string} filePath - The path to the JSON file.
 * @param {any} content - The content to be written to the file.
 * @returns {Promise<any>} A promise that resolves with the content of the JSON file.
 */
async function writeJsonToFile(filePath: string, content: any) {
	await fs.promises.writeFile(filePath, JSON.stringify(content, null, 2));
	return JSON.parse(await fs.promises.readFile(filePath, "utf-8"));
}

/**
 * Augments the Obsidian PATH environment variable for macOS to include the Homebrew path if it's not already included.
 */
function augmentPathForMacOS() {
	const os = require("os");

	if (config.debug) {
		logger.info(`🗺️ Current Obsidian ENV PATH: ${process.env.PATH}`);
	}

	if (os.platform() === "darwin") {
		// Add paths for homebrew on Apple Silicion and Intel
		const homebrewPath = "/opt/homebrew/bin:/usr/local/bin/brew";
		//@ts-ignore
		if (!process.env.PATH.includes(homebrewPath)) {
			process.env.PATH = homebrewPath + ":" + process.env.PATH;
			if (config.debug) {
				logger.info(`🗺️ New ENV PATH: ${process.env.PATH}`);
			}
		}
	}
}

////////////////////////////////////////////////////////////////
// FOLDERS
////////////////////////////////////////////////////////////////

function getMainfolders(folderPath: string): MainFolder[] {
	const folders: MainFolder[] = [];
	const absoluteFolderPath = path.resolve(folderPath);

	if (config.debug) {
		logger.info("📁 Processing path: %s", absoluteFolderPath);
	}

	const objects = fs.readdirSync(absoluteFolderPath);
	if (config.debug) {
		logger.info("📂 Found files: %o", objects);
	}
	objects.forEach((object) => {
		const filePath = path.join(absoluteFolderPath, object);
		const stats = fs.statSync(filePath);

		if (stats.isDirectory()) {
			let type: string | undefined;
			if (object.endsWith("__blog")) {
				type = "blogMulti";
			} else if (object.includes("blog")) {
				type = "blog";
			} else if (object.includes("docs")) {
				type = "docs";
			} else if (object.includes(config.obsidianAssetSubfolderName)) {
				type = "assets";
			} else {
				type = "ignore";
			}

			if (type !== "ignore" && type !== undefined) {
				const folderObject: MainFolder = {
					name: object,
					type: type,
					files: [],
				};
				folders.push(folderObject);
			}

			if (config.debug) {
				logger.info("🔍 File: %s, Type: %s", object, type);
			}
		}
	});

	if (config.debug) {
		logger.info("📤 Returning folders: %o", folders);
	}
	return folders;
}

function searchFilesInFolder(directory: string): string[] {
	let results: string[] = [];
	let skipFiles = ".DS_Store";
	const files = fs.readdirSync(directory);

	files.forEach((file) => {
		if (skipFiles.includes(file)) {
			if (config.debug) {
				logger.info(`⏭️ Skipped ${file}`);
			}
			return;
		}

		const filePath = path.join(directory, file);
		const stat = fs.statSync(filePath);

		if (stat && stat.isDirectory()) {
			results = results.concat(searchFilesInFolder(filePath));
		} else {
			results.push(filePath);
		}
	});

	return results;
}

function processSingleFolder(folder: MainFolder, basePath: string): void {
	const dirPath = path.join(basePath, folder.name);
	const files = searchFilesInFolder(dirPath);
	folder.files = files;

	if (config.debug) {
		logger.info(
			"📄 Vault Files for %s: %s",
			folder.name,
			JSON.stringify(files)
		);
	}
}

async function deleteParentDirectories(filepath: string) {
	let dirPath = path.dirname(filepath);
	while (dirPath !== path.dirname(dirPath)) {
		// while dirPath has a parent directory
		try {
			await fs.promises.rmdir(dirPath);
			if (config.debug) {
				logger.info(`🧨 Successfully deleted directory ${dirPath}`);
			}
		} catch (error) {
			// Ignore the error if the directory is not empty
			if (
				error.code !== "ENOTEMPTY" &&
				error.code !== "EEXIST" &&
				error.code !== "EPERM"
			) {
				logger.info(
					`❌ Failed to delete directory ${dirPath}: ${error}`
				);
			}
			return;
		}
		dirPath = path.dirname(dirPath);
	}
}

async function ensureDirectoryExistence(filePath: string) {
	const dir = path.dirname(filePath);

	if (fs.existsSync(dir)) {
		return true;
	}

	await fs.promises.mkdir(dir, { recursive: true });
}

async function compareSource(
	sourceJson: Partial<SourceFileInfo>[],
	targetJson: Partial<SourceFileInfo>[]
): Promise<FilesToProcess[]> {
	const filesToProcess: FilesToProcess[] = [];

	// Iterate over sourceJson files
	sourceJson.forEach((sourceFile, i) => {
		// Find a matching file in targetJson
		const matchingTargetFile = targetJson.find(
			(file) => file.pathSourceRelative === sourceFile.pathSourceRelative
		);

		// Add to the filesToProcess array if no matching file is found
		if (!matchingTargetFile) {
			filesToProcess.push({
				index: i,
				reason: "Does not exist in targetJson",
			});
			if (config.debug) {
				logger.info(
					"📝 File to process: %s",
					sourceFile.pathSourceRelative
				);
			}
		}
	});

	return filesToProcess;
}

////////////////////////////////////////////////////////////////
// FILES
////////////////////////////////////////////////////////////////

function getSourceFileInfo(
	basePath: string,
	folder: MainFolder,
	filePath: string,
	vaultPath: string
): Partial<File> {
	filePath = path.resolve(filePath);
	const stats = fs.statSync(filePath);
	const fileName = path.basename(filePath);

	const { fileNameClean, fileExtension, language } =
		sanitizeFileName(fileName);

	const pathSourceRelative = path.relative(vaultPath, filePath);

	let sourceFileInfo: Partial<SourceFileInfo> = {
		fileName,
		fileNameClean,
		fileExtension,
		language,
		mainFolder: folder.name,
		parentFolder: path.basename(path.dirname(filePath)),
		pathSourceAbsolute: filePath,
		pathSourceRelative,
		dateModified: stats.mtime,
		size: stats.size,
		type: folder.type,
	};

	sourceFileInfo = getTargetPath(sourceFileInfo, basePath);

	return sourceFileInfo;
}

function sanitizeFileName(fileName: string): {
	fileNameClean: string;
	fileExtension: string;
	language: string;
} {
	const parsedPath = path.parse(fileName);
	const fileNameWithoutExtension = parsedPath.name;
	const fileExtension = parsedPath.ext;

	let fileNameClean = fileNameWithoutExtension;

	const languageMatch = fileNameClean.match(/__([a-z]{2})$/i);
	let language = null;
	if (languageMatch) {
		fileNameClean = fileNameClean.split("__")[0];
		language = languageMatch ? languageMatch[1] : null;
	}

	if (language === null) {
		if (config && config.mainLanguage) {
			language = config.mainLanguage;
		} else {
			const errorMessage =
				"❌ Main language not defined in the configuration";
			logger.error(errorMessage);
			throw new Error(errorMessage);
		}
	}

	return { fileNameClean: fileNameClean.trim(), fileExtension, language };
}

/**
 * Constructs target path for a given source file.
 *
 * This function uses the properties of the source file, particularly its type,
 * language, and other properties, to construct the path where it should be placed
 * in the target directory.
 *
 * @param {Partial<SourceFileInfo>} sourceFileInfo - An object that contains information about the source file.
 * @param {string} basePath - The base path where the files will be placed.
 * @returns {Partial<SourceFileInfo>} - An object that contains the original information plus the target path.
 * @throws {Error} - If a required property is missing in the sourceFileInfo object.
 */
function getTargetPath(
	sourceFileInfo: Partial<SourceFileInfo>,
	basePath: string
): Partial<SourceFileInfo> {
	const {
		type,
		language,
		pathSourceRelative,
		mainFolder,
		parentFolder,
		fileExtension,
	} = sourceFileInfo;

	// Check if all required properties exist
	if (
		!type ||
		!language ||
		!pathSourceRelative ||
		!parentFolder ||
		!fileExtension ||
		!mainFolder
	) {
		logger.error("🚨 Required properties missing on sourceFileInfo");
		throw new Error("Missing required properties on sourceFileInfo");
	}

	// Check if main language is used
	const isMainLanguage = language === config.mainLanguage;

	const mainPathDict = {
		docs: isMainLanguage
			? ""
			: path.join(
					"i18n",
					language,
					"docusaurus-plugin-content-docs",
					"current"
			  ),
		blog: isMainLanguage
			? ""
			: path.join("i18n", language, "docusaurus-plugin-content-blog"),
		blogMulti:
			isMainLanguage || !mainFolder
				? ""
				: path.join(
						"i18n",
						language,
						`docusaurus-plugin-content-blog-${mainFolder}`
				  ),
		assets: path.join("static", config.docusaurusAssetSubfolderName),
	};

	// Get the main path from the dictionary
	//@ts-ignore
	const mainPath = mainPathDict[type] || "";

	// Construct final relative source path
	let finalPathSourceRelative = pathSourceRelative;

	if (parentFolder.endsWith("+")) {
		const pathParts = finalPathSourceRelative.split(path.sep);

		// If parent folder name ends with '+', remove the last part of the path
		pathParts.pop();

		// To remove e.g. "docs" from relative path -> otherwise "i18n/language/docusaurus-plugin-content-docs/current/docs<- remove/...
		if (!isMainLanguage) {
			pathParts.shift();
		}

		if (pathParts.length > 0) {
			let lastPart = pathParts[pathParts.length - 1];

			// Remove '+' from the end of the parent folder
			if (lastPart.endsWith("+")) {
				lastPart = lastPart.slice(0, -1);
				pathParts[pathParts.length - 1] = lastPart;
			}

			finalPathSourceRelative = pathParts.join(path.sep) + fileExtension;
		}
	}

	// Remove the language + seperator from final path
	finalPathSourceRelative = finalPathSourceRelative.replace(
		`__${language}`,
		""
	);

	// If the file is a .yml.md file, remove the .md part
	if (finalPathSourceRelative.endsWith(".yml.md")) {
		finalPathSourceRelative = finalPathSourceRelative.replace(
			".yml.md",
			".yml"
		);
	}

	// Construct target relative and absolute paths
	sourceFileInfo.pathTargetRelative = path.join(
		mainPath,
		finalPathSourceRelative
	);
	sourceFileInfo.pathTargetAbsolute = path.join(
		basePath,
		config.docusaurusWebsiteDirectory,
		sourceFileInfo.pathTargetRelative
	);

	return sourceFileInfo;
}
/**
 * This asynchronous function compares source and target files to identify files that need to be deleted.
 *
 * @param {Partial<SourceFileInfo>[]} allSourceFilesInfo - Array of source files information. Each object containing details about a source file
 * @param {SourceFileInfo[]} targetJson - Array of target files information. Each element is an object containing details about a file from the target.
 * @return {Promise<FilesToProcess[]>} - A promise that resolves with an array of objects containing indices of files to delete and the reasons for
 * their deletion. Each object has two properties: 'index' and 'reason'.
 *
 * @async
 *
 * 1) This function iterates over each file in the 'targetJson' array and attempts to find a matching file in the 'allSourceFilesInfo' array based on
 * their relative paths. If no matching source file is found, it implies that the target file should be deleted, and it is added to the 'filesToDelete'
 * array with the reason "it does not exist in sourceJson".
 *
 * 2) If a matching source file is found, their modification dates are compared. If the source file has a more recent modification date than the target file,
 * it implies that the target file should be updated. As a part of the update process, the older target file needs to be deleted first,
 * so it is added to the 'filesToDelete' array with the reason "its last modification date is older than the date in sourceJson".
 * The function returns a promise that resolves with the 'filesToDelete' array.
 */
async function getFilesToDelete(
	allSourceFilesInfo: Partial<SourceFileInfo>[],
	targetJson: SourceFileInfo[]
): Promise<FilesToProcess[]> {
	// Load JSON data

	const sourceJson: Partial<SourceFileInfo>[] = allSourceFilesInfo;

	const filesToDelete: FilesToProcess[] = [];

	// Iterate over targetJson files
	targetJson.forEach((targetFile, i) => {
		// Find a matching file in sourceJson
		const matchingSourceFile = sourceJson.find(
			(file) => file.pathSourceRelative === targetFile.pathSourceRelative
		);

		// Create Date objects from dateModified strings
		const targetDate = new Date(targetFile.dateModified);
		const sourceDate = matchingSourceFile?.dateModified
			? new Date(matchingSourceFile.dateModified)
			: null;

		// Add to the filesToDelete array based on certain conditions
		if (!matchingSourceFile) {
			filesToDelete.push({
				index: i,
				reason: "it does not exist in sourceJson",
				pathKey: targetFile.pathSourceRelative,
			});
			if (config.debug) {
				logger.info(
					"🗑️ File to delete: %s",
					targetFile.pathSourceRelative
				);
			}
		} else if (sourceDate && targetDate.getTime() < sourceDate.getTime()) {
			filesToDelete.push({
				index: i,
				reason: `its last modification date ${targetDate} is older than the date in sourceJson ${sourceDate}`,
				pathKey: targetFile.pathSourceRelative,
			});
			if (config.debug) {
				logger.info(
					"🔄 File to update: %s, Target: %s Source: %s",
					targetFile.pathSourceRelative,
					targetDate,
					sourceDate
				);
			}
		}
	});

	return filesToDelete;
}

async function deleteFiles(
	filesToDelete: FilesToProcess[],
	targetJson: SourceFileInfo[],
	basePath: string
) {
	const errors: Error[] = [];

	// Sort filesToDelete in descending order based on index
	filesToDelete.sort((a, b) => b.index - a.index);

	// Delete files
	for (const fileToDelete of filesToDelete) {
		const targetFile = targetJson[fileToDelete.index];

		try {
			await fs.promises.unlink(
				path.join(basePath, targetFile.pathTargetRelative)
			);
			if (config.debug) {
				logger.info(
					`✅ Successfully deleted file %s`,
					targetFile.pathTargetRelative
				);
			}
			await deleteParentDirectories(
				path.join(basePath, targetFile.pathTargetRelative)
			);

			// Remove the deleted file from targetJson immediately after successful deletion
			targetJson.splice(fileToDelete.index, 1);
		} catch (error) {
			// If error code is ENOENT, the file was not found, which we consider as a successful deletion.
			if (error.code !== "ENOENT") {
				logger.error(
					`❌ Failed to delete file %s: %s`,
					targetFile.pathTargetRelative,
					error
				);
				errors.push(error);
				continue; // If deletion failed for other reasons, we keep the file in targetJson.
			}
			if (config.debug) {
				logger.info(
					`🗑️ File %s was not found, considered as deleted`,
					targetFile.pathTargetRelative
				);
			}
			targetJson.splice(fileToDelete.index, 1);
		}
	}
}

async function checkFilesExistence(
	targetJson: SourceFileInfo[]
): Promise<SourceFileInfo[]> {
	const existentFiles = await Promise.all(
		targetJson.map(async (fileInfo) => {
			try {
				await fs.promises.access(fileInfo.pathTargetAbsolute);
				const stats = await fs.promises.stat(
					fileInfo.pathTargetAbsolute
				);
				fileInfo.dateModifiedTarget = stats.mtime;
				fileInfo.sizeTarget = stats.size;
				return fileInfo;
			} catch (err) {
				if (err.code !== "ENOENT") {
					throw err; // re-throw unexpected errors
				}
				// File doesn't exist, return null
				console.log(`File not fond: ${fileInfo.pathSourceRelative}`);
				return null;
			}
		})
	);
	const len = existentFiles.length;
	// Filter out null entries (i.e., non-existent files)
	const files = existentFiles.filter((fileInfo) => fileInfo !== null);

	if (config.debug) {
		logger.info("Removed %i Files", len - files.length);
	}

	return files as SourceFileInfo[];
}

export function deleteUnusedFiles(json: SourceFileInfo[], websitePath: string) {
	const targetDirectories = ["blog", "i18n", "docs"];
	const blogSuffix = "__blog";

	let filesFound: string[] = [];

	function exploreDirectory(directory: string) {
		const entries = fs.readdirSync(directory, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				exploreDirectory(fullPath);
			} else if (entry.isFile()) {
				filesFound.push(fullPath);
			}
		}
	}

	// Scan each target directory
	targetDirectories.forEach((dir) => {
		const dirPath = path.join(websitePath, dir);
		if (fs.existsSync(dirPath)) {
			exploreDirectory(dirPath);
		}
	});

	// Go through other directories and look for blogSuffix folders
	const allDirectories = fs.readdirSync(websitePath, { withFileTypes: true });
	const otherDirectories = allDirectories.filter((dir) =>
		dir.name.endsWith(blogSuffix)
	);

	otherDirectories.forEach((dir) => {
		const dirPath = path.join(websitePath, dir.name);
		exploreDirectory(dirPath);
	});

	// Iterate through filesFound and check against the json
	filesFound.forEach(async (file) => {
		const fileIsUsed = json.some((j) => j.pathTargetAbsolute === file);

		// Delete the file if it's not used
		if (!fileIsUsed) {
			await fs.promises.unlink(file);
			console.log(`Deleted unused file: ${file}`);
		}
	});
}

////////////////////////////////////////////////////////////////
// Markdown Conversion
////////////////////////////////////////////////////////////////

async function copyMarkdownFilesToTarget(
	files: Partial<SourceFileInfo>[],
	basePath: string,
	targetJson: Partial<SourceFileInfo>[],
	assetJson: Asset[]
) {
	const results: SourceFileInfo[] = [];

	const promises = files.map(async (file) => {
		const { pathTargetAbsolute, pathSourceAbsolute, pathSourceRelative } =
			file;
		// Ensure the directory exists

		if (pathTargetAbsolute && pathSourceAbsolute && pathSourceRelative) {
			await ensureDirectoryExistence(pathTargetAbsolute);

			const sourceContent = await fs.promises.readFile(
				pathSourceAbsolute,
				"utf-8"
			);
			// Actual markdown conversion process
			const transformedContent = await processMarkdown(
				pathSourceRelative,
				sourceContent,
				assetJson
			);
			if (transformedContent) {
				await fs.promises.writeFile(
					pathTargetAbsolute,
					String(transformedContent)
				);
			}

			if (config.debug) {
				logger.info(
					`📤 Converted file from ${pathSourceAbsolute} to ${pathTargetAbsolute}`
				);
			}
		}

		results.push(file as SourceFileInfo);
	});

	// Wait for all copy operations to finish
	await Promise.all(promises);

	// Add results to targetJson
	targetJson.push(...results);

	await fs.promises.writeFile(
		path.join(basePath, "assetInfo.json"),
		JSON.stringify(assetJson, null, 2)
	);
}

////////////////////////////////////////////////////////////////
// Asset
////////////////////////////////////////////////////////////////

async function removeAssetReferences(
	filesToDelete: FilesToProcess[],
	assetJson: Asset[],
	websitePath: string
): Promise<Asset[]> {
	for (const fileToDelete of filesToDelete) {
		if (!fileToDelete.pathKey) {
			continue;
		}

		// Iterate backwards through each asset in the json
		for (
			let assetIndex = assetJson.length - 1;
			assetIndex >= 0;
			assetIndex--
		) {
			const asset = assetJson[assetIndex];

			// Iterate backwards through each size in the asset
			for (
				let sizeIndex = asset.sizes.length - 1;
				sizeIndex >= 0;
				sizeIndex--
			) {
				const size = asset.sizes[sizeIndex];

				// Find the index of the filePath in inDocuments array
				const docIndex = size.inDocuments.indexOf(fileToDelete.pathKey);

				// If the filePath is found in the inDocuments array
				if (docIndex !== -1) {
					// Remove the filePath from inDocuments array
					size.inDocuments.splice(docIndex, 1);
					if (config.debug) {
						logger.info(
							`🗑 Removed filePath from inDocuments: ${fileToDelete.pathKey}`
						);
					}
					// If inDocuments array is empty, remove the size entry
					if (size.inDocuments.length === 0) {
						const assetToRemove = size.newName;
						await removeAssetFromTarget(
							assetToRemove,
							config.docusaurusAssetSubfolderName,
							websitePath
						);

						asset.sizes.splice(sizeIndex, 1);
						if (config.debug) {
							logger.info(
								`🔥 Removed size from sizes: ${size.size}`
							);
						}
					}
				}
			}

			// If sizes array is empty, remove the asset entry
			if (asset.sizes.length === 0) {
				assetJson.splice(assetIndex, 1);
				if (config.debug) {
					logger.info(
						`💥 Removed asset from assetJson: ${asset.fileName}`
					);
				}
			}
		}
	}

	return assetJson;
}

async function removeAssetFromTarget(
	assetToRemove: string[],
	docusaurusAssetSubfolderName: string,
	websitePath: string
): Promise<void> {
	for (const asset of assetToRemove) {
		const assetPath = path.join(
			websitePath,
			"static",
			docusaurusAssetSubfolderName,
			asset
		);
		try {
			await fs.promises.unlink(assetPath);
			if (config.debug) {
				logger.info(`🗑 Removed asset: ${assetPath}`);
			}
		} catch (error) {
			if (config.debug) {
				logger.error(`❌ Error removing asset: ${assetPath}`, error);
			}
		}
	}
}

const copyFile = util.promisify(fs.copyFile);
const mkdir = util.promisify(fs.mkdir);

async function copyAssetFilesToTarget(
	vaultPathPath: string,
	websitePath: string,
	assetJson: Asset[],
	assetsToProcess: { assetIndex: number; sizeIndex: number; path: string }[]
): Promise<void> {
	const docusaurusAssetFolderPath = path.join(
		websitePath,
		"static",
		config.docusaurusAssetSubfolderName
	);
	await mkdir(docusaurusAssetFolderPath, { recursive: true });
	for (const assetToProcess of assetsToProcess) {
		// Use the indexes to find the original asset and size
		const asset = assetJson[assetToProcess.assetIndex];
		const size = asset.sizes[assetToProcess.sizeIndex];

		// Build the original file path
		const originalFilePath = path
			.join(
				vaultPathPath,
				config.obsidianAssetSubfolderName,
				asset.originalFileName
			)
			.replace(/%20/g, " ");

		for (const newName of size.newName) {
			const newFilePath = path.join(docusaurusAssetFolderPath, newName);

			// Check if it's an image
			if (
				["jpg", "png", "webp", "jpeg", "bmp", "gif"].includes(
					asset.fileExtension
				)
			) {
				try {
					// If size is standard, there is no resize needed for gifs, just increase file size
					if (
						size.size === "standard" &&
						asset.fileExtension === "gif"
					) {
						await fs.copyFileSync(originalFilePath, newFilePath);
						if (config.debug) {
							logger.info(
								`Image copied from ${originalFilePath} to ${newFilePath}`
							);
						}
					} else {
						await resizeImage(
							originalFilePath,
							newFilePath,
							size.size
						);
						if (config.debug) {
							logger.info(
								`Image resized and copied from ${originalFilePath} to ${newFilePath}`
							);
						}
					}
				} catch (error) {
					if (config.debug) {
						logger.info(
							`Failed to resize image and copy from ${originalFilePath} to ${newFilePath}: ${error.message}`
						);
					}
				}
			} else if (asset.fileExtension == "svg") {
				await copySVG(originalFilePath, newFilePath);
			} else if ([asset.fileExtension].includes("excalidraw")) {
				await copyExcalidraw(originalFilePath, newFilePath);
			} else {
				// Copy the file to the new location
				try {
					await copyFile(originalFilePath, newFilePath);
					if (config.debug) {
						logger.info(
							`File copied from ${originalFilePath} to ${newFilePath}`
						);
					}
				} catch (error) {
					if (config.debug) {
						logger.error(
							`Failed to copy file from ${originalFilePath} to ${newFilePath}: ${error.message}`
						);
					}
				}
			}
		}
	}
}

async function copySVG(originalFilePath: string, newFilePath: string) {
	await copyFile(originalFilePath, newFilePath);
}

async function copyExcalidraw(originalFilePath: string, newFilePath: string) {
	const filePath = originalFilePath.replace(".md", "");
	const newDarkFilePath = newFilePath.replace(".light", ".dark");
	const darkFilePath = filePath + ".dark.svg";
	await copyFile(darkFilePath, newDarkFilePath);

	const lightFilePath = filePath + ".light.svg";
	await copyFile(lightFilePath, newFilePath);
}

// Intitalize GraphicksMagic
const gm = require("gm").subClass({ imageMagick: "7+" });

async function resizeImage(
	originalFilePath: string,
	newFilePath: string,
	size: string
): Promise<void> {
	const widthOriginal: number = await getImageWidth(originalFilePath);
	let width: number;
	let height: string | number;
	let auto = true;

	if (size === "standard") {
		width = Math.min(
			widthOriginal,
			parseInt(config.convertedImageMaxWidth)
		);
		height = ""; // auto height
	} else {
		const dimensions = size.split("x");
		width = parseInt(dimensions[0]);
		height = dimensions.length > 1 ? parseInt(dimensions[1]) : "";
		if (height) {
			auto = false;
		}
	}

	let imageProcess = gm(originalFilePath).coalesce();

	if (auto) {
		imageProcess = imageProcess.resize(width, height);
	} else {
		imageProcess = imageProcess.resize(width, height, "!");
	}

	imageProcess.write(newFilePath, function (err: Error) {
		if (err) logger.error(err);
	});
}

function getImageWidth(imagePath: string): Promise<number> {
	return new Promise((resolve, reject) => {
		//@ts-ignore
		gm(imagePath).size((err: Error, size) => {
			if (err) {
				logger.error("Error getting image width: ", err);
				reject(err);
			} else {
				resolve(size.width);
			}
		});
	});
}

async function getAssetsToProcess(
	assetJson: Asset[],
	websitePath: string
): Promise<{ assetIndex: number; sizeIndex: number; path: string }[]> {
	const documents = [];

	// Loop through all assets
	for (const [assetIndex, asset] of assetJson.entries()) {
		// Loop through all sizes of each asset
		for (const [sizeIndex, size] of asset.sizes.entries()) {
			// Add all documents for each size to the array, along with the asset and size index
			for (const name of size.newName) {
				documents.push({ assetIndex, sizeIndex, path: name });
			}
		}
	}

	// Check if each document exists, if it does remove it from the array
	const assetsToProcess = documents.filter((document) => {
		const fileExists = fs.existsSync(
			path.join(
				websitePath,
				"static",
				config.docusaurusAssetSubfolderName,
				document.path
			)
		);

		if (!fileExists && config.debug) {
			logger.info(`File ${document.path} does not exist.`);
		}
		return !fileExists; // Only keep it in the array if the file does not exist
	});
	return assetsToProcess;
}
