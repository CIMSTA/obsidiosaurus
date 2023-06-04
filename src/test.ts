import { Notice } from 'obsidian';
import { config } from 'main';



export default function test(string: any) {
    new Notice(`This is a notice for Buddyxx ${string} ${config.excalidraw}`);
    console.log(`Hello ${string}`)
}


