'use client';
import { open } from '@tauri-apps/plugin-dialog';

export const handleOpenFile = async (filter: { name?: string; extensions?: string[] }[]) => {
	try {
		// Opens a dialog to select a single file
		const selected = await open({
			multiple: false,
			directory: false,
			filter,
		});

		if (selected === null) {
			return null;
		} else {
			return selected;
		}
	} catch (err) {
		return null;
	}
};