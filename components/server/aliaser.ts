"use server"

import { createOrLoadTagDatabase } from "./imagedb";
import { pipeline, Tensor } from '@huggingface/transformers';
import { writeFile } from "fs/promises";
import { createOrReadFile } from "./fileHandling";

export async function generateAliasFile(){
    // Implementation for generating alias file goes here
    //read current aliases from storage
    const aliases = await loadAliases();
    const allTags = await createOrLoadTagDatabase();
    const tagsMissingAliases = allTags.filter(tag => !aliases[tag.name]);
    //if there is a significant number of tags missing aliases, reprocess the whole database
    if (tagsMissingAliases.length > 4){
        // Reprocess the whole database
        console.log("initializing extractor...");
        const myAliaser = await initExtractor();
        const rawTags = allTags.map(tag => tag.name);
        const embeddings = await indexTags(myAliaser, rawTags);
        console.log("Generated embeddings for all tags.");

        //for each tag, compute distances to all other tags less than .75, and store them as aliases
        const aliases: Aliases = {};
        for (const tagA of rawTags) {
            aliases[tagA] = [];
            let i=0;
            for (const tagB of rawTags) {
                if (tagA === tagB) continue;
                const distance = computeCosineDistance(embeddings[tagA], embeddings[tagB]);
                
                if (distance < 0.30) {
                    aliases[tagA].push({ name: tagB, distance });
                }
                i++;
                if (i % 100 === 0) {
                    console.log(`Computed distance between ${tagA} and ${tagB}:`, distance);
                }
            }
            console.log(`Processed aliases for tag: ${tagA}`, "total count: ", aliases[tagA].length);
        }
        // Save the generated aliases to storage
        await saveAliases(aliases);        
    }
}

export type Alias = {
    name: string,
    distance: number
}

type Aliases = Record<string, Alias[]>;

export async function loadAliases(): Promise<Aliases> {
    // Implementation for loading aliases goes here
    const aliasDB = await createOrReadFile<Aliases>('aliases.json', {});
    return aliasDB;
}

export async function saveAliases(aliases: Aliases): Promise<void> {
    // Implementation for saving aliases goes here
    await writeFile('aliases.json', JSON.stringify(aliases, null, 2));
}

export async function getAliases(name: string, radius: number): Promise<Alias[]> {
    const aliases = await loadAliases();
    const allAliases = aliases[name] ?? [];
    return allAliases.filter(alias => alias.distance <= radius);
}

function computeCosineDistance(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    
    // Invert similarity to get distance, and clip between 0.0 and 1.0
    const distance = 1.0 - similarity;
    return Math.max(0.0, Math.min(1.0, distance));
}

export type Extractor = (input: string, options: { pooling: 'mean', normalize: boolean }) => Promise<{ data: Float32Array }>;

export async function initExtractor(): Promise<Extractor> {
    return await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        // Tells transformers.js to look for local cached weights or download if missing
        device: 'cpu' 
    }) as Extractor;
}

export async function indexTags(extractor: Extractor, tags: string[]): Promise<Record<string, number[]>> {
    const tagEmbeddings: Record<string, number[]> = {};

    for (const tag of tags) {
        // Clean up the booru underscores and add textual context
        const cleanedTag = `An image tag describing: ${tag.replace(/_/g, ' ')}`;
        
        // Generate the embedding tensor
        const output = await extractor(cleanedTag, { pooling: 'mean', normalize: true });
        
        // Extract numerical array from the tensor payload
        const embeddingArray = Array.from(output.data as Float32Array) as number[];
        tagEmbeddings[tag] = embeddingArray;
    }

    return tagEmbeddings;
}