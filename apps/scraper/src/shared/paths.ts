import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SCRAPER_DATA_DIR = path.resolve(__dirname, "../../data");
export const WEB_ASSETS_DATA_DIR = path.resolve(__dirname, "../../../web/src/assets/data");

/** Generated data-asset manifest consumed by the Cloudflare worker (gitignored). */
export const DATA_MANIFEST_FILE = path.resolve(
  __dirname,
  "../../../../packages/data/src/generated/dataManifest.ts",
);

export const CATALOGUE_DATA_DIR = path.join(SCRAPER_DATA_DIR, "catalogue");
export const FEEDBACK_DATA_DIR = path.join(SCRAPER_DATA_DIR, "feedback");
export const SCHEDULES_DATA_DIR = path.join(SCRAPER_DATA_DIR, "schedules");

/** Raw grade-distribution CSVs (gitignored; generated from the xlsx via the
 * grades converter, then read by the grades scraper). */
export const RAW_DATA_DIR = path.join(SCRAPER_DATA_DIR, "raw");
/** Registrar Excel grade exports (gitignored); source for the grades converter. */
export const RAW_XLSX_DIR = path.join(RAW_DATA_DIR, "xlsx");
/** Committed professor-annotated grade dataset (written by the grades scraper). */
export const GRADES_FILE = path.join(SCRAPER_DATA_DIR, "grades.json");
export const RATEMYPROFESSORS_FILE = path.join(SCRAPER_DATA_DIR, "ratemyprofessors.json");
