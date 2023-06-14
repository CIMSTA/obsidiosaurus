import * as readline from 'readline';
import * as stream from 'stream'
import { logger } from 'main';
import { AssetFileInfo, AssetType, Admonition } from "./types";

export default async function processMarkdown(processedFileName: string, sourceContent: string, assetJson: AssetFileInfo[]): Promise<string> {
    // Create a stream from the source content

    const sourceStream = new stream.Readable();
    sourceStream.push(sourceContent);
    sourceStream.push(null);

    // Create a readline interface from the stream
    const rl = readline.createInterface({
        input: sourceStream,
        output: process.stdout,
        terminal: false
    });

    // Initialize the transformed content as an empty string
    let transformedContent = '';
    let inAdmonition = false, inQuote = false;
    let admonition = { type: '', title: '', whitespaces: 0 };
    // Iterate over the lines
    for await (const line of rl) {
        // Call your processing functions here
        let processedLine = checkForAssets(line, processedFileName, assetJson);
        processedLine = checkForLinks(line);
        [processedLine, inAdmonition, inQuote, admonition] = convertAdmonition(processedLine, inAdmonition, inQuote, admonition);

        // Append the processed line to the transformed content
        transformedContent += processedLine + '\n';
    }

    // Return the transformed content
    return transformedContent;
}


const parseAdmonitionData = (line: string): Admonition => {
    const match = line.match(/^>\s*\[!(?<type>.*)](?<title>.*)?/);
    if (!match) return { type: '', title: '', whitespaces: 0 };

    return {
        type: match.groups?.type || '',
        title: match.groups?.title?.trim() || '',
        whitespaces: line.indexOf("[") - line.indexOf(">"),
    };
};


// Function to convert Admonition and quote blocks
const convertAdmonition = (line: string, isInAdmonition: boolean, isInQuote: boolean, admonition: Admonition): [string, boolean, boolean, Admonition] => {
    // Parse data if the line is the start of a new Admonition or quote
    if (!isInAdmonition && !isInQuote) {
        admonition = parseAdmonitionData(line);
    }

    // Process the line based on whether it's part of an Admonition, a quote, or a normal line
    if (isInAdmonition) {
        if (line.trim() === '') {
            // If the line is empty, it's the end of the Admonition
            line = ":::\n"
            isInAdmonition = false
        } else {
            // If the line is not empty, it's part of the Admonition
            line = line.slice(admonition.whitespaces);
        }
    } else if (isInQuote) {
        if (line.trim() === '') {
            // If the line is empty, it's the end of the quote
            line = ">\n> — " + admonition.title + "\n";
            isInQuote = false;
        }
    } else if (admonition.type) {
        if (admonition.type === "quote") {
            // The line is the start of a new quote
            line = "";
            isInQuote = true;
        } else {
            // The line is the start of a new Admonition
            isInAdmonition = true;
            line = ":::" + admonition.type;
            if (admonition.title) {
                line += " " + admonition.title;
            }
            line += "\n";
        }
    }

    return [line, isInAdmonition, isInQuote, admonition];
};

function checkForLinks(line: string): string {
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/;
    const match = line.match(pattern);

    if (match) {

        const url = match[2];
        const urlParts = url.split("/");

        if (urlParts.length <= 1) return line;

        let mainFolder = urlParts[0];

        const isBlog = isBlogFolder(mainFolder);

        if (isBlog) {
            mainFolder = removeBlogSuffix(mainFolder);
            urlParts[0] = mainFolder;
        }

        const processedUrlParts = processUrlParts(urlParts, isBlog);

        const newUrl = "/" + processedUrlParts.join("/");
        return line.replace(url, newUrl);
    }
    return line
}


function processUrlParts(urlParts: string[], isBlog: boolean): string[] {
    urlParts = [...urlParts];  // create a copy to not modify original

    const file = urlParts[urlParts.length - 1];
    let parentFolder = urlParts[urlParts.length - 2];

    if (parentFolder.endsWith("+")) {
        parentFolder = parentFolder.replace("+", "");
        urlParts.pop();

        urlParts[urlParts.length - 1] = isBlog
            ? parentFolder.split("-").join("/")
            : removeNumberPrefix(parentFolder);
    } else if (file.endsWith(".md")) {
        urlParts[urlParts.length - 1] = file.replace(".md", "");
    }

    if (isBlog) {
        urlParts[urlParts.length - 1] = urlParts[urlParts.length - 1].split("-").join("/");
    }

    if (!isBlog) {
        urlParts = urlParts.map(part => removeNumberPrefix(part));
    }

    return urlParts;
}


function isBlogFolder(mainFolder: string): boolean {
    return mainFolder === "blog" || mainFolder.endsWith("__blog");
}

function removeBlogSuffix(mainFolder: string): string {
    return mainFolder.replace("__blog", "");
}

function removeNumberPrefix(str: string): string {
    // Removes all common numbering styles: 1), 1., 1 -, ...
    return str.replace(/^\d+[\.\-\)\s%20]*\s*/, "").trim();
}


function checkForAssets(line: string, processedFileName: string, assetJson: AssetFileInfo[]): string {
    const match = line.match(/!\[(?:\|(\d+)(?:x(\d+))?)?\]\((.*?)\)/);
    if (match) {
        //console.log(match)
        const pathAssetRelativeParts = match[3].split('/');
        //console.log(pathAssetRelativeParts)
        const fileName = pathAssetRelativeParts[pathAssetRelativeParts.length - 1];
        const fileNameClean = fileName.split(".")[0];
        const fileExtension = fileName.split(".")[1];

        logger.info(`🔎 Found asset in: ${line}`);
        logger.info(pathAssetRelativeParts);

        // ![|100](assets/giphy-24%2086606353.gif) -> type 100
        // ![|100x400](assets/giphy-24%2086606353.gif) -> type 100x400
        let type: string;
        const resizeMatch = line.match(/\|(\d+)?/);
        if (resizeMatch && resizeMatch[1]) {
            type = resizeMatch[1];
        } else {
            type = 'standard';
        }

        const assetTypeEntry: AssetType = {
            type: type,
            files: [processedFileName]
        };
        logger.info(`🔎`);
        // Check if fileName already exists in the assetJson
        let fileInfo = assetJson.find(item => item.fileName === fileName);
        logger.info(fileInfo);
        if (fileInfo) {
            // Check if type already exists in includedAssetType array
            const existingType = fileInfo.AssetTypeInDocument.find(assetType => assetType.type === type);
            logger.info(`🔎🔎`);
            if (existingType) {
                // If type exists, add the new pathKey to the existing files array
                existingType.files.push(processedFileName);
            } else {
                // If type does not exist, add it
                fileInfo.AssetTypeInDocument.push(assetTypeEntry);
            }
        } else {
            fileInfo = {
                fileName,
                fileNameClean,
                fileExtension,
                AssetTypeInDocument: [assetTypeEntry],
            };
            assetJson.push(fileInfo);
        }


        if ([".jpg", ".png", ".webp", ".jpeg", ".bmp"].includes(fileExtension)) {
            //line = processImage(line);
        } else if (fileExtension.endsWith(".gif")) {
            line = processGif(line)
        } else if (fileExtension.endsWith(".svg")) {
            line = processSvg(line)
        } else {
            line = processAsset(line)
        }
    }
    //assetJson.push(file as AssetFilesInfo);
    return line;
}


function processImage(line: string, filename: string, fileEnding: string): string {
    const pattern = /\|(\d+)(?:x(\d+))?/;
    const resizeMatch = line.match(pattern);
    logger.info(`🔎 Found image in: ${line}`);

    const newImageDetails: { filename: string, processed: boolean, filename_new?: string, width?: number, height?: number } = {
        filename: `${filename}.${fileEnding}`,
        processed: false,
    };

    if (resizeMatch) {
        const imageWidth = resizeMatch[1];
        const imageHeight = resizeMatch[2];

        let filenameNew = "";
        if (imageHeight) {
            filenameNew = `${filename}_w${imageWidth}xh${imageHeight}`;
        } else {
            filenameNew = `${filename}_w${imageWidth}`;
        }

        newImageDetails.filename_new = filenameNew;
        newImageDetails.width = Number(imageWidth);
        newImageDetails.height = Number(imageHeight);
    } else {
        newImageDetails.filename_new = filename;
    }

    const alreadyExists = imageDetails.some(imageDetail => imageDetail.filename_new === newImageDetails.filename_new);

    if (!alreadyExists) {
        imageDetails.push(newImageDetails);
    }

    const string = `![](/${dstAssetSubfolder}/${newImageDetails.filename_new}.${convertImageType})`;
    logger.debug(`🟢 Processed image string: ${string}`);

    return string;
}

function processSvg(line: string) {
    return line
}

function processGif(line: string) {
    return line
}

function processAsset(line: string) {
    //line = `[Download ${filenameClear}.${fileEnding}](assets/${filenameClear}.${fileEnding})`;
    return line
}