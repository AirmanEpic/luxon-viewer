"use server"

import { rgbToHex } from "@/lib/utils";
import { hslToRgb } from "@/lib/utils";
import { createOrReadFile, writeFile } from "./fileHandling";
import fs from "fs/promises";
import { existsSync } from "fs";

export async function createOrLoadTagDatabase(): Promise<Tag[]> {
	//gets all tags from the database and converts them to Tag objects
	return createOrReadFile("tagDB.json", []);
}

export async function saveImageTags(image: string, tags: string[]): Promise<void> {
	const imageDB: ImageDB = await getImageDatabase();
	const wasInDB = image in imageDB;
	if (!(image in imageDB)) {
		const stats = await fs.stat(image);
		imageDB[image] = { src: image, tags: [], createTime: stats.birthtimeMs, size: stats.size };
	}
	imageDB[image].tags = tags;
	console.log("Saved tags for image:", image, "Tags:", tags, "Was in DB:", wasInDB);
	await saveImageDatabase(imageDB);
}

export async function saveTagDatabase(tags: Tag[]): Promise<void> {
	//saves the tag database to persistent storage
	await writeFile("tagDB.json", tags);
}

export async function getRecentItems(): Promise<RecentItem[]> {
	//gets recent items from the database
	return createOrReadFile("recent.json", []);
}

export async function getImageDatabase(): Promise<ImageDB> {
	//gets the entire image database
	return createOrReadFile("imageTagDB-V2.1.0.json", {});
}

export async function saveImageDatabase(imageDB: ImageDB): Promise<void> {
	//saves the entire image database to persistent storage
	await writeFile("imageTagDB-V2.1.0.json", imageDB);
}

export async function processImageDB(): Promise<void> {
	// find all images in the current folder and update the database accordingly.
	const config = await createOrLoadConfig();
	const imageFolder = config.imageFolder;
	
	//find all images in image folder and subfolders
	async function getAllImages(folder: string): Promise<string[]> {
		let images: string[] = [];
		const entries = await fs.readdir(folder, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = `${folder}/${entry.name}`;
			if (entry.isDirectory()) {
				images = images.concat(await getAllImages(fullPath));
			} else if (entry.isFile() && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(entry.name)) {
				images.push(fullPath);
			}
		}
		return images;
	}

	const allImages = await getAllImages(imageFolder);
	const imageDB: ImageDB = await getImageDatabase();
	//ensure they have a tag section in the tag database
	const missingImages = allImages.filter(image => !(image in imageDB));
	console.log(`Found ${missingImages.length} images without tags`);
	for (const image of missingImages) {
		const stats = await fs.stat(image);
		imageDB[image] = { src: image, tags: [], createTime: stats.birthtimeMs, size: stats.size };
	}
	//save tag database
	await saveImageDatabase(imageDB);

	// get all tags for all images
	const counts: Record<string, number> = {};
	const tags = new Set<string>();
	for (const image of Object.values(imageDB)) {
		for (const tag of image.tags) {
			tags.add(tag);
			counts[tag] = (counts[tag] ?? 0) + 1;
		}
	}

	//get current tag DB
	const currentTagDB = await createOrLoadTagDatabase();
	const newTags = Array.from(tags).filter(tag => !currentTagDB.some(t => t.name === tag));
	if (newTags.length > 0) {

		const updatedTagDB = [...currentTagDB, ...newTags.map(tag => { 
			const hsl = {h: Math.random()*360, s:80, l:70}
			const [r, g, b] = hslToRgb(hsl.h, hsl.s, hsl.l);
			const hexVal = rgbToHex(r, g, b);
			return { name: tag, color: hexVal, count: counts[tag] ?? 0 };
		})];
		await saveTagDatabase(updatedTagDB);
	}
}

export async function targetImageFolder(folderPath: string): Promise<void> {
	//sets the target image folder for the application
	const config = await createOrLoadConfig();
	config.imageFolder = folderPath;
	await writeFile("config.json", config);

	await processImageDB();
}

export async function importLegacyTagFile(filePath: string): Promise<void> {
	//imports tags from a legacy tag file and converts them to the current format
}

export type Config = {
	imageFolder: string;
	autotaggerLocation: string;
}

export async function createOrLoadConfig(): Promise<Config> {
	//creates a new config file or loads the existing one
	const defaultConfig: Config = { imageFolder: "", autotaggerLocation: "" };
	const config = await createOrReadFile<Partial<Config>>("config.json", defaultConfig);
	return { ...defaultConfig, ...config };
}

export async function targetAutotaggerLocation(location: string): Promise<void> {
	//sets the target autotagger location for the application
	const config = await createOrLoadConfig();
	config.autotaggerLocation = location;
	await writeFile("config.json", config);
}

export async function setAutotaggerPort(port: string): Promise<void> {
	//sets the autotagger service port in the config
	const config = await createOrLoadConfig();
	config.autotaggerLocation = "PORT:" + port;
	await writeFile("config.json", config);
}

export async function getLastViewedSet(): Promise<Record<string, number>> {
	return createOrReadFile("lastViewed.json", {});
}

export async function viewImage(image: ImageItem): Promise<void> {
	const lastViewedSet = await getLastViewedSet();
	lastViewedSet[image.src] = Date.now();
	await writeFile("lastViewed.json", lastViewedSet);
}

export async function processLegacyImageDB(fileUrl: string): Promise<void> {
	//processes a legacy image database file and adds the tags to the current image database
	//old image database formats will end with V2.0.0 or similar. If they do not, handle that accordingly
	const legacyVersionMatch = fileUrl.match(/V\d+\.\d+\.\d+$/);
	console.log("Legacy version match: ", legacyVersionMatch);
	if (!legacyVersionMatch) {
		//get current image database
		const currentImageDB = await getImageDatabase();
		const legacyImageDB = await createOrReadFile<Record<string, string>>(fileUrl, {});
		const legacyEntries = Object.entries(legacyImageDB);
		for (const [src, tagsString] of legacyEntries) {
			//check if the image already exists in the current image database
			const attemptFixFilePath = await attemptToFixFilePath(src);
			console.log("Attempted fixed file path: ", attemptFixFilePath);
			console.log("Original file path: ", src);

			if (!currentImageDB[attemptFixFilePath]) {
				const fileExists = existsSync(attemptFixFilePath);
				if (!fileExists) {
					continue;
				}

				//get the file stats to determine the size
				const { size, birthtime } = await fs.stat(attemptFixFilePath);
				currentImageDB[attemptFixFilePath] = { src, tags: tagsString.split(" "), createTime: birthtime.getTime(), size: size};
			}else{
				//the image already exists in the current image database, so we might want to merge tags
				const existingTags = currentImageDB[attemptFixFilePath].tags;
				const newTags = tagsString.split(" ");
				const mergedTags = Array.from(new Set([...existingTags, ...newTags]));
				currentImageDB[attemptFixFilePath].tags = mergedTags;
			}
		}
		//save the updated current image database
		await saveImageDatabase(currentImageDB);

		await processImageDB();
		return
	}

	
	console.error("Unsupported legacy image database version: ", legacyVersionMatch[0]);
	return 
}

async function attemptToFixFilePath(filePath: string): Promise<string> {
	//check the file path for ..
	if (filePath.includes("../charecters/") || filePath.includes("../Characters")) {
		//assume that anything after the .. is a possibly valid path, but the .. itself needs to be resolved
		const config = await createOrLoadConfig();
		const configImageFolder = config.imageFolder;
		//config.imageFolder will end in /Characters.
		const replacedFilePath1 = filePath.replace("../charecters", "").replace("../Characters", "")
		//replace any instances in the old file path of "/" with "\"
		//and in the base path, replace any instances of "\" with "\\"
		const fixedBasePath = configImageFolder.replace(/\\/g, "\\");
		const replacedFilePath2 = replacedFilePath1.replace(/\//g, "/");
		//since this must match exactly with the resolved path in the current image database, we return the fixed path
		//that means no resolve because it "Fixes" too much. Just use concatination.
		const fixedPath = fixedBasePath + replacedFilePath2;
		return fixedPath;
	}
	return filePath;
}

export async function loadFavorites() {
	const favorites = await createOrReadFile<Record<string, boolean>>("favorites.json", {});
	return favorites;
}

export async function wipeFavorites(){
	const favorites: Record<string, boolean> = {};
	await writeFile("favorites.json", JSON.stringify(favorites, null, 2));
}

export async function saveFavoriteStatus(favorites: Record<string, boolean>) {
	await writeFile("favorites.json", JSON.stringify(favorites, null, 2));
}

export async function getUpdatedImageTagsForImages(imagePaths: string[]): Promise<Record<string, string[]>> {
	const currentImageDB = await getImageDatabase();
	const updatedTags: Record<string, string[]> = {};
	for (const path of imagePaths) {
		if (currentImageDB[path]) {
			updatedTags[path] = currentImageDB[path].tags;
		}
	}
	return updatedTags;
}