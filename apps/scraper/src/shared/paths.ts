import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHOOLS } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCRAPER_DATA_ROOT = path.resolve(__dirname, "../../data");
export const WEB_ASSETS_DATA_ROOT = path.resolve(__dirname, "../../../web/src/assets/data");

/** Generated data-asset manifest consumed by the Cloudflare worker (gitignored). */
export const DATA_MANIFEST_FILE = path.resolve(
  __dirname,
  "../../../../packages/data/src/generated/dataManifest.ts",
);

function schoolDataNamespace(school: SchoolId): string {
  return SCHOOLS[school].assetNamespace;
}

/** Root directory for one school's committed scraper source JSON. */
export function scraperDataDir(school: SchoolId): string {
  return path.join(SCRAPER_DATA_ROOT, schoolDataNamespace(school));
}

/** Root directory for one school's generated runtime protobuf assets. */
export function webAssetsDataDir(school: SchoolId): string {
  return path.join(WEB_ASSETS_DATA_ROOT, schoolDataNamespace(school));
}

export function catalogueDataDir(school: SchoolId): string {
  return path.join(scraperDataDir(school), "catalogue");
}

export function feedbackDataDir(school: SchoolId): string {
  return path.join(scraperDataDir(school), "feedback");
}

export function schedulesDataDir(school: SchoolId): string {
  return path.join(scraperDataDir(school), "schedules");
}

/** Raw grade-distribution CSVs generated from the registrar xlsx exports. */
export function rawDataDir(school: SchoolId): string {
  return path.join(scraperDataDir(school), "raw");
}

/** Registrar Excel grade exports (gitignored); source for the grades converter. */
export function rawXlsxDir(school: SchoolId): string {
  return path.join(rawDataDir(school), "xlsx");
}

/** Committed professor-annotated grade dataset written by the grades scraper. */
export function gradesFile(school: SchoolId): string {
  return path.join(scraperDataDir(school), "grades.json");
}

export function rateMyProfessorsFile(school: SchoolId): string {
  return path.join(scraperDataDir(school), "ratemyprofessors.json");
}
