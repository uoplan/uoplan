// @ts-check
/**
 * Registry of translation ids reached only through *dynamic* `tr()` calls.
 *
 * The AST scanner in `tr-ids.mjs` resolves string-literal and conditional
 * `tr()` arguments, but it cannot resolve template literals
 * (`tr(`explore.sort.${k}`)`) or variable/record lookups (`tr(SUGGESTION_KEY[code])`).
 * Those ids are enumerated here so the tooling can:
 *   1. verify they exist in every locale (`check-i18n.mjs`), and
 *   2. treat them as used so `i18n:sync --prune` never removes them.
 *
 * Each family cites its source enum. These enums change rarely; when they do,
 * update the matching family below — `pnpm check:i18n` fails if a listed id is
 * absent from a catalog, and `i18n:sync --prune` would otherwise drop a catalog
 * key that has no resolvable usage.
 */

/**
 * @param {string} prefix
 * @param {readonly string[]} suffixes
 * @returns {string[]}
 */
const family = (prefix, suffixes) => suffixes.map((s) => `${prefix}${s}`);

/**
 * @param {string} prefix
 * @param {readonly string[]} a
 * @param {readonly string[]} b
 * @returns {string[]}
 */
const cross = (prefix, a, b) => a.flatMap((x) => b.map((y) => `${prefix}${x}.${y}`));

/** @type {string[]} */
export const DYNAMIC_TR_IDS = [
  // apps/web/src/components/explore/ExploreFilterPopoverContent.tsx (LEVELS/LANGUAGES/...)
  // + apps/web/src/components/explore/ExploreFilterBar.tsx
  ...family("explore.filter.level.", ["1000", "2000", "3000", "4000", "5000"]),
  ...family("explore.filter.language.", ["en", "fr"]),
  ...family("explore.filter.difficulty.", ["easy", "moderate", "tough"]),
  ...family("explore.filter.rating.", ["good", "great", "excellent"]),
  ...family("explore.sort.", ["relevance", "avgGrade", "courseCode", "profRating"]),

  // apps/web/src/lib/seo.ts: tr(`seo.${pageId}.${field}`) — seo-pages.json x fields
  ...cross(
    "seo.",
    ["home", "schedule", "explore", "graph", "trends"],
    ["title", "description", "keywords"],
  ),

  // apps/web/src/lib/navigation/appDestinations.ts: dest.labelId / dest.descriptionId
  ...cross(
    "app.nav.dest.",
    ["home", "explore", "schedule", "calendar", "trends", "graph", "changelog"],
    ["label", "description"],
  ),

  // apps/web/src/components/shared/LanguageSwitcher.tsx: LABEL_ID
  "language.en",
  "language.frCA",

  // apps/web/src/theme/themes.ts: labelId
  "theme.dark",
  "theme.light",

  // apps/web/src/lib/generationDiagnosticsText.ts: SUGGESTION_KEY
  ...family("gen.suggest.", [
    "relaxFilters",
    "tryDifferentCourse",
    "turnOffCompressed",
    "clearMinRating",
    "widenHoursDays",
    "relaxFyCap",
    "unBlacklist",
    "widenOrChangePicks",
    "combinedBlockersIntro",
    "structural",
  ]),
  // apps/web/src/lib/generationDiagnosticsText.ts: DAY_SHORT_KEY
  ...family("gen.day.", ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  // apps/web/src/components/shared/ErrorBoundary.tsx + error notification id constants.
  "errorBoundary.title",
  "errorBoundary.message",
  "errorBoundary.reload",
  "notifications.yearCatalogueLoadFailed.title",
  "notifications.yearCatalogueLoadFailed.message",
  "notifications.pushSetupMissing.title",
  "notifications.pushSetupMissing.message",
  "notifications.pushSubscribeFailed.title",
  "notifications.pushSubscribeFailed.message",
  "notifications.pushUnsubscribeFailed.title",
  "notifications.pushUnsubscribeFailed.message",
  "notifications.scheduleWorkerFallback.title",
  "notifications.scheduleWorkerFallback.message",

  // Accessibility workstream: ids intentionally routed through constants until catalogs are updated centrally.
  "calendar.event.ariaLabel",
  "calendar.blockedTime.resizeStart",
  "calendar.blockedTime.resizeEnd",
  "calendarView.previousWeek",
  "calendarView.nextWeek",
  "enrolCli.modal.copyCode",
  "swapCourse.option.conflictAria",
  "swapCourse.option.selectAria",
  "swapCourse.conflictsWith",
  "swapCourse.loading",
  "swapCourse.noAlternatives",
  "swapCourse.poolHad",
  "swapCourse.sort.aplus",
  "swapCourse.sort.rating",
  "swapCourse.sort.alpha",
  "swapCourse.searchPlaceholder",
  "swapCourse.sortBy",
  "swapCourse.noMatches",
  "optionsStep.pager.incomplete",
  "optionsStep.pager.complete",
  "optionsStep.pager.goToWithStatus",
  "basicCourseFilters.toggle",

  // apps/web/src/lib/term/termLabel.ts: SEASON_LABEL_ID
  ...family("term.season.", ["winter", "summer", "fall"]),
];
