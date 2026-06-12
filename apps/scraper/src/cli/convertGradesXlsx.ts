/**
 * Grades xlsx → CSV converter CLI.
 *
 * Reads the registrar Excel exports in `apps/scraper/data/raw/xlsx`, converts
 * them into the per-term CSV format the grades scraper consumes, and writes
 * `raw/grades.<STRM>.csv`. Run this whenever the xlsx sources change, before
 * `scrape:grades`.
 *
 * Usage: `pnpm --filter scraper grades:convert`
 */

import { convertXlsxToCsv } from "../grades/xlsxToCsv.ts";
import { RAW_DATA_DIR, RAW_XLSX_DIR } from "../shared/paths.ts";

void (async () => {
  try {
    const stats = await convertXlsxToCsv(RAW_XLSX_DIR, RAW_DATA_DIR);
    console.log(
      `Converted ${stats.files} xlsx → ${stats.terms} per-term CSV(s), ${stats.rows} rows, in ${RAW_DATA_DIR}`,
    );
  } catch (err) {
    console.error("Grades xlsx → CSV conversion failed:");
    console.error(err);
    process.exit(1);
  }
})();
