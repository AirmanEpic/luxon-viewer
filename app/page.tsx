"use client"

import {
	LuChevronDown as ChevronDown,
	LuChevronLeft as ChevronLeft,
	LuChevronRight as ChevronRight,
	LuHeart as Heart,
	LuLayers3 as Layers3,
	LuSearch as Search,
	LuSettings as Settings,
	LuSparkles as Sparkles,
	LuStar as Star,
	LuX as X,
} from "react-icons/lu";
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createOrLoadConfig, createOrLoadTagDatabase, getRecentItems, processImageDB, processLegacyImageDB, saveFavoriteStatus, saveImageTags, targetImageFolder, viewImage, wipeFavorites } from "@/components/server/imagedb";
import { getMatchingImages } from "@/components/server/search";
import { HelpModal } from "@/components/ui/helpModal";
import { ModalBack } from "@/components/ui/modal";
import { handleOpenFolder } from "@/components/Tauri/handleOpenFolder";
import { handleOpenFile } from "@/components/Tauri/handleOpenFile";
import { BatchTagInterface } from "@/components/ui/batchTaggerInterface";

export function TagPill({ tag, removable, onRemove }: { tag: Tag; removable?: boolean; onRemove?: () => void }) {
	return (
		<span className="glass-panel inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs text-foreground">
			<span className={`size-2 rounded-full`} style={{ backgroundColor: tag.color }} />
			{tag.name}
			<span className="font-mono text-[10px] text-muted-foreground mt-[2.4px]">{tag.count.toLocaleString()}</span>
			{removable && (
				<button aria-label={`Remove ${tag.name}`} className="ml-0.5 text-muted-foreground hover:text-foreground" onClick={onRemove}>
					<X className="size-3" />
				</button>
			)}
		</span>
	);
}

export default function Index() {
	const [imageIndex, setImageIndex] = useState(0);
	const [batchMode, setBatchMode] = useState(false);
	const [favorite, setFavorite] = useState(false);
	const [aliasStrength, setAliasStrength] = useState(66);
	const [query, setQuery] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [recentOpen, setRecentOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [currentTags, setCurrentTags] = useState<string[]>([]);
	const [tagText, setTagText] = useState("");
	const [batchTags, setBatchTags] = useState("");
	const [status, setStatus] = useState("Ready");
	const searchRef = useRef<HTMLInputElement>(null);
	const [tagDB, setTagDB] = useState<Tag[]>([]);
	const [images, setImages] = useState<ImageItem[]>([]);
	const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
	const dragRef = useRef<{ px: number; py: number; moved: boolean } | null>(null);
	const viewedSrc = (images[imageIndex] ?? images[0])?.src;
	useEffect(() => {
		setView({ scale: 1, x: 0, y: 0 });
	}, [viewedSrc]);
	const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
	const [masterLoading, setMasterLoading] = useState(true);
	const [helpModalOpen, setHelpModalOpen] = useState(false);
	const [batchTagInterfaceOpen, setBatchTagInterfaceOpen] = useState<"autotagger"|"bulkTagger"|null>(null);
	const [favorites, setFavorites] = useState<Record<string, boolean>>({});

	const tagDBAsMap = tagDB.reduce((map, tag) => {
		map[tag.name] = tag;
		return map;
	}, {} as Record<string, Tag>);

	const goToImage = (direction: number) => {
		//save the current image's tags before navigating away
		const currentImage = images[imageIndex];
		if (currentImage) {
			currentImage.tags = currentTags;
			saveImageTags(currentImage.src, currentTags);
		}
		

		const next = (imageIndex + direction + images.length) % images.length;
		const nextImage = images[next] ?? images[0];
		if (!nextImage) return;
		setImageIndex(next);
		// Assuming the value in ImageDB is a string (e.g., image URL or path)
		setCurrentTags(nextImage.tags);
		setTagText(nextImage.tags.join(", "));
		setFavorite(!!favorites[nextImage.src]);
		setStatus(`${next + 1} of ${images.length}`);
		console.log("favorites: ", favorites);
		viewImage(nextImage);
	};

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				searchRef.current?.focus();
				setSearchOpen(true);
			}
			if (event.key === "?") {
				setHelpModalOpen(true);
			}
			if (event.key === "ArrowLeft") goToImage(-1);
			if (event.key === "ArrowRight") goToImage(1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [imageIndex]);

	const fetchImages = async (searchQuery: string) => {
		const imgs = await getMatchingImages(searchQuery, aliasStrength, favorites);
		setImages(imgs);
	};

	const submitSearch = (searchQuery: string) => {
		setQuery(searchQuery);
		setSearchOpen(false);
		setImageIndex(0);
		setStatus(searchQuery ? `Searching “${searchQuery}”` : "Showing all images");
		void fetchImages(searchQuery);
	};

	useEffect(() => {
		//wipe favorites on initial load
		const wipeFavoritesOnLoad = async () => {
			await wipeFavorites();
			console.log("Wiping favorites on initial load");
			setFavorites({});
		};
		wipeFavoritesOnLoad();

		// trigger an initial db run to process images that may be new since the last run
		const processInitialDB = async () => {
			await processImageDB();
		};
		processInitialDB();
		// Fetch initial tag database
		const fetchTags = async () => {
			const tags = await createOrLoadTagDatabase();
			setTagDB(tags);
		};

		const loadInitialImages = async () => {
			if (isTauri()) {
				const config = await createOrLoadConfig();
				if (config.imageFolder) {
					await invoke("allow_image_directory", { path: config.imageFolder });
				}
			}
			return getMatchingImages("", aliasStrength, favorites);
		};

		void loadInitialImages().then(setImages);
		fetchTags();
		const fetchRecentItems = async () => {
			const items = await getRecentItems();
			setRecentItems(items);
		};
		fetchRecentItems();
		setMasterLoading(false);
	}, []);

	// Sync editor state with the first image whenever a new image list is loaded
	useEffect(() => {
		const first = images[0];
		if (!first) return;
		setCurrentTags(first.tags);
		setTagText(first.tags.join(", "));
		setFavorite(!!favorites[first.src]);
	}, [images]);

	const applyTagText = () => {
		const parsed = tagText.split(",").map((tag) => tag.trim()).filter(Boolean);
		setCurrentTags(parsed);
		setStatus("Tags updated");
	};

	const selectSearch = (tag: string) => {
		submitSearch(tag);
	};

	const currentImage = images[imageIndex] ?? images[0];

	return (
		
		<div className="flex h-screen min-h-[640px] w-full flex-col overflow-hidden bg-background text-foreground antialiased">
			{masterLoading && <div className="flex h-screen items-center justify-center">
					<span>Loading...</span>
				</div>
			}
			{helpModalOpen && (
				<ModalBack onClose={() => setHelpModalOpen(false)}>
					<HelpModal setHelpModalOpen={setHelpModalOpen}></HelpModal>
				</ModalBack>
			)}
			{batchTagInterfaceOpen && (
				<ModalBack onClose={() => setBatchTagInterfaceOpen(null)}>
					<BatchTagInterface type={batchTagInterfaceOpen} onClose={() => setBatchTagInterfaceOpen(null)} tags={batchTags} selection={images} />
				</ModalBack>
			)}
			<header className="specular relative z-30 shrink-0 border-b border-border/70 bg-surface/95">
				<div className="flex h-[100px] items-center gap-3 px-4">
					<div className="hidden shrink-0 items-center gap-2.5 border-r border-border/70 pr-4 lg:flex">
						<div className="glass-panel grid size-8 place-items-center rounded-lg font-display text-sm font-bold text-primary">L</div>
						<div className="leading-none">
							<div className="font-display text-[15px] font-semibold">Luxon</div>
							<div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Image viewer</div>
						</div>
					</div>

					<div className="min-w-0 flex-1 self-stretch py-2">
						<div className="flex items-center gap-2">
							<div className="relative mx-auto w-full max-w-xl">
								<div className="glass-panel flex h-9 items-center gap-2 rounded-lg px-3 focus-within:border-primary/50">
									<Search className="size-4 shrink-0 text-muted-foreground" />
									<input
										ref={searchRef}
										value={query}
										onChange={(event) => {
											setQuery(event.target.value);
											setSearchOpen(true);
										}}
										onKeyDown={(event) => {
											if (event.key === "Enter") submitSearch(query);
										}}
										onFocus={() => setSearchOpen(true)}
										onBlur={() => setSearchOpen(false)}
										className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
										placeholder="Search tags"
										aria-label="Search tags"
									/>
									<kbd className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">⌘K</kbd>
									<kbd onClick={() => {
										setSearchOpen(false)
										setHelpModalOpen(true);
									}} className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground cursor-pointer">⇧?</kbd>
								</div>
								{searchOpen && (
									<div className="deep-panel absolute left-0 right-0 top-11 z-50 rounded-lg p-1.5 shadow-2xl">
										<div className="px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Suggested</div>
										{tagDB.filter(tag => tag.name.toLowerCase().startsWith(query.split(" ").at(-1)?.toLowerCase() ?? "")).slice(0, 10).map((tag) => (
											<Button key={tag.name}
												onClick={() => selectSearch(tag.name)}
												onMouseDown={(event) => event.preventDefault()}
												className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-overlay"
												variant="ghost"
											>
												<span className={`size-2.5 rounded-full`} style={{ backgroundColor: tag.color }} />
												<span className="text-sm">{tag.name}</span>
												<span className="ml-auto font-mono text-[10px] text-muted-foreground">
													{tag.count.toLocaleString()}
												</span>
											</Button>
										))}
									</div>
								)}
							</div>
							<div className="glass-panel hidden h-9 shrink-0 items-center gap-2.5 rounded-lg px-3 md:flex">
								<label htmlFor="alias" className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Alias</label>
								<input
									id="alias"
									type="range"
									min="0"
									max="100"
									value={aliasStrength}
									onChange={(event) => setAliasStrength(Number(event.target.value))}
									className="h-1 w-20 accent-primary"
								/>
								<span className="w-7 text-right font-mono text-[10px] text-primary">{aliasStrength}%</span>
							</div>
						</div>
						<div className="scrollbar-thin mt-2 flex items-center gap-2 overflow-x-auto pb-1">
							<span className="shrink-0 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Tags</span>
							{tagDB.map((tag) => <TagPill key={tag.name} tag={tag} />)}
						</div>
					</div>

					<div className="relative hidden shrink-0 xl:block">
						<Button variant="ghost" onClick={() => setRecentOpen(!recentOpen)} className="h-9 px-3 text-xs">
								<span className="text-muted-foreground">Recent</span>
								<ChevronDown className="size-3" />
						</Button>
						{recentOpen && (
							<div className="deep-panel absolute right-0 top-11 z-50 w-52 rounded-lg p-1.5 shadow-2xl">
								{recentItems.map((item) => (
									<button
										key={item.query}
										onClick={() => {
													submitSearch(item.query);
											setRecentOpen(false);
										}}
										className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-overlay"
									>
										{item.query}
									</button>
								))}
							</div>
						)}
					</div>
					<div className="relative flex shrink-0 items-center gap-2 border-l border-border/70 pl-3">
						<Button
							aria-label="Settings"
							title="Settings"
							variant="glass"
							onClick={() => setSettingsOpen(!settingsOpen)}
							className="size-9 p-0"
						>
								<Settings className="size-4" />
						</Button>
						<Button
							variant={batchMode ? "primary" : "glass"}
							onClick={() => {
								setBatchMode(!batchMode);
								setStatus(batchMode ? "Normal mode" : "Batch mode");
							}}
							className="h-9 px-3"
						>
							<Layers3 className="size-4" />
							<span className="hidden sm:inline">Batch</span>
						</Button>
						{settingsOpen && (
							<div className="deep-panel absolute right-0 top-12 z-50 w-64 rounded-lg p-3 shadow-2xl">
								<div className="font-display text-sm font-semibold">Settings</div>
								<label className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
									<span>Show image metadata</span>
									<input type="checkbox" defaultChecked className="accent-primary" />
								</label>
								<label className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
									<span>Keyboard navigation</span>
									<input type="checkbox" defaultChecked className="accent-primary" />
								</label>
								<Button
									variant="glass"
									onClick={async ()=>{
										const folder = await handleOpenFolder();
										if (folder) {
											if (isTauri()) {
												await invoke("allow_image_directory", { path: folder });
											}
											await targetImageFolder(folder);
											const imgs = await getMatchingImages(query, aliasStrength, favorites);
											setImages(imgs);
											setImageIndex(0);
										}
									}}
									className="mt-3 w-full"
								>
									Locate base image folder
								</Button>
								<Button
									variant="glass"
									onClick={async ()=>{
										const folder = await handleOpenFile([{extensions: ["json"] }]);
										if (folder) {
											await processLegacyImageDB(folder);
											const imgs = await getMatchingImages(query, aliasStrength, favorites);
											setImages(imgs);
											setImageIndex(0);
										}
									}}
									className="mt-3 w-full"
								>
									Load legacy Img DB
								</Button>
							</div>
						)}
					</div>
				</div>
			</header>

			<main className="relative flex min-h-0 flex-1 items-center justify-center bg-background py-3 sm:py-6">
				<div
					className={"relative flex h-full w-full items-center justify-center overflow-hidden border-y border-border/70 bg-surface shadow-2xl " + "cursor-grab touch-none select-none active:cursor-grabbing"}
					onWheel={(e) => {
						const rect = e.currentTarget.getBoundingClientRect();
						const cx = e.clientX - rect.left - rect.width / 2;
						const cy = e.clientY - rect.top - rect.height / 2;
						const factor = Math.exp(-e.deltaY * 0.0015);
						setView((v) => {
							const scale = Math.min(20, Math.max(0.1, v.scale * factor));
							const ratio = scale / v.scale;
							return { scale, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio };
						});
					}}
					onPointerDown={(e) => {
						if (e.button !== 0) return;
						dragRef.current = { px: e.clientX, py: e.clientY, moved: false };
					}}
					onPointerMove={(e) => {
						const d = dragRef.current;
						if (!d) return;
						const dx = e.clientX - d.px;
						const dy = e.clientY - d.py;
						if (!d.moved && Math.hypot(dx, dy) < 4) return;
						if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
						d.moved = true;
						d.px = e.clientX;
						d.py = e.clientY;
						setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
					}}
					onPointerUp={(e) => {
						if (dragRef.current?.moved && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
						dragRef.current = null;
					}}
					onPointerCancel={() => {
						dragRef.current = null;
					}}
					onDoubleClick={() => setView({ scale: 1, x: 0, y: 0 })}
				>
					{currentImage && (
						<img
							key={currentImage.src}
							src={isTauri() ? convertFileSrc(currentImage.src) : currentImage.src}
							width={1600}
							height={1000}
							draggable={false}
							style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
							className="h-full w-full select-none object-contain"
						/>
					)}
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-background/20 via-transparent to-foreground/5" />
					<Button
						aria-label="Previous image"
						title="Previous image"
						variant="ghost"
						onClick={() => goToImage(-1)}
						className={
							"absolute inset-y-0 left-0 h-full w-[18%] rounded-none border-0 bg-transparent p-0 text-foreground/50 " +
							"hover:bg-gradient-to-r hover:from-background/60 hover:to-transparent hover:text-foreground"
						}
					>
						<ChevronLeft className="size-9" />
					</Button>
					<Button
						aria-label="Next image"
						title="Next image"
						variant="ghost"
						onClick={() => goToImage(1)}
						className={
							"absolute inset-y-0 right-0 h-full w-[18%] rounded-none border-0 bg-transparent p-0 text-foreground/50 " +
							"hover:bg-gradient-to-l hover:from-background/60 hover:to-transparent hover:text-foreground"
						}
					>
						<ChevronRight className="size-9" />
					</Button>
					{currentImage && (
						<div className="glass-panel absolute left-1/2 top-3 -translate-x-1/2 rounded-full px-3 py-1 font-mono text-[10px] text-muted-foreground">
							{currentImage.src.split("/").pop()} · {imageIndex + 1}/{images.length}
						</div>
					)}
					<div aria-live="polite" className="glass-panel absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] text-muted-foreground">
						{status}
					</div>
				</div>
			</main>

			<footer className="specular relative z-20 shrink-0 border-t border-border/70 bg-surface/95">
				{!batchMode ? (
					<div className="flex min-h-24 items-center gap-4 px-4 py-3">
						<div className="hidden w-72 shrink-0 lg:block">
							<div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Current tags</div>
							<div className="scrollbar-thin flex max-h-14 flex-wrap gap-1.5 overflow-y-auto">
								{currentTags.map((name) => {
									const name2 = name.trim();
									if (!name2) return null;
									const tag = tagDBAsMap[name2] ?? { name: name2, count: 0, color: "bg-muted-foreground" };
									return <TagPill key={name2} tag={tag} removable
											onRemove={() => {
												const next = currentTags.filter((item) => item !== name2);
												setCurrentTags(next);
												setTagText(next.join(", "));
											}}
										/>;
								})}
							</div>
						</div>
						<div className="min-w-0 flex-1">
							<div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Tag list</div>
							<div className="glass-panel flex h-11 items-center rounded-lg px-3 focus-within:border-primary/50">
								<input
									value={tagText}
									onChange={(event) => setTagText(event.target.value)}
									onBlur={applyTagText}
									onKeyDown={(event) => {
										if (event.key === "Enter") applyTagText();
									}}
									className="w-full bg-transparent font-mono text-xs outline-none"
									aria-label="Image tags"
								/>
							</div>
						</div>
						<Button
							variant={favorite ? "favorite" : "glass"}
							onClick={() => {
								setFavorite(!favorite);
								setStatus(favorite ? "Removed from favorites" : "Added to favorites");
								const newFavorites = { ...favorites, [currentImage.src]: !favorite };
								saveFavoriteStatus(newFavorites);
								setFavorites(newFavorites);
							}}
							className="h-11 shrink-0 px-4"
						>
							{favorite ? <Star className="size-4 fill-current" /> : <Heart className="size-4" />}
							<span className="hidden sm:inline">{favorite ? "Starred" : "Star"}</span>
						</Button>
					</div>
				) : (
					<div className="flex min-h-24 items-center gap-3 px-4 py-3">
						<div className="w-32 shrink-0">
							<div className="text-[9px] uppercase tracking-[0.18em] text-primary">Batch mode</div>
							<div className="mt-1 font-display text-sm font-semibold">{images.length} selected</div>
						</div>
						<div className="min-w-0 flex-1">
							<div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
								Batch add tags
							</div>
							<div className="glass-panel flex h-11 items-center rounded-lg px-3">
								<input
									value={batchTags}
									onChange={(event) => setBatchTags(event.target.value)}
									placeholder="Add comma-separated tags to selected images…"
									className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
								/>
							</div>
						</div>
						<Button variant="primary" disabled={!batchTags.trim()} onClick={() => {
							setBatchTagInterfaceOpen("bulkTagger");
						}}
							className="h-11 px-4">
								Batch tag
						</Button>
						<Button variant="glass" onClick={() => setBatchTagInterfaceOpen("autotagger")} className="h-11 px-4">
							<Sparkles className="size-4" /><span className="hidden sm:inline">Autotag</span>
						</Button>
						
						<Button aria-label="Exit batch mode" title="Exit batch mode" variant="ghost" onClick={() => setBatchMode(false)} className="size-11 p-0">
							<X className="size-4" />
						</Button>
					</div>
				)}
			</footer>
		</div>
	);
}
