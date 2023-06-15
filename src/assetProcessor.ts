import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { AssetFileInfo, AssetType } from "./types";
import { config } from "main";




// Calculate new dimensions based on width and height ratio
async function calculateDimensions(assetFileInfo: AssetFileInfo, type: string): Promise<{ newWidth: number, newHeight: number | undefined }> {
    const dimensions = type.split('x').map(Number);
    let width = dimensions[0];
    let height = dimensions.length > 1 ? dimensions[1] : undefined;

    if (width && !height) {
        const image = sharp(assetFileInfo.fileName);
        const metadata = await image.metadata();
        height = Math.round(metadata.height! * (width / metadata.width!));
    } else if (width === undefined) {
        width = config.convertedImageMaxWidth;
    }

    return { newWidth: width, newHeight: height };
}

// Process each Asset Type
async function processAssetType(assetType: AssetType, assetFileInfo: AssetFileInfo) {
    const { newWidth, newHeight } = await calculateDimensions(assetFileInfo, assetType.type);
    const options: sharp.ResizeOptions = { 
        width: newWidth, 
        height: newHeight,
        fit: 'inside' 
    };

    for (const file of assetType.files) {
        const filePath = path.join(file, assetFileInfo.fileName);
        await sharp(filePath)
            .resize(options)
            .toFile(buildOutputFilePath(assetFileInfo));
    }
}

// Build output file path
function buildOutputFilePath(assetFileInfo: AssetFileInfo) {
    const dstDir = path.join(config.docusaurusWebsiteDirectory, "static", config.docusaurusAssetSubfolderName);
    const fileName = assetFileInfo.fileNameClean.replace(" ", "_") + "." + config;
    const dstFilePath = path.join(dstDir, fileName);

    // Ensure destination directory exists
    fs.mkdirSync(dstDir, { recursive: true });

    return dstFilePath;
}

// Main function
export async function convertAndResizeImage(assetFileInfo: AssetFileInfo) {
    for (const assetType of assetFileInfo.AssetTypeInDocument) {
        await processAssetType(assetType, assetFileInfo);
    }
}



const convertSvgColors = async (inputFile: string, srcPath: string) => {
    const { docusaurusWebsiteDirectory, docusaurusAssetSubfolderName } = config;
    const lightColor = "#c9d1d9";
    const darkColor = "#0d1117";

    const baseName = path.basename(inputFile, '.svg');
    const lightOutputFile = `${baseName}.light.svg`;
    const darkOutputFile = `${baseName}.dark.svg`;

    const assetDirPath = path.join(docusaurusWebsiteDirectory, 'static', docusaurusAssetSubfolderName);
    await fs.mkdir(assetDirPath, { recursive: true });

    const data = await fs.readFile(path.join(srcPath, inputFile), 'utf8');
    await fs.writeFile(path.join(assetDirPath, lightOutputFile), data, 'utf8');

    const darkData = data.replace(/rgb\(0, 0, 0\)/g, lightColor).replace(/rgb\(255, 255, 255\)/g, darkColor);
    await fs.writeFile(path.join(assetDirPath, darkOutputFile), darkData, 'utf8');

    console.log(`✅ Completed converting colors for SVG: ${inputFile}`);
};

