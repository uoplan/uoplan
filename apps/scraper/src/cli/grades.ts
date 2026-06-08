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
 * To seed `data/raw` from the existing `grades.json` for local testing, run the
 * throwaway helper at `playground/grades-reverse/reverseFromGrades.mjs` BEFORE
 * this overwrites `grades.json`.
 */

import { runBuild } from "../grades/build.ts";

runBuild().catch((err) => {
  console.error("Grades scrape failed:");
  console.error(err);
  process.exit(1);
});
