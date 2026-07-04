import type { Feature, FeatureCategory, ProductId, SupportLevel } from "./types";

/**
 * Feature categories in display order. Each `/features` / `/compare` section
 * renders in this order.
 */
export const CATEGORIES: readonly FeatureCategory[] = [
  { id: "scheduling", labelId: "compare.category.scheduling" },
  { id: "degree", labelId: "compare.category.degree" },
  { id: "prerequisites", labelId: "compare.category.prerequisites" },
  { id: "grades", labelId: "compare.category.grades" },
  { id: "professors", labelId: "compare.category.professors" },
  { id: "explore", labelId: "compare.category.explore" },
  { id: "enrolment", labelId: "compare.category.enrolment" },
  { id: "sharing", labelId: "compare.category.sharing" },
  { id: "notifications", labelId: "compare.category.notifications" },
  { id: "platforms", labelId: "compare.category.platforms" },
  { id: "access", labelId: "compare.category.access" },
  { id: "privacy", labelId: "compare.category.privacy" },
  { id: "data", labelId: "compare.category.data" },
] as const;

/** Product order for the compact `levels` tuple below. */
const PRODUCT_ORDER: readonly ProductId[] = [
  "uoplan",
  "uenroll",
  "uschedule",
  "uo-grades",
  "coursemapper",
];

type Levels = readonly [SupportLevel, SupportLevel, SupportLevel, SupportLevel, SupportLevel];

/**
 * Compact feature builder. `levels` is ordered per `PRODUCT_ORDER`; `notes`
 * lists the product cells that carry a clarifying note
 * (`compare.feature.<id>.note.<productId>`).
 */
function feat(
  id: string,
  categoryId: string,
  levels: Levels,
  notes: readonly ProductId[] = [],
): Feature {
  const noteSet = new Set(notes);
  const support = Object.fromEntries(
    PRODUCT_ORDER.map((productId, index) => [
      productId,
      {
        level: levels[index] as SupportLevel,
        ...(noteSet.has(productId) ? { noteId: `compare.feature.${id}.note.${productId}` } : null),
      },
    ]),
  ) as Feature["support"];

  return {
    id,
    categoryId,
    nameId: `compare.feature.${id}.name`,
    descId: `compare.feature.${id}.desc`,
    support,
  };
}

/**
 * The full feature matrix — the single source of truth for `/features`,
 * `/compare`, and every `/vs/<slug>` page. Support values reflect competitor
 * research as of 2026-07 and mark genuine uoPlan gaps honestly (e.g. a visual
 * prerequisite graph, hard professor require/block, and live open/closed
 * section status).
 *
 * levels order: [uoplan, uenroll, uschedule, uo-grades, coursemapper]
 */
export const FEATURES: readonly Feature[] = [
  // Schedule generation & optimization
  feat("conflict-free", "scheduling", ["yes", "yes", "yes", "no", "no"]),
  feat("multiple-schedules", "scheduling", ["yes", "yes", "yes", "no", "no"]),
  feat("priorities", "scheduling", ["yes", "no", "yes", "no", "no"]),
  feat("time-day-limits", "scheduling", ["yes", "no", "yes", "no", "no"]),
  feat("blocked-times", "scheduling", ["yes", "no", "no", "no", "no"]),
  feat("exclude-from-generation", "scheduling", ["yes", "yes", "yes", "no", "no"]),
  feat("prof-rating-pref", "scheduling", ["yes", "no", "yes", "no", "no"]),
  feat("swap-course", "scheduling", ["yes", "no", "no", "no", "no"]),
  feat("schedule-score", "scheduling", ["no", "no", "yes", "no", "no"]),

  // Degree & requirement planning
  feat("program-requirements", "degree", ["yes", "no", "no", "no", "no"]),
  feat("completed-courses", "degree", ["yes", "no", "no", "no", "no"]),
  feat("transcript-import", "degree", ["yes", "no", "no", "no", "no"]),
  feat("requirement-pools", "degree", ["yes", "no", "no", "no", "no"]),
  feat("honours-detection", "degree", ["yes", "no", "no", "no", "no"]),

  // Prerequisites
  feat("prereq-checking", "prerequisites", ["yes", "no", "no", "no", "yes"], ["coursemapper"]),
  feat("prereq-graph", "prerequisites", ["no", "no", "no", "no", "yes"]),
  feat("prereq-bilingual", "prerequisites", ["yes", "no", "no", "no", "no"]),

  // Grades & analytics
  feat("grade-distributions", "grades", ["yes", "partial", "no", "yes", "no"], ["uenroll"]),
  feat("grade-trends", "grades", ["yes", "no", "no", "partial", "no"], ["uo-grades"]),
  feat("grade-leaderboard", "grades", ["yes", "no", "no", "no", "no"]),
  feat("grades-in-planner", "grades", ["yes", "no", "no", "no", "no"]),

  // Professors & feedback
  feat("prof-ratings", "professors", ["yes", "no", "yes", "yes", "no"], ["uschedule", "uo-grades"]),
  feat("course-evaluations", "professors", ["yes", "no", "no", "yes", "no"]),
  feat("prof-network", "professors", ["yes", "no", "no", "no", "no"]),
  feat("prof-require-block", "professors", ["no", "no", "yes", "no", "no"]),
  feat("instructor-prediction", "professors", ["yes", "no", "no", "no", "no"]),

  // Course & section exploration
  feat("course-search", "explore", ["yes", "yes", "yes", "yes", "yes"]),
  feat("section-browsing", "explore", ["yes", "yes", "yes", "partial", "no"], ["uo-grades"]),
  feat("language-filter", "explore", ["yes", "yes", "yes", "no", "no"]),
  feat("multi-university", "explore", ["no", "no", "no", "no", "yes"], ["coursemapper"]),

  // Enrolment & registration
  feat("auto-enrol", "enrolment", ["yes", "no", "no", "no", "no"], ["uoplan"]),
  feat("uenroll-import", "enrolment", ["yes", "no", "no", "no", "no"]),

  // Sharing & export
  feat("share-link", "sharing", ["yes", "yes", "yes", "no", "no"]),
  feat("rich-preview", "sharing", ["yes", "no", "yes", "no", "no"]),
  feat("ics-export", "sharing", ["yes", "yes", "yes", "no", "no"]),

  // Notifications
  feat("new-term-alerts", "notifications", ["yes", "no", "no", "no", "no"]),

  // Platforms & apps
  feat("web-app", "platforms", ["yes", "yes", "yes", "yes", "yes"]),
  feat("installable-pwa", "platforms", ["yes", "no", "no", "no", "yes"]),
  feat("ios-app", "platforms", ["yes", "no", "no", "no", "no"]),
  feat("android-app", "platforms", ["yes", "no", "no", "no", "no"]),
  feat("cli", "platforms", ["yes", "no", "no", "no", "no"]),

  // Localization & accessibility
  feat("bilingual", "access", ["yes", "yes", "yes", "yes", "no"]),
  feat("themes", "access", ["yes", "yes", "yes", "no", "no"]),
  feat("command-palette", "access", ["yes", "no", "no", "no", "no"]),

  // Privacy & cost
  feat("free", "privacy", ["yes", "yes", "yes", "yes", "yes"]),
  feat("no-account", "privacy", ["yes", "yes", "yes", "yes", "partial"], ["coursemapper"]),
  feat("ad-free", "privacy", ["yes", "yes", "no", "yes", "no"]),
  feat("open-source", "privacy", ["yes", "yes", "no", "yes", "no"]),

  // Data coverage
  feat("live-section-status", "data", ["no", "yes", "yes", "no", "no"]),
  feat("multi-year-catalogue", "data", ["yes", "no", "no", "yes", "no"], ["uo-grades"]),
  feat("fresh-data", "data", ["yes", "yes", "yes", "yes", "partial"]),
] as const;
