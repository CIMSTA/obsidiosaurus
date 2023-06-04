import { MainFolder } from "./types";
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
        const mainFolders = getMainfolders(basePath);
        
        


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
            if (object.endsWith("__blog") || object.includes("blog")) {
                type = "blog";
            } else if (object.includes("docs")) {
                type = "docs";
            } else if (object.includes(config.obsidian_asset_folder_name)) {
                type = "assets";
            } else {
                type = "ignore";
            }

            if (type !== "ignore" && type !== undefined) {
                const folderObject: MainFolder = { [object]: { type } };
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