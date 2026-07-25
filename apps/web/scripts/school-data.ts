import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHOOL_IDS } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to `apps/scraper/data` — the root of all school datasets. */
export const dataRoot = path.join(__dirname, "..", "..", "scraper", "data");

/** Per-school source paths under `apps/scraper/data/<school>/`. */
export function schoolDataPaths(school: SchoolId) {
  const root = path.join(dataRoot, school);
  return {
    root,
    catalogueDir: path.join(root, "catalogue"),
    termsPath: path.join(root, "terms.json"),
    indicesPath: path.join(root, "indices.json"),
    professorsPath: path.join(root, "professors.json"),
    ratemyprofessorsPath: path.join(root, "ratemyprofessors.json"),
    disciplinesPath: path.join(root, "disciplines.json"),
  };
}

/**
 * Schools that have scraped data on disk, determined by the presence of their
 * `catalogue/catalogue.json`. Schools still being bootstrapped are skipped.
 */
export function schoolsWithData(): SchoolId[] {
  return SCHOOL_IDS.filter((school) =>
    fs.existsSync(path.join(schoolDataPaths(school).catalogueDir, "catalogue.json")),
  );
}
