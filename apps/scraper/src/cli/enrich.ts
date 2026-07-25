/**
 * Re-enrich apps/scraper/data/<school>/schedules/schedules.*.json with grade distributions from grades.json.
 * Use when grades.json changes without re-running the schedule scraper.
 *
 * Usage:
 *   pnpm --filter scraper enrich:schedules
 *   pnpm --filter scraper enrich:schedules -- --dry-run
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parseSchoolArg } from "../shared/cliSchool.ts";
import { assertSchoolFeature } from "../shared/schoolFeatures.ts";
import { schedulesDataDir, scraperDataDir } from "../shared/paths.ts";
import {
  buildGradeLookups,
  enrichSchedulesPayload,
  formatGradeEnrichmentLine,
} from "../schedules/enrich.ts";
import type { GradeEnrichmentStats, SchedulesFilePayload } from "../schedules/enrich.ts";

function parseArgs(argv: string[]): { dryRun: boolean } {
  return { dryRun: argv.includes("--dry-run") };
}

export async function main(): Promise<void> {
  const school = parseSchoolArg(process.argv);
  assertSchoolFeature(
    school,
    "grades",
    "Carleton has no public grade data; schedule grade enrichment is uOttawa-only.",
  );
  const { dryRun } = parseArgs(process.argv);

  const gradesPath = path.join(scraperDataDir(school), "grades.json");
  const gradesRaw = JSON.parse(await fs.readFile(gradesPath, "utf-8")) as unknown;
  const lookups = buildGradeLookups(gradesRaw);

  const scheduleDir = schedulesDataDir(school);
  const entries = await fs.readdir(scheduleDir);
  const scheduleFiles = entries.filter((f) => /^schedules\.\d+\.json$/i.test(f)).sort();

  if (scheduleFiles.length === 0) {
    console.warn(`No schedules.*.json files under ${scheduleDir}`);
    return;
  }

  const totals: GradeEnrichmentStats & { files: number } = {
    sectionsTotal: 0,
    matched: 0,
    fallback: 0,
    none: 0,
    files: scheduleFiles.length,
  };

  for (const file of scheduleFiles) {
    const filePath = path.join(scheduleDir, file);
    const stats: GradeEnrichmentStats = { sectionsTotal: 0, matched: 0, fallback: 0, none: 0 };
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as SchedulesFilePayload;
    enrichSchedulesPayload(data, lookups, stats);

    totals.sectionsTotal += stats.sectionsTotal;
    totals.matched += stats.matched;
    totals.fallback += stats.fallback;
    totals.none += stats.none;

    console.log(formatGradeEnrichmentLine(file, stats));

    if (!dryRun) {
      await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
    }
  }

  console.log("---");
  console.log(
    formatGradeEnrichmentLine(`All ${totals.files} file(s)`, {
      sectionsTotal: totals.sectionsTotal,
      matched: totals.matched,
      fallback: totals.fallback,
      none: totals.none,
    }),
  );
  if (dryRun) {
    console.log("Dry run: no files written.");
  }
}

void (async () => {
  try {
    await main();
  } catch (err) {
    console.error("Schedule grade enrichment failed.");
    console.error(err);
    process.exit(1);
  }
})();
