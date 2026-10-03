"use server"

import { getImageDatabase, getLastViewedSet } from "./imagedb";
import fs from "fs";

const sortResults = async (images: [string, ImageItem][], method: string, lastViewedSet: Record<string, number>): Promise<CompleteImageItem[]> => {
    let completeImages: (CompleteImageItem|null)[] = await Promise.all(images.map(async ([src, item]) => {
        if (!src) return null;
        const tagList = item.tags;
        const createDate = item.createTime;
        const size = item.size;
        const lastViewed = lastViewedSet[src] ?? 0; // unviewed images are assumed to be the earliest possible date
        return [src, {src, tags: tagList, createDate, size, lastViewed}];
    }));

    const completeImagesFiltered: CompleteImageItem[] = completeImages.filter((img): img is CompleteImageItem => img !== null);

    if (sortMethods[method]) {
        return completeImagesFiltered.toSorted(sortMethods[method]);
    }

    return completeImagesFiltered;
}

export async function getMatchingImages(query:string, aliasStrength:number, favorites:string[]): Promise<ImageItem[]> {
    //gets all images from the DB matching the query
    const imageDB = await getImageDatabase();
    const lastViewedSet = await getLastViewedSet();
    //query is a space-separated list of tags to filter images by (and other special tokens)
    const searchTerms = query.split(" ").map((term) => term.trim()).filter(Boolean);

    let matchingImages = Object.entries(imageDB) //imageDB is {src1:tags1, src2:tags2, ...} so each entry is [srcN, tagsN]
    console.log("Initial matching images: ", matchingImages.length);
    //matchingImages is the working set of images that match the search terms, to be refined and sorted by the algorithm as time goes on
    
    const sortTerms = searchTerms.filter((term) => term.startsWith("sortBy:"));
    const searchTermsSansSort = searchTerms.filter((term) => !term.startsWith("sortBy:"));
    const limitTerms = searchTerms.filter((term) => term.startsWith("limit:"));
    const firstLimitTerm = limitTerms.length > 0 ? limitTerms[0] : null;
    const searchTermsWithoutLimit = searchTermsSansSort.filter((term) => !term.startsWith("limit:"));
    //limit is applied after sorting at the end.

    searchTermsWithoutLimit.forEach((term) => {
        let workingTerm = term
        const orTerm = term.startsWith("|")
        const notTerm = term.startsWith("-")
        if (workingTerm.startsWith("&") || orTerm || notTerm){
            workingTerm = workingTerm.slice(1); // Remove the prefix; it's assumed from here on out to be an AND term if orTerm is false.
        }

        //if orTerm is true, rebuild the whole matchingImages array and add any images that match the workingTerm
        if (orTerm) {
            const additionalMatches = Object.entries(imageDB).filter(([src, item]) => matchAlgorithm(src, item.tags.join(" "), workingTerm, favorites));
            matchingImages = [...matchingImages, ...additionalMatches];
        } else {
            if (!notTerm) {
                console.log("Filtering with term: ", workingTerm);
                matchingImages = matchingImages.filter(([src, item]) => matchAlgorithm(src, item.tags.join(" "), workingTerm, favorites));
            } else {
                matchingImages = matchingImages.filter(([src, item]) => !matchAlgorithm(src, item.tags.join(" "), workingTerm, favorites));
            }
        }
    });

    //sort the matching images based on the sortTerms
    console.log("Number of pre-sort images: ", matchingImages.length);
    if (sortTerms.length > 0) {
        const sortMethod = sortTerms[0].slice("sortBy:".length);
        console.log("Sort method: ", sortMethod);
        const sortedMatchingImageComplete = await sortResults(matchingImages, sortMethod, lastViewedSet);
        console.log("Sorted matching images: ", sortedMatchingImageComplete.length);
        matchingImages = sortedMatchingImageComplete.map(([src, {tags, createDate, size, lastViewed}]): [string, ImageItem] => [src, {...imageDB[src], tags, createTime: createDate, size, lastViewed} as ImageItem]);
    }

    // Apply the limit if specified
    console.log("First limit term: ", firstLimitTerm);
    if (firstLimitTerm) {
        const limit = parseInt(firstLimitTerm.slice("limit:".length), 10);
        console.log("Limit: ", limit);
        if (!isNaN(limit)) {
            matchingImages = matchingImages.slice(0, limit);
        }
    }

    console.log("Matching images after limit: ", matchingImages.length);

    return matchingImages.map(([src, item]) => ({ ...item })); // Convert to ImageItem objects assuming ImageItem has key and image properties
}

function matchAlgorithm(src: string, tags: string, term: string, favorites: string[]): boolean {
    if (term.startsWith('folder:') && !term.startsWith('folder:"')){
        const folderName = term.slice('folder:'.length);
        return src.includes(folderName);
    }

    if (term.startsWith('folder:"')){
        const startQuote = term.indexOf('"') + 1;
        const endQuote = term.lastIndexOf('"');
        const folderName = term.slice(startQuote, endQuote);
        return src.includes(folderName);
    }

    if (term === "special:any"){
        return true
    }

    if (term === "special:notag"){
        return tags.split(" ").length === 0;
    }

    if (term === "special:tagged"){
        return tags.split(" ").length > 0;
    }

    if (term === "special:favorite") {
        return favorites.includes(src);
    }

    // Default behavior: check if the term exists as a tag in the key
    if (tags.split(" ").includes(term)) {
        return true;
    }

    return false;
}

type CompleteImageItem = [string, {src: string, tags: string[], createDate:number, size:number, lastViewed: number}];
const sortMethods:Record<string, (a: CompleteImageItem, b: CompleteImageItem) => number> = {
    "date": (a, b) => {
        return b[1].createDate - a[1].createDate;
    },
    "filename_alphabet": (a, b) => {
        return a[0].localeCompare(b[0]);
    },
    "file_date_new": (a, b) => {
        return b[1].createDate - a[1].createDate;
    },
    "file_date_old": (a, b) => {
        return a[1].createDate - b[1].createDate;
    },
    "file_size": (a, b) => {
        return b[1].size - a[1].size;
    },
    "view_new": (a, b) => {
        return b[1].lastViewed - a[1].lastViewed;
    },
    "view_old": (a, b) => {
        return a[1].lastViewed - b[1].lastViewed;
    }
}