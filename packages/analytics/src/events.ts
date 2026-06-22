/**
 * Cross-platform analytics event taxonomy. A single source of truth for event
 * names + their property shapes so the web (posthog-js) and native
 * (posthog-react-native) adapters stay consistent.
 *
 * Privacy contract: properties carry only catalog/derived identifiers
 * (course codes, program ids, counts, durations) — never personal data and
 * never raw free-text user input (e.g. transcript contents, search queries).
 */

/** The locale codes the apps support. */
export type AnalyticsLocale = "en" | "fr-CA";

export type GenerationMode = "basic" | "advanced";

export type CompletedCoursesSource = "manual" | "transcript" | "uenroll";

export type ScheduleExportTarget = "ics" | "calendar";

/**
 * Maps every analytics event name to the (optional) properties captured with
 * it. Use `Record<string, never>` for events that carry no properties.
 */
export interface AnalyticsEventMap {
  // --- Planner flow -------------------------------------------------------
  term_selected: { termCode: string };
  program_selected: { programId: string; level?: string };
  completed_courses_updated: { count: number; source?: CompletedCoursesSource };
  requirements_viewed: { programId?: string };
  preferences_updated: { field: string };

  // --- Schedule generation ------------------------------------------------
  // `programId`/`completedCount`/`requirementCount` are optional, non-PII
  // segmentation dimensions (catalog program id + counts) so funnels and
  // drop-off can be broken down by program and academic load.
  schedule_generate_started: {
    termCode?: string;
    mode?: GenerationMode;
    programId?: string;
    completedCount?: number;
    requirementCount?: number;
  };
  schedule_generated: {
    resultCount: number;
    durationMs?: number;
    hasConflicts?: boolean;
    relaxationsApplied?: boolean;
    termCode?: string;
    programId?: string;
    completedCount?: number;
    requirementCount?: number;
  };
  schedule_generate_empty: {
    termCode?: string;
    reason?: string;
    programId?: string;
    completedCount?: number;
    requirementCount?: number;
  };
  schedule_generate_failed: {
    termCode?: string;
    reason?: string;
    programId?: string;
    completedCount?: number;
    requirementCount?: number;
  };

  // --- Schedule interaction ----------------------------------------------
  schedule_viewed: { index?: number; total?: number };
  schedule_swapped_course: { courseCode?: string };
  schedule_pinned: { courseCode?: string; pinned: boolean };
  schedule_exported: { target: ScheduleExportTarget };
  schedule_shared: { method?: string };

  // --- Basket -------------------------------------------------------------
  basket_course_added: { courseCode?: string };
  basket_course_removed: { courseCode?: string };
  basket_opened: Record<string, never>;

  // --- Explore ------------------------------------------------------------
  explore_search: { hasQuery: boolean; resultCount?: number };
  explore_course_viewed: { courseCode?: string };
  explore_program_viewed: { programId?: string };
  explore_filter_applied: { filter: string };

  // --- Trends -------------------------------------------------------------
  trends_viewed: Record<string, never>;
  trends_course_viewed: { courseCode?: string };
  trends_discipline_viewed: { discipline?: string };

  // --- Graph --------------------------------------------------------------
  graph_viewed: Record<string, never>;
  graph_node_selected: { courseCode?: string };

  // --- Imports ------------------------------------------------------------
  transcript_upload_started: Record<string, never>;
  transcript_imported: {
    ok: boolean;
    courseCount?: number;
    programMatched?: boolean;
    termMatched?: boolean;
    minorMatched?: boolean;
  };
  uenroll_imported: { ok: boolean; courseCount?: number };

  // --- Misc ---------------------------------------------------------------
  notification_subscribed: Record<string, never>;
  notification_unsubscribed: Record<string, never>;
  donation_cta_clicked: { location?: string };
  locale_changed: { locale: AnalyticsLocale };
  onboarding_completed: Record<string, never>;
  analytics_opted_out: Record<string, never>;
  analytics_opted_in: Record<string, never>;
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export type AnalyticsEventProps<E extends AnalyticsEventName> = AnalyticsEventMap[E];
