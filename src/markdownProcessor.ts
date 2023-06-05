import * as readline from 'readline';
import * as stream from 'stream'

function processMarkdownAssets(line: string): string {
    if (line.includes("![](assets/")) {
        line = line.replace(/%20/g, "-");
    }

    return line.replace(/\[(.*?)\]\((\.\.\/)+(.*?)\.md\)/g, "[$1](./$3)");
}

export default async function processMarkdown(sourceContent: string): Promise<string> {
    // Create a stream from the source content
    console.log("💥")
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

    // Iterate over the lines
    for await (const line of rl) {
        // Call your processing functions here
        const processedLine = processMarkdownAssets(line);
        // Append the processed line to the transformed content
        transformedContent += processedLine + '\n';
    }

    // Return the transformed content
    return transformedContent;
}