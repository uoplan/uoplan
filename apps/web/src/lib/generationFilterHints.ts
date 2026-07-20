import type { BlockedTime, FilterHintDescriptor } from "@uoplan/store/types";
import { avoidedDaysFromBlocks } from "@uoplan/store/blockedTimes";

const DEFAULT_MIN_START_MINUTES = 8 * 60 + 30;
const DEFAULT_MAX_END_MINUTES = 22 * 60;
const DEFAULT_LANGUAGE_BUCKETS = ["en", "other"];

/** Summarize the non-default generation filters for the "active filters" UI hint. */
export function buildActiveFilterHints(opts: {
  generationMinStartMinutes: number;
  generationMaxEndMinutes: number;
  blockedTimes: readonly BlockedTime[];
  virtualSectionsOnly: boolean;
  includeClosedComponents: boolean;
  languageBuckets: string[];
}): FilterHintDescriptor[] {
  const hints: FilterHintDescriptor[] = [];
  const {
    generationMinStartMinutes,
    generationMaxEndMinutes,
    blockedTimes,
    virtualSectionsOnly,
    includeClosedComponents,
    languageBuckets,
  } = opts;

  if (generationMinStartMinutes > DEFAULT_MIN_START_MINUTES) {
    const h = Math.floor(generationMinStartMinutes / 60);
    const m = generationMinStartMinutes % 60;
    hints.push({ code: "start-after", time: `${h}:${m.toString().padStart(2, "0")}` });
  }

  if (generationMaxEndMinutes < DEFAULT_MAX_END_MINUTES) {
    const h = Math.floor(generationMaxEndMinutes / 60);
    const m = generationMaxEndMinutes % 60;
    hints.push({ code: "end-before", time: `${h}:${m.toString().padStart(2, "0")}` });
  }

  const avoidedDays = avoidedDaysFromBlocks(blockedTimes);
  if (avoidedDays.length > 0) {
    hints.push({ code: "days-excluded", days: avoidedDays });
  }

  if (virtualSectionsOnly) {
    hints.push({ code: "virtual-only" });
  }

  if (!includeClosedComponents) {
    hints.push({ code: "closed-excluded" });
  }

  const isSameAsDefaultLang =
    languageBuckets.length === DEFAULT_LANGUAGE_BUCKETS.length &&
    DEFAULT_LANGUAGE_BUCKETS.every((b) => languageBuckets.includes(b));
  if (!isSameAsDefaultLang) {
    hints.push({ code: "language-filter", langs: languageBuckets });
  }

  return hints;
}
