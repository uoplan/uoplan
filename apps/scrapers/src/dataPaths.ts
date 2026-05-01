import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SCRAPER_DATA_DIR = path.resolve(__dirname, "../data");
export const WEB_PUBLIC_DATA_DIR = path.resolve(__dirname, "../../web/public/data");
