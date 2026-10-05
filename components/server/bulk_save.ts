"use server"

import { randString } from "@/lib/utils";
import fs from "fs";

export async function bulkSave(oldFilepaths: string[], targetFolder: string) {
  //files should be copied with new filenames to avoid overwriting existing files - the pattern is "File_N_<random_string>.originalExt"
  for (let i = 0; i < oldFilepaths.length; i++) {
    const oldFilepath = oldFilepaths[i];
    const ext = oldFilepath.split(".").pop();
    const newFilename = `File_${i}_${randString(4)}.${ext}`;
    const newFilepath = `${targetFolder}/${newFilename}`;
    fs.copyFileSync(oldFilepath, newFilepath);
  }
}