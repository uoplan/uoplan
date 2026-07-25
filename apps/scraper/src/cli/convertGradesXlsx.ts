/**
 * Grades xlsx → CSV converter CLI.
 *
 * Reads the registrar Excel exports in `apps/scraper/data/<school>/raw/xlsx`, converts
 * them into the per-term CSV format the grades scraper consumes, and writes
 * `raw/grades.<STRM>.csv`. Run this whenever the xlsx sources change, before
 * `scrape:grades`.
 *
 * Usage: `pnpm --filter scraper grades:convert -- --school uottawa`
 */

import { convertXlsxToCsv } from "../grades/xlsxToCsv.ts";
import { parseSchoolArg } from "../shared/cliSchool.ts";
import { assertSchoolFeature } from "../shared/schoolFeatures.ts";
import { rawDataDir, rawXlsxDir } from "../shared/paths.ts";

void (async () => {
  try {
    const school = parseSchoolArg(process.argv);
    assertSchoolFeature(
      school,
      "grades",
      "Carleton has no public grade data; grade xlsx conversion is uOttawa-only.",
    );
    const outDir = rawDataDir(school);
    const stats = await convertXlsxToCsv(rawXlsxDir(school), outDir);
    console.log(
      `Converted ${stats.files} xlsx → ${stats.terms} per-term CSV(s), ${stats.rows} rows, in ${outDir}`,
    );
  } catch (err) {
    console.error("Grades xlsx → CSV conversion failed:");
    console.error(err);
    process.exit(1);
  }
})();
