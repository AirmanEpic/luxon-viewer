'use client';
import { open } from '@tauri-apps/plugin-dialog';

export const handleOpenFolder = async () => {
	try {
		// Opens a dialog to select a single file
		const selected = await open({
			multiple: false,
			directory: true,
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