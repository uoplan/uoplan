export {
  ANALYTICS_OPT_OUT_STORAGE_KEY,
  DEFAULT_POSTHOG_HOST,
  DEFAULT_POSTHOG_KEY,
  DEFAULT_POSTHOG_UI_HOST,
  resolveAnalyticsConfig,
  shouldEnableCapture,
} from "./config";
export type { AnalyticsConfigOverrides, ResolvedAnalyticsConfig } from "./config";

export type {
  AnalyticsEventMap,
  AnalyticsEventName,
  AnalyticsEventProps,
  AnalyticsLocale,
  CompletedCoursesSource,
  GenerationMode,
  ScheduleExportTarget,
} from "./events";

export { noopAnalytics } from "./types";
export type { AnalyticsClient, PageviewProperties } from "./types";
