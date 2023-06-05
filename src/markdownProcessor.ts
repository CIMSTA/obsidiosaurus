import * as readline from 'readline';
import * as stream from 'stream'

function convertAssets(line: string): string {
    if (line.includes("![](assets/")) {
        line = line.replace(/%20/g, "-");
    }

    return line.replace(/\[(.*?)\]\((\.\.\/)+(.*?)\.md\)/g, "[$1](./$3)");
}



export default async function processMarkdown(sourceContent: string): Promise<string> {
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
    let admonitation = false

    // Iterate over the lines
    for await (const line of rl) {
        // Call your processing functions here
        let processedLine = convertAssets(line);
        processedLine = convertLinks(line);
        processedLine, admonitation = convertAdmonitations(line, admonitation);
        // Append the processed line to the transformed content
        transformedContent += processedLine + '\n';
    }

    // Return the transformed content
    return transformedContent;
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

function convertLinks(line: string): string {
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/;
    const match = line.match(pattern);

    if (!match) return line;

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
