/**
 * Enumerate every course code present in the committed catalogue datasets
 * (`apps/scraper/data/catalogue/catalogue.<year>.json`), unioned across all
 * years. The grades scraper emits an entry for every catalogue code, mirroring
 * the existing `grades.json` (codes with no grade data get an empty
 * `professors` array).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { readJson } from "../shared/json.ts";
import { CATALOGUE_DATA_DIR } from "../shared/paths.ts";
import { normalizeCode } from "./distribution.ts";

interface CatalogueFile {
  courses?: { code?: string }[];
}

export async function readCatalogueCodes(dir: string = CATALOGUE_DATA_DIR): Promise<Set<string>> {
  const codes = new Set<string>();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return codes;
    throw err;
  }

  const files = entries.filter((f) => f.startsWith("catalogue.") && f.endsWith(".json"));
  for (const file of files) {
    const data = await readJson<CatalogueFile>(path.join(dir, file));
    for (const course of data.courses ?? []) {
      if (course?.code) codes.add(normalizeCode(course.code));
    }
  }
  return codes;
}
