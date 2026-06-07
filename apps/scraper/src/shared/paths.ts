import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SCRAPER_DATA_DIR = path.resolve(__dirname, "../../data");
export const WEB_PUBLIC_DATA_DIR = path.resolve(__dirname, "../../../web/public/data");

export const CATALOGUE_DATA_DIR = path.join(SCRAPER_DATA_DIR, "catalogue");
export const FEEDBACK_DATA_DIR = path.join(SCRAPER_DATA_DIR, "feedback");
export const SCHEDULES_DATA_DIR = path.join(SCRAPER_DATA_DIR, "schedules");
