"use client";

import { TagPill } from "@/app/page";
import { Button } from "./button";  
import { useEffect, useState } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import { saveImageTags } from "../server/imagedb";
import { autoTagImage } from "../server/autotagger";

export function BatchTagInterface(
    { type, onClose, tags, selection }:
    {
        type: "autotagger" | "bulkTagger";
        onClose: () => void;
        tags: string;
        selection: ImageItem[];
    })
{
    const [selectedImages, setSelectedImages] = useState<(ImageItem & { processed: boolean | null })[]>(selection.map(item => ({ ...item, processed: null })));
    const [isProcessing, setIsProcessing] = useState(false);
    useEffect(() => {
        setSelectedImages(selection.map(item => ({ ...item, processed: null })));
    }, [selection]);

    const splitTags = tags.split(",").map(tag => tag.trim());

    async function executeBatchTagging() {
        // Implement the batch tagging logic here
        setSelectedImages(selectedImages.map(item => ({ ...item, processed: false })));
        // for each selected image, apply the tags

        const individualAction = type === "bulkTagger" ? async (item: ImageItem):Promise<void> => {
            const currentTags = item.tags || [];
            const newTags = Array.from(new Set([...currentTags, ...splitTags]));
            item.tags = newTags;
            await saveImageTags(item.src, newTags);
        } : async (item: ImageItem) => {
            // Auto tagging logic for the individual image
            await autoTagImage(item);
        };

        // Execute the individual action for each selected image
        for (const item of selectedImages) {
            try {
                await individualAction(item);
                setSelectedImages(prev => prev.map(prevItem => prevItem.src === item.src ? { ...prevItem, processed: true } : prevItem));
            } catch (error) {
                setSelectedImages(prev => prev.map(prevItem => prevItem.src === item.src ? { ...prevItem, processed: false } : prevItem));
            }
        }
    }

	return (
		<div onClick={(e) => e.stopPropagation()} className="deep-panel absolute left-1/2 transform -translate-x-1/2 right-0 top-11 z-50 rounded-lg p-4 shadow-2xl">
			<h1 className="text-2xl font-bold mb-4">{type === "autotagger" ? "Auto Tagger" : "Bulk Tagger"}</h1>
			
			{type==="bulkTagger" && <div>
				<h3>Tags to be added:</h3>
				<ul>
					{splitTags.map((tag) => (
						<TagPill
							key={tag}
							tag={{ name: tag, color: "#ccc", count: 0 }}
						/>
					))}
				</ul>
			</div>}
			<div >
				<h3>Selection ({selectedImages.length} items)</h3>
				<ul className="max-h-40 overflow-y-auto">
					{selectedImages.map((item) => (
						<li className="flex items-center" key={item.src}>{item.src} {
                            item.processed === null ? <></> 
                                : item.processed ? <LuCheck className="ml-2 text-green-500" /> 
                                    : <LuX className="ml-2 text-red-500" />
                                }
                        </li>
					))}
				</ul>
			</div>
            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    onClick={onClose}
                    className="mt-4"
                >
                    Close
                </Button>
                <Button
                    variant="primary"
                    disabled={isProcessing}
                    onClick={() => {
                        setIsProcessing(true);
                        executeBatchTagging().finally(() => {
                            setIsProcessing(false);
                            alert("Batch tagging completed successfully.");
                            onClose()
                        });
                    }}
                    className="mt-4 ml-auto"
                >
                    {type === "autotagger" ? "Begin Auto Tagging" : "Apply Tags"}
                </Button>
            </div>
		</div>
	);
}