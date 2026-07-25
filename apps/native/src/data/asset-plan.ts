/** Plan describing which data assets to load and in what tier. */
export interface DataAssetPlan {
  /** Schedule term ids found in the manifest (`<school>/schedules.<termId>.pb`). */
  scheduleTermIds: string[];
  /** Catalogue years found in the manifest (`<school>/catalogue.<year>.pb`). */
  catalogueYears: number[];
  /** Newest catalogue year — decoded eagerly for course titles + programs. */
  latestCatalogueYear: number | null;
}

const SCHEDULE_RE = /^(?:[^/]+\/)?schedules\.(.+)\.pb$/;
const CATALOGUE_YEAR_RE = /^(?:[^/]+\/)?catalogue\.(\d{4})\.pb$/;

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

/**
 * Returns `true` if `id` is a course-description shard asset
 * (`catalogue.descriptions.<shardId>.pb`). These are loaded on-demand by
 * {@link DataClient.loadCourseDescription} and must never be eagerly or
 * background-fetched.
 */
export function isCourseDescriptionAsset(id: string): boolean {
  const bareId = id.split("/").pop() ?? id;
  return bareId.startsWith("catalogue.descriptions.") && bareId.endsWith(".pb");
}

/**
 * Returns the subset of `manifestIds` that should be fetched in the background
 * (i.e. cached for offline use but not decoded up front). Excludes both the
 * IDs already fetched eagerly (`eagerIds`) and course-description shards, which
 * are loaded on-demand by {@link DataClient.loadCourseDescription}.
 */
export function backgroundPrefetchAssetIds(
  manifestIds: readonly string[],
  eagerIds: ReadonlySet<string>,
): string[] {
  return manifestIds.filter((id) => !eagerIds.has(id) && !isCourseDescriptionAsset(id));
}
