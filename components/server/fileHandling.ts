"use server"

import fs from "fs/promises";

export async function createOrReadFile<T>(filePath: string, defaultValue: T): Promise<T> {
    //creates a new file with the default value if it doesn't exist, otherwise reads the existing file
    try {
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data) as T;
    } catch (error) {
        await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), "utf-8");
        return defaultValue;
    }
}

export async function writeFile<T>(filePath: string, content: T): Promise<void> {
    //writes the content to a file at the given path
    await fs.writeFile(filePath, JSON.stringify(content, null, 2), "utf-8");
}