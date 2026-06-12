/**
 * Grades scraper CLI.
 *
 * Reads the raw grade-distribution CSVs in `apps/scraper/data/raw`, attaches the
 * feedback professor(s) to each `(termId, code, section)`, resolves each to a
 * RateMyProfessors professor (canonical name + legacyId), and writes the
 * professor-annotated dataset to `apps/scraper/data/grades.json`.
 *
 * Usage: `pnpm --filter scraper scrape:grades`
 *
 * The raw CSVs are generated from the registrar Excel exports in `raw/xlsx/` by
 * the converter — run `pnpm --filter scraper grades:convert` first whenever the
 * xlsx sources change (see `grades/xlsxToCsv.ts`).
 */

import { runBuild } from "../grades/build.ts";

void (async () => {
  try {
    await runBuild();
  } catch (err) {
    console.error("Grades scrape failed:");
    console.error(err);
    process.exit(1);
  }
})();
