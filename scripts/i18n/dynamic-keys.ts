/**
 * Registry of translation ids reached only through *dynamic* `tr()` calls.
 *
 * The AST scanner in `tr-ids.ts` resolves string-literal and conditional
 * `tr()` arguments, but it cannot resolve template literals
 * (`tr(`explore.sort.${k}`)`) or variable/record lookups (`tr(SUGGESTION_KEY[code])`).
 * Those ids are enumerated here so the tooling can:
 *   1. verify they exist in every locale (`check-i18n.ts`), and
 *   2. treat them as used so `i18n:sync --prune` never removes them.
 *
 * Each family cites its source enum. These enums change rarely; when they do,
 * update the matching family below — `pnpm check:i18n` fails if a listed id is
 * absent from a catalog, and `i18n:sync --prune` would otherwise drop a catalog
 * key that has no resolvable usage.
 */

import { SEO_TR_IDS } from "./seo-keys.ts";

const family = (prefix: string, suffixes: readonly string[]): string[] =>
  suffixes.map((s) => `${prefix}${s}`);

const cross = (prefix: string, a: readonly string[], b: readonly string[]): string[] =>
  a.flatMap((x) => b.map((y) => `${prefix}${x}.${y}`));

export const DYNAMIC_TR_IDS: string[] = [
  // apps/web/src/components/shared/HomeBanner.tsx: tr(`${banner.idBase}.text|.textShort|.cta`)
  // where banner.idBase comes from HOME_BANNERS (apps/web/src/components/shared/homeBanners.tsx),
  // plus the shared dismiss label.
  ...cross(
    "landing.banner.",
    ["donate", "android", "ios", "github", "feedback"],
    ["text", "textShort", "cta"],
  ),
  "landing.banner.dismiss",

  // apps/native/src/app/more/index.tsx + apps/native/src/app/more/language.tsx:
  // the settings language switcher resolves its labels through `const tr = useTr()`
  // (hook binding, which the literal `tr(...)` scanner does not resolve).
  "native.more.settings",
  "native.language.title",
  "native.language.subtitle",
  "native.language.system",
  "native.language.systemDescription",
  "native.language.english",
  "native.language.frenchCanada",
  "native.language.currentSystem",

  // apps/web/src/components/explore/ExploreFilterPopoverContent.tsx (LEVELS/LANGUAGES/...)
  // + apps/web/src/components/explore/ExploreFilterBar.tsx
  ...family("explore.filter.level.", ["1000", "2000", "3000", "4000", "5000"]),
  ...family("explore.filter.language.", ["en", "fr"]),
  ...family("explore.filter.difficulty.", ["easy", "moderate", "tough"]),
  ...family("explore.filter.rating.", ["good", "great", "excellent"]),
  ...family("explore.filter.feedback.", ["good", "great", "excellent"]),
  ...family("explore.sort.", ["relevance", "grade", "code", "rating", "feedback"]),

  // apps/web/src/lib/seo.ts: tr(`seo.${pageId}.${field}`) for every seo-pages.json page.
  ...SEO_TR_IDS,

  // apps/web/src/lib/navigation/appDestinations.ts: dest.labelId / dest.descriptionId
  ...cross(
    "app.nav.dest.",
    ["home", "explore", "personalize", "schedule", "trends", "graph", "changelog"],
    ["label", "description"],
  ),

  // apps/web/src/theme/themes.ts: labelId
  "theme.dark",
  "theme.light",
  "theme.geegees",

  // apps/web/src/lib/easterEggs/seasonal.ts: tr(flourish.msgId)
  ...family("easterEgg.seasonal.", [
    "newYear",
    "aprilFools",
    "canadaDay",
    "halloween",
    "examSeason",
    "holidays",
    "winter",
  ]),

  // apps/web/src/lib/generationDiagnosticsText.ts: SUGGESTION_KEY
  ...family("gen.suggest.", [
    "relaxFilters",
    "tryDifferentCourse",
    "turnOffCompressed",
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
  "notifications.scheduleGenerationCancelled.title",
  "notifications.scheduleGenerationCancelled.message",
  // apps/web/src/components/steps/NotificationToggle.tsx: warning reason ids
  "notifications.warning.unsupported",
  "notifications.warning.iosHomeScreen",
  "notifications.warning.blocked",

  // Accessibility workstream: ids intentionally routed through constants until catalogs are updated centrally.
  "calendar.event.ariaLabel",
  "calendar.blockedTime.resizeStart",
  "calendar.blockedTime.resizeEnd",
  "calendar.blockedTime.remove",
  "calendarView.previousWeek",
  "calendarView.nextWeek",
  "enrolCli.modal.copyCode",
  "swapCourse.option.conflictAria",
  "swapCourse.option.selectAria",
  "swapCourse.conflictsWith",
  "swapCourse.loading",
  "swapCourse.noAlternatives",
  "swapCourse.poolHad",
  "swapCourse.searchPlaceholder",
  "swapCourse.noMatches",
  "swapCourse.group.bestMatches",
  "swapCourse.group.otherOptions",
  "swapCourse.sort.label",
  "swapCourse.sort.best",
  "swapCourse.sort.aplus",
  "swapCourse.sort.rating",
  "swapCourse.sort.alpha",
  "swapCourse.filter.label",
  "swapCourse.difficulty.all",
  "swapCourse.difficulty.easy",
  "swapCourse.difficulty.moderate",
  "swapCourse.difficulty.tough",
  "optionsStep.pager.incomplete",
  "optionsStep.pager.complete",
  "optionsStep.pager.goToWithStatus",
  "basicCourseFilters.toggle",

  // apps/web/src/lib/term/termLabel.ts: SEASON_LABEL_ID
  ...family("term.season.", ["winter", "summer", "fall"]),

  // apps/web/src/components/trends/GradeBandAreaCard.tsx: BAND_LABEL_KEY
  ...family("trends.band.", [
    "failing",
    "lowPass",
    "midPass",
    "good",
    "nearExcellent",
    "excellent",
    "withdrew",
  ]),

  // apps/web/src/components/basket/BasketContents.tsx (I18N record), BasketFab.tsx, BasketDrawer.tsx,
  // AddToBasketButton.tsx: ids routed through the local I18N constant maps or the `useTr()` result
  // (member-access / hook binding, which the literal `tr(...)` scanner does not resolve).
  "basket.title",
  "basket.credits",
  "basket.cta.viewSchedule",
  "basket.removeCourse",
  "basket.viewCourse",
  "basket.removePrompt",
  "basket.confirmRemove",
  "basket.cancelRemove",
  ...family("basket.add", ["", ".aria"]),
  ...family("basket.added", ["", ".aria"]),
  ...family("basket.fab.", ["open", "openEmpty", "label"]),
  ...family("basket.summary.", ["collapse", "expand"]),
  ...family("basket.stat.", [
    "creditsPlaced.tip",
    "requirementsCovered.tip",
    "requirementsRemaining.tip",
    "courseCount.tip",
    "credits.tip",
  ]),
  ...family("basket.noProgram.", ["copy", "link"]),
  ...family("basket.empty.", ["title", "body", "cta"]),
  ...family("basket.badge.", ["placed", "pinned"]),
  ...family("basket.details.", ["hide", "show"]),
  ...family("basket.breakdown.", [
    "title",
    "assigned",
    "completed",
    "unavailable",
    "prereqUnmet",
    "overflow",
    "noRequirement",
    "standalone",
  ]),
  ...family("basket.stillNeeded.", [
    "title",
    "empty",
    "progress",
    "noSuggestions",
    "moreCourses",
    "untitled",
  ]),
  ...family("basket.status.", [
    "assigned",
    "completed",
    "unavailable",
    "prereqUnmet",
    "overflow",
    "noRequirement",
    "required",
    "standalone",
  ]),

  // apps/web/src/lib/comparison/* — the comparison matrix (features.ts / products.ts)
  // drives /features, /compare, and /vs/<slug>. These ids are reached through data
  // (feature.nameId/descId, category.labelId, product.taglineId, support.noteId,
  // meta.labelId) and the template tr(`vs.intro.${slug}`), which the literal scanner
  // cannot resolve.
  ...family("compare.category.", [
    "scheduling",
    "degree",
    "prerequisites",
    "grades",
    "professors",
    "explore",
    "enrolment",
    "sharing",
    "notifications",
    "platforms",
    "access",
    "privacy",
    "data",
  ]),
  ...cross("compare.product.", ["uoplan", "uenroll", "uschedule", "uo-grades"], ["tagline"]),
  ...cross(
    "compare.feature.",
    [
      "conflict-free",
      "multiple-schedules",
      "priorities",
      "time-day-limits",
      "blocked-times",
      "exclude-from-generation",
      "prof-rating-pref",
      "swap-course",
      "schedule-score",
      "program-requirements",
      "completed-courses",
      "transcript-import",
      "requirement-pools",
      "honours-detection",
      "degree-map",
      "prereq-checking",
      "prereq-graph",
      "prereq-bilingual",
      "grade-distributions",
      "grade-trends",
      "grade-leaderboard",
      "grades-in-planner",
      "prof-ratings",
      "course-evaluations",
      "prof-network",
      "prof-require-block",
      "instructor-prediction",
      "course-search",
      "section-browsing",
      "language-filter",
      "auto-enrol",
      "uenroll-import",
      "share-link",
      "rich-preview",
      "ics-export",
      "new-term-alerts",
      "web-app",
      "installable-pwa",
      "ios-app",
      "android-app",
      "cli",
      "bilingual",
      "themes",
      "command-palette",
      "free",
      "no-account",
      "ad-free",
      "open-source",
      "live-section-status",
      "multi-year-catalogue",
      "fresh-data",
    ],
    ["name", "desc"],
  ),
  ...family("compare.support.", ["yes", "partial", "no"]),
  // Sparse per-cell clarifying notes (compare.feature.<id>.note.<productId>).
  "compare.feature.grade-distributions.note.uenroll",
  "compare.feature.grade-trends.note.uo-grades",
  "compare.feature.prof-ratings.note.uschedule",
  "compare.feature.prof-ratings.note.uo-grades",
  "compare.feature.section-browsing.note.uo-grades",
  "compare.feature.auto-enrol.note.uoplan",
  "compare.feature.multi-year-catalogue.note.uo-grades",
  // Passed as props to <VsLinkGrid ctaId=...>, so resolved via tr(ctaId, {name}).
  "compare.vsLinks.cta",
  "features.vs.cardCta",
  ...family("vs.intro.", ["uenroll", "uschedule", "uo-grades"]),
];
