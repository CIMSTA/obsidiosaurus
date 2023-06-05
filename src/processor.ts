import { MainFolder, SourceFileInfo } from "./types";
import { logger } from 'main';
// When you use export default in a module, that module becomes an object and what you're exporting becomes a property of that object.
// import { logger } from 'main';
// instead of 
// import logger from 'main';
import * as fs from 'fs';
import * as path from 'path';
import { config } from "main";

import * as readline from 'readline';


function syncFunction(): void {
    console.log("Sync function called");
}

async function asyncFunction(): Promise<void> {
    console.log("Async function called");
    await waitForSeconds(2); // Wait for 2 seconds
    console.log("Async function completed");
}

async function asyncFunction1(): Promise<void> {
    console.log("Async function 1 called");
    await waitForSeconds(3); // Wait for 3 seconds
    console.log("Async function 1 completed");
}

async function asyncFunction2(): Promise<void> {
    console.log("Async function 2 called");
    await waitForSeconds(1); // Wait for 1 second
    console.log("Async function 2 completed");
}

async function asyncFunction3(): Promise<void> {
    console.log("Async function 3 called");
    await waitForSeconds(4); // Wait for 4 seconds
    console.log("Async function 3 completed");
}


export default function obsidiosaurusProcess(basePath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {

        // GET MAIN FOLDERS
        const mainFolders: MainFolder[] = getMainfolders(basePath);

        // GET ALL FILES FROM MAIN FOLDERS
        mainFolders.forEach(folder => processSingleFolder(folder, basePath));

        if (config.debug) {
            logger.info('📁 Folder structure with Files: %s', JSON.stringify(mainFolders));
        }

        // GET ALL FILE INFO FROM MAIN FOLDERS
        const allSourceFilesInfo: Partial<SourceFileInfo>[] = [];
        const allSourceAssetsInfo: Partial<SourceFileInfo>[] = [];
        const allInfo = mainFolders.flatMap(folder => folder.files.map(file => getSourceFileInfo(basePath, folder, file)));

        allInfo.forEach(info => {
            if (info.type === 'assets') {
                allSourceAssetsInfo.push(info);
            } else {
                allSourceFilesInfo.push(info);
            }
        });

        fs.writeFileSync('allFilesInfo.json', JSON.stringify(allSourceFilesInfo, null, 2));
        fs.writeFileSync('allAssetsInfo.json', JSON.stringify(allSourceAssetsInfo, null, 2));

        syncFunction();
        asyncFunction()
            .then(() => {
                const promises = [asyncFunction1(), asyncFunction2(), asyncFunction3()];
                return Promise.all(promises);
            })
            .then(() => {
                resolve(true);
            })
            .catch(() => {
                resolve(false);
            });
    });
}

async function waitForSeconds(seconds: number): Promise<void> {
    return new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, seconds * 1000);
    });
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

    sourceFileInfo = getTargetPath(sourceFileInfo)

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



function getTargetPath(sourceFileInfo: Partial<SourceFileInfo>): Partial<SourceFileInfo> {
    const { type, language, pathSourceRelative, mainFolder, parentFolder } = sourceFileInfo;
    const docusaurusRelativePathToVault = `..\\${config.docusaurus_directory}\\`;

    if (!type || !language || !pathSourceRelative) {
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

    // Remove parent folder from path if ends with "+"
    if (parentFolder?.endsWith('+')) {
        finalPathSourceRelative = finalPathSourceRelative.replace(`${parentFolder}\\`, "");
        if (config.debug) {
            logger.info('🔧 Removed Parent Folder: New Path: %s', finalPathSourceRelative);
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

    return sourceFileInfo;
}