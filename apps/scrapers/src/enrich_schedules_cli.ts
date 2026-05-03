/**
 * Re-enrich apps/scrapers/data/schedules.*.json with grade distributions from grades.json.
 * Use when grades.json changes without re-running the schedule scraper.
 *
 * Usage:
 *   pnpm --filter scrapers enrich:schedules
 *   pnpm --filter scrapers enrich:schedules -- --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { SCRAPER_DATA_DIR } from './dataPaths.ts';
import {
  buildGradeLookups,
  enrichSchedulesPayload,
  formatGradeEnrichmentLine,
  type GradeEnrichmentStats,
  type SchedulesFilePayload,
} from './enrichSchedulesWithGrades.ts';

function parseArgs(argv: string[]): { dryRun: boolean } {
  return { dryRun: argv.includes('--dry-run') };
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv);

  const gradesPath = path.join(SCRAPER_DATA_DIR, 'grades.json');
  const gradesRaw = JSON.parse(await fs.readFile(gradesPath, 'utf-8')) as unknown;
  const lookups = buildGradeLookups(gradesRaw);

  const entries = await fs.readdir(SCRAPER_DATA_DIR);
  const scheduleFiles = entries.filter((f) => /^schedules\.\d+\.json$/i.test(f)).sort();

  if (scheduleFiles.length === 0) {
    console.warn(`No schedules.*.json files under ${SCRAPER_DATA_DIR}`);
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
    const filePath = path.join(SCRAPER_DATA_DIR, file);
    const stats: GradeEnrichmentStats = { sectionsTotal: 0, matched: 0, fallback: 0, none: 0 };
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw) as SchedulesFilePayload;
    enrichSchedulesPayload(data, lookups, stats);

    totals.sectionsTotal += stats.sectionsTotal;
    totals.matched += stats.matched;
    totals.fallback += stats.fallback;
    totals.none += stats.none;

    console.log(formatGradeEnrichmentLine(file, stats));

    if (!dryRun) {
      await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
    }
  }

  console.log('---');
  console.log(
    formatGradeEnrichmentLine(`All ${totals.files} file(s)`, {
      sectionsTotal: totals.sectionsTotal,
      matched: totals.matched,
      fallback: totals.fallback,
      none: totals.none,
    }),
  );
  if (dryRun) {
    console.log('Dry run: no files written.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
