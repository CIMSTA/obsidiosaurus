import * as readline from 'readline';
import * as stream from 'stream'
import { logger, config } from 'main';
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
        processedLine = checkForLinks(processedLine);
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
    const match = line.match(/!\[(?:\|(?<size>\d+x\d+))?\]\((?<path>.*?)\)/);

    if (match && match.groups) {
        const { size, path } = match.groups;
        // Split the path to get the file name and extension
        const pathParts = path.split('/');
        const fileNameWithExtension = pathParts[pathParts.length - 1];
        const [fileName, fileExtension] = fileNameWithExtension.split('.');

        logger.info(`🔎 Found asset in: ${line}`);

        // ![|100](assets/giphy-24%2086606353.gif) -> type 100
        // ![|100x400](assets/giphy-24%2086606353.gif) -> type 100x400
        let type = 'standard';

        if (size?.trim()) {
            type = size;
        }

        const assetTypeEntry: AssetType = {
            type: type,
            files: [processedFileName]
        };
        // Check if fileName already exists in the assetJson
        let fileInfo = assetJson.find(item => item.fileName === fileName);

        if (fileInfo) {
            // Check if type already exists in includedAssetType array
            const existingType = fileInfo.AssetTypeInDocument.find(assetType => assetType.type === type);
            if (existingType) {
                // If type exists, add the new pathKey to the existing files array
                if (!existingType.files.includes(processedFileName)) {
                    existingType.files.push(processedFileName);
                }
            } else {
                // If type does not exist, add it
                fileInfo.AssetTypeInDocument.push(assetTypeEntry);
            }
        } else {
            fileInfo = {
                fileName,
                fileNameWithExtension,
                fileExtension,
                AssetTypeInDocument: [assetTypeEntry],
            };
            assetJson.push(fileInfo);
        }
        if (["jpg", "png", "webp", "jpeg", "bmp", "gif", "svg", "excalidraw"].includes(fileExtension)) {
           line = processImage(line, fileName, fileExtension, type)
        } else {
            line = processAsset(line)
        }
    }
    return line;
}


function processImage(line: string, fileName: string, fileExtension: string, type: string): string {
    // Determine file size
    const sizeSuffix = type === "standard" ? "" : `_${type}`;

    // Map of extensions to their corresponding format transformations
    const extensionFormatMap: {[index: string]: string} = {
        // ![|300x200](assets/borat.gif)
        // ------------------------------------
        // ![borat](/assets/borat_300x200.gif)      
        "gif": `![${fileName}](/assets/${fileName}${sizeSuffix}.${fileExtension})`,

        // ![](assets/blackberry.svg)
        // ------------------------------------------------
        // ![blackberry](/assets/blackberry.light.svg#light)
        // ![blackberry](/assets/blackberry.dark.svg#dark)
        "svg": `![${fileName}](/assets/${fileName}${sizeSuffix}.light.svg#light)\n![${fileName}](/assets/${fileName}${sizeSuffix}.dark.svg#dark)`,

        // ![](assets/blackberry.excalidraw)
        // ------------------------------------------------
        // ![blackberry](/assets/blackberry.light.svg#light)
        // ![blackberry](/assets/blackberry.dark.svg#dark)
        "excalidraw": `![${fileName}](/assets/${fileName}${sizeSuffix}.excalidraw.light.svg#light)\n![${fileName}](/assets/${fileName}${sizeSuffix}.dark.svg#dark)`
    };

    // Check if the file extension exists in the format map
    if (extensionFormatMap[fileExtension]) {
        line = extensionFormatMap[fileExtension];
    } else {
        
        line = `![${fileName}](/assets/${fileName}${sizeSuffix}.${config.convertedImageType})`
    }
    
    return line;
}


function processAsset(line: string) {
    //line = `[Download ${filenameClear}.${fileEnding}](assets/${filenameClear}.${fileEnding})`;
    return line
}