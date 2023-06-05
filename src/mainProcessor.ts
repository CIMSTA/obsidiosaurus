import { MainFolder, SourceFileInfo } from "./types";
import { Notice } from 'obsidian';
import { logger } from 'main';
// When you use export default in a module, that module becomes an object and what you're exporting becomes a property of that object.
// import { logger } from 'main';
// instead of 
// import logger from 'main';
import * as fs from 'fs';
import * as path from 'path';
import { config } from "main";

import * as readline from 'readline';

export default async function obsidiosaurusProcess(basePath: string): Promise<boolean> {

    // Get main folders and files



    const mainFolders = getMainfolders(basePath);
    mainFolders.forEach(folder => processSingleFolder(folder, basePath));

    if (config.debug) {
        logger.info('📁 Folder structure with Files: %s', JSON.stringify(mainFolders));
    }

    // Extract file info
    const allInfo = mainFolders.flatMap(folder => folder.files.map(file => getSourceFileInfo(basePath, folder, file)));

    // Separate assets from other files
    const allSourceFilesInfo = allInfo.filter(info => info.type !== 'assets');
    const allSourceAssetsInfo = allInfo.filter(info => info.type === 'assets');

    let targetJson: SourceFileInfo[];
    try {
        const jsonData = await fs.promises.readFile('allFilesInfo.json', 'utf-8');
        targetJson = JSON.parse(jsonData);
    } catch (error) {
        console.error('Error reading file:', error);
        targetJson = []; // Provide an empty JSON array as the default value
    }

    // Collect files to delete
    targetJson = await checkFilesExistence(targetJson)
    const filesToDelete = await getFilesToDelete(allSourceFilesInfo, targetJson);
    const deletionPromises = filesToDelete.map(fileToDelete => deleteFile(fileToDelete, targetJson, basePath));
    await Promise.all(deletionPromises);

    // Copy files to target
    //await copyFilesToTarget(allSourceFilesInfo, basePath);

    // Write files
    await fs.promises.writeFile('allFilesInfo.json', JSON.stringify(targetJson, null, 2));
    targetJson = JSON.parse(await fs.promises.readFile('allFilesInfo.json', 'utf-8'));


    const filesToProcess = await compareSource(allSourceFilesInfo, targetJson);

    if (filesToProcess.length == 0) {
        new Notice(`💤 Nothing to process`)
        return true;
    }
    new Notice(`⚙ Processing ${filesToProcess.length} Files`)

    // Get the indices of files to process
    const filesToProcessIndices = filesToProcess.map(file => file.index);

    // Filter allSourceFilesInfo to only include files to process
    const filesToCopy = allSourceFilesInfo.filter((_, index) => filesToProcessIndices.includes(index));

    // Now only files to process will be copied
    await copyFilesToTarget(filesToCopy, basePath, targetJson);

    await fs.promises.writeFile('allFilesInfo.json', JSON.stringify(targetJson, null, 2));

    //await Promise.all([
    //fs.promises.writeFile('allFilesInfo_.json', JSON.stringify(allSourceFilesInfo, null, 2)),
    //fs.promises.writeFile('allAssetsInfo_.json', JSON.stringify(allSourceAssetsInfo, null, 2))
    //]);

    logger.info("✅ Obsidiosaurus run successfully");
    new Notice("✅ Obsidiosaurus run successfully")

    return true;
}

////////////////////////////////////////////////////////////////
// FOLDERS
////////////////////////////////////////////////////////////////

function getMainfolders(folderPath: string): MainFolder[] {
    const folders: MainFolder[] = [];
    const absoluteFolderPath = path.resolve(folderPath);

    logger.info('📁 Processing path: %s', absoluteFolderPath);

    const objects = fs.readdirSync(absoluteFolderPath);
    if (config.debug) {
        logger.info('📂 Found files: %o', objects);
    }
    objects.forEach(object => {
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
            } else if (object.includes(config.obsidian_asset_folder_name)) {
                type = "assets";
            } else {
                type = "ignore";
            }

            if (type !== "ignore" && type !== undefined) {
                const folderObject: MainFolder = {
                    name: object,
                    type: type,
                    files: []
                };
                folders.push(folderObject);
            }

            if (config.debug) {
                logger.info('🔍 File: %s, Type: %s', object, type);
            }
        }
    });

    logger.info('📤 Returning folders: %o', folders);
    return folders;
}

function searchFilesInFolder(directory: string): string[] {
    let results: string[] = [];
    const files = fs.readdirSync(directory);

    files.forEach(file => {
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
        logger.info('📄 Vault Files for %s: %s', folder.name, JSON.stringify(files));
    }
}

////////////////////////////////////////////////////////////////
// FILES
////////////////////////////////////////////////////////////////

function getSourceFileInfo(basePath: string, folder: MainFolder, filePath: string): Partial<File> {
    filePath = path.resolve(filePath);
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);

    // check for _category_.yml.md
    // TODO add 

    const { fileNameClean, fileExtension, language } = sanitizeFileName(fileName);

    const pathSourceRelative = path.relative(basePath, filePath); // basePath is defined in outer scope.

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
        type: folder.type // Assuming type is defined in the MainFolder interface.
    };

    sourceFileInfo = getTargetPath(sourceFileInfo, basePath)

    return sourceFileInfo;
}

function sanitizeFileName(fileName: string): { fileNameClean: string, fileExtension: string, language: string } {
    const parsedPath = path.parse(fileName);
    const fileNameWithoutExtension = parsedPath.name;
    const fileExtension = parsedPath.ext;

    let fileNameClean = fileNameWithoutExtension;

    const languageMatch = fileNameClean.match(/__([a-z]{2})$/i);
    let language = null;
    if (languageMatch) {
        fileNameClean = fileNameClean.split('__')[0];
        language = languageMatch ? languageMatch[1] : null;
    }

    if (language === null) {
        if (config && config.main_language) {
            language = config.main_language;
        } else {
            const errorMessage = '❌ Main language not defined in the configuration';
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }
    }

    return { fileNameClean: fileNameClean.trim(), fileExtension, language };
}

function getTargetPath(sourceFileInfo: Partial<SourceFileInfo>, basePath: string): Partial<SourceFileInfo> {
    const { type, language, pathSourceRelative, mainFolder, parentFolder, fileExtension } = sourceFileInfo;
    const docusaurusRelativePathToVault = `..\\${config.docusaurus_directory}\\`;

    if (!type || !language || !pathSourceRelative || !parentFolder || !fileExtension || !mainFolder) {
        logger.error('🚨 Required properties missing on sourceFileInfo');
        throw new Error('Missing required properties on sourceFileInfo');
    }

    // Check if main language is used
    const isMainLanguage = language === config.main_language;

    // Construct main path depending on the file type
    const mainPathDict = {
        'docs': isMainLanguage ? "" : `i18n\\${language}\\docusaurus-plugin-content-docs\\current`,
        'blog': isMainLanguage ? "" : `i18n\\${language}\\docusaurus-plugin-content-blog\\current`,
        'blogMulti': isMainLanguage || !mainFolder ? "" : `i18n\\${language}\\docusaurus-plugin-content-blog-${mainFolder}`,
        'assets': `static\\${config.docusaurus_asset_subfolder_name}`,
    };

    //@ts-ignore
    const mainPath = mainPathDict[type] || "";

    if (config.debug) {
        logger.info('🔍 File: %s, Type: %s, Main Path: %s', pathSourceRelative, type, mainPath);
    }

    let finalPathSourceRelative = pathSourceRelative;

    if (parentFolder.endsWith('+')) {

        const pathParts = finalPathSourceRelative.split("\\");

        pathParts.pop();
        console.log(pathParts)

        if (pathParts.length > 0) {

            let lastPart = pathParts[pathParts.length - 1];
            console.log(lastPart)

            // Remove '+' from the end of the parent folder
            if (lastPart.endsWith('+')) {
                lastPart = lastPart.slice(0, -1);
                console.log(lastPart)
                pathParts[pathParts.length - 1] = lastPart;  // update the lastpart in the path array
            }

            finalPathSourceRelative = pathParts.join("\\") + fileExtension;

            if (config.debug) {
                logger.info('🔧 Removed Parent Folder: New Path: %s', finalPathSourceRelative);
            }
        }
    }

    // Remove language from path
    finalPathSourceRelative = finalPathSourceRelative.replace(`__${language}`, "");

    // Remove .md ending from .yml file
    if (finalPathSourceRelative.endsWith(".yml.md")) {
        finalPathSourceRelative = finalPathSourceRelative.replace(".yml.md", ".yml");
        if (config.debug) {
            logger.info('🔧 Removed .md from .yml file: New Path: %s', finalPathSourceRelative);
        }
    }

    sourceFileInfo.pathTargetRelative = path.join(docusaurusRelativePathToVault, mainPath, finalPathSourceRelative);
    sourceFileInfo.pathTargetAbsolute = path.resolve(basePath, docusaurusRelativePathToVault, mainPath, finalPathSourceRelative);

    return sourceFileInfo;
}

interface FilesToProcess {
    index: number;
    reason: string;
}

/**
 * This asynchronous function compares source and target files to identify files that need to be deleted.
 *
 * @param {Partial<SourceFileInfo>[]} allSourceFilesInfo - Array of source files information. Each element is an object containing details about a file from the source.
 * @param {SourceFileInfo[]} targetJson - Array of target files information. Each element is an object containing details about a file from the target.
 * @return {Promise<FilesToProcess[]>} - A promise that resolves with an array of objects containing indices of files to delete and the reasons for their deletion. Each object has two properties: 'index' and 'reason'.
 *
 * @async
 *
 * This function iterates over each file in the 'targetJson' array and attempts to find a matching file in the 'allSourceFilesInfo' array based on their relative paths. If no matching source file is found, it implies that the target file should be deleted, and it is added to the 'filesToDelete' array with the reason "it does not exist in sourceJson".
 * 
 * If a matching source file is found, their modification dates are compared. If the source file has a more recent modification date than the target file, it implies that the target file should be updated. As a part of the update process, the older target file needs to be deleted first, so it is added to the 'filesToDelete' array with the reason "its last modification date is older than the date in sourceJson".
 * 
 * The function returns a promise that resolves with the 'filesToDelete' array.
 */
async function getFilesToDelete(allSourceFilesInfo: Partial<SourceFileInfo>[], targetJson: SourceFileInfo[]): Promise<FilesToProcess[]> {
    // Load JSON data

    const sourceJson: Partial<SourceFileInfo>[] = allSourceFilesInfo;

    const filesToDelete: FilesToProcess[] = [];

    // Iterate over targetJson files
    targetJson.forEach((targetFile, i) => {
        // Find a matching file in sourceJson
        const matchingSourceFile = sourceJson.find(file => file.pathSourceRelative === targetFile.pathSourceRelative);

        // Create Date objects from dateModified strings
        const targetDate = new Date(targetFile.dateModified);
        const sourceDate = matchingSourceFile?.dateModified ? new Date(matchingSourceFile.dateModified) : null;

        // Add to the filesToDelete array based on certain conditions
        if (!matchingSourceFile) {
            filesToDelete.push({ index: i, reason: "it does not exist in sourceJson" });
            if (config.debug) {
                logger.info('🗑️ File to delete: %s', targetFile.pathSourceRelative);
            }
        } else if (sourceDate && sourceDate != targetDate) {
            filesToDelete.push({ index: i, reason: `its last modification date ${targetDate} is older than the date in sourceJson ${sourceDate}` });
            if (config.debug) {
                logger.info('🔄 File to update: %s', targetFile.pathSourceRelative);
            }
        }
    });

    return filesToDelete;
}

async function deleteFile(fileToDelete: FilesToProcess, targetJson: SourceFileInfo[], basePath: string) {
    const targetFile = targetJson[fileToDelete.index];

    try {
        await fs.promises.unlink(path.join(basePath, targetFile.pathTargetRelative));
        logger.info(`✅ Successfully deleted file %s`, targetFile.pathTargetRelative);
        await deleteParentDirectories(path.join(basePath, targetFile.pathTargetRelative));
    } catch (error) {
        // If error code is ENOENT, the file was not found, which we consider as a successful deletion.
        if (error.code !== "ENOENT") {
            logger.error(`❌ Failed to delete file %s: %s`, targetFile.pathTargetRelative, error);
            return; // If deletion failed for other reasons, we keep the file in targetJson.
        }
        logger.info(`🗑️ File %s was not found, considered as deleted`, targetFile.pathTargetRelative);
    }

    // Remove the file from targetJson whether deletion was successful or the file was not found.
    targetJson.splice(fileToDelete.index, 1);
}

async function deleteParentDirectories(filepath: string) {
    let dirPath = path.dirname(filepath);
    while (dirPath !== path.dirname(dirPath)) { // while dirPath has a parent directory
        try {
            await fs.promises.rmdir(dirPath);
            logger.info(`🧨 Successfully deleted directory ${dirPath}`);
        } catch (error) {
            // Ignore the error if the directory is not empty
            if (error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST' && error.code !== 'EPERM') {
                logger.info(`❌ Failed to delete directory ${dirPath}: ${error}`);
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

async function copyFilesToTarget(files: Partial<SourceFileInfo>[], basePath: string, targetJson: Partial<SourceFileInfo>[]) {
    const promises = files.map(async (file) => {
        const { pathTargetAbsolute, pathSourceAbsolute } = file
        // Ensure the directory exists

        if (pathTargetAbsolute && pathSourceAbsolute) {
            await ensureDirectoryExistence(pathTargetAbsolute);

            // Copy the file
            await fs.promises.copyFile(pathSourceAbsolute, pathTargetAbsolute);

            if (config.debug) {
                logger.info(`📤 Copied file from ${pathSourceAbsolute} to ${pathTargetAbsolute}`);
            }
        }
        targetJson.push(file as SourceFileInfo);

    });

    // Wait for all copy operations to finish
    await Promise.all(promises);
}

async function compareSource(sourceJson: Partial<SourceFileInfo>[], targetJson: Partial<SourceFileInfo>[]): Promise<FilesToProcess[]> {
    const filesToProcess: FilesToProcess[] = [];

    // Iterate over sourceJson files
    sourceJson.forEach((sourceFile, i) => {
        // Find a matching file in targetJson
        const matchingTargetFile = targetJson.find(file => file.pathSourceRelative === sourceFile.pathSourceRelative);

        // Add to the filesToProcess array if no matching file is found
        if (!matchingTargetFile) {
            filesToProcess.push({ index: i, reason: "Does not exist in targetJson" });
            if (config.debug) {
                logger.info('📝 File to process: %s', sourceFile.pathSourceRelative);
            }

        }
    });

    return filesToProcess;
}


async function checkFilesExistence(targetJson: SourceFileInfo[]): Promise<SourceFileInfo[]> {
    const existentFiles = [];
    for (const fileInfo of targetJson) {
        try {
            await fs.promises.access(fileInfo.pathTargetAbsolute);
            existentFiles.push(fileInfo);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err; // re-throw unexpected errors
            }
            // File doesn't exist, do nothing and continue to the next file
        }
    }
    return existentFiles;
}