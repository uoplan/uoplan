/** Plan describing which data assets to load and in what tier. */
export interface DataAssetPlan {
  /** Schedule term ids found in the manifest (`schedules.<termId>.pb`). */
  scheduleTermIds: string[];
  /** Catalogue years found in the manifest (`catalogue.<year>.pb`). */
  catalogueYears: number[];
  /** Newest catalogue year — decoded eagerly for course titles + programs. */
  latestCatalogueYear: number | null;
}

const SCHEDULE_RE = /^schedules\.(.+)\.pb$/;
const CATALOGUE_YEAR_RE = /^catalogue\.(\d{4})\.pb$/;

/**
 * Derive the load plan from the manifest's asset ids: every schedule term and
 * catalogue year, plus the newest catalogue year (the one decoded eagerly for
 * course titles + program data). Pure so it can be unit-tested without the
 * network or proto codecs.
 */
export function planDataAssets(keys: string[]): DataAssetPlan {
  const scheduleTermIds: string[] = [];
  const catalogueYears: number[] = [];

  for (const key of keys) {
    const schedule = SCHEDULE_RE.exec(key);
    if (schedule) {
      scheduleTermIds.push(schedule[1]);
      continue;
    }
    const catalogue = CATALOGUE_YEAR_RE.exec(key);
    if (catalogue) catalogueYears.push(Number(catalogue[1]));
  }

  scheduleTermIds.sort();
  catalogueYears.sort((a, b) => a - b);

  return {
    scheduleTermIds,
    catalogueYears,
    latestCatalogueYear:
      catalogueYears.length > 0 ? catalogueYears[catalogueYears.length - 1] : null,
  };
}
