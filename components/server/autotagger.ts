"use server";

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createOrLoadConfig } from "./imagedb";

export async function autoTagImage(image: ImageItem) {
    //get local configuration for autotagger location
    const config = await createOrLoadConfig();
    const autotaggerLocation = config.autotaggerLocation;
    
    if (!autotaggerLocation) {
        throw new Error("Autotagger location is not configured.");
    }

    const autotaggerMode = autotaggerLocation.startsWith("PORT:") ? "service" : "exe";

    const currentItemTagsSet = new Set(image.tags);

    //autotagger is an exe. input the src as a command line argument, the output will come in stdout with a list of the tags for the image.
    if (autotaggerMode === "exe") {
        const { exec } = require("child_process");
        const newTags = new Promise<string[]>((resolve, reject) => {
            exec(`"${autotaggerLocation}" "${image.src}"`, (error: any, stdout: string, stderr: any) => {
                if (error) {
                    reject(error);
                    return;
                }
                const tags = stdout.split("\n").flatMap(line => line.split(", ")).map(tag => tag.trim()).filter(tag => tag.length > 0);
                resolve(tags);
            });
        });

        const resolvedNewTags = await newTags;
        resolvedNewTags.forEach((tag:string) => currentItemTagsSet.add(tag));
    } else {
        // Hydra expects the image bytes as the request body and returns a label-to-probability object.
        const port = autotaggerLocation.replace("PORT:", "");
        const mimeTypes: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".bmp": "image/bmp",
            ".webp": "image/webp",
        };
        const extension = extname(image.src).toLowerCase();
        const contentType = mimeTypes[extension];
        if (!contentType) {
            throw new Error(`Unsupported image file type: ${extension || "unknown"}`);
        }

        const imageBytes = new Uint8Array(await readFile(image.src));
        const response = await fetch(`http://localhost:${port}/classify`, {
            method: "POST",
            headers: {
                "Content-Type": contentType
            },
            body: imageBytes
        });
        if (!response.ok) {
            const errorDetails = await response.text();
            throw new Error(`Failed to auto-tag image (${response.status}): ${errorDetails || response.statusText}`);
        }

        const result: Record<string, number> = await response.json();
        if (
            typeof result !== "object" ||
            result === null ||
            Array.isArray(result) ||
            !Object.entries(result).every(([label, probability]) =>
                label.length > 0 && typeof probability === "number"
            )
        ) {
            throw new Error("Autotagger service returned an invalid classification response.");
        }

        const tags = Object.keys(result);
        tags.filter(tag => tag.length > 0 && result[tag] > 0.5).forEach((tag:string) => currentItemTagsSet.add(tag));
        
        console.log("Tags added to current item:", Array.from(currentItemTagsSet));
    }

    return Array.from(currentItemTagsSet);
}