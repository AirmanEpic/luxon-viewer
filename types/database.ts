type Tag = { name: string; count: number; color: string };
type ImageDB = Record<string, ImageItem>;
type ImageItem = { src: string; tags: string[], createTime: number, size: number };
type RecentItem = {query:string, lastUsage: Date};