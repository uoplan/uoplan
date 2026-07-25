import type { SchoolFeatures } from "@uoplan/domain/school";
import { tr } from "../../i18n";

export const EXPLORE_FILTER_KEYS = [
  "level",
  "language",
  "discipline",
  "difficulty",
  "rating",
  "feedback",
  "delivery",
  "term",
  "sort",
] as const;

export type FilterKey = (typeof EXPLORE_FILTER_KEYS)[number];

/**
 * The school capability a filter depends on, for filters that are only
 * meaningful when that data exists. Keys absent from this map are universal.
 *
 * Without this, a school with no grade or feedback data renders pills that can
 * only ever narrow the results to nothing.
 */
const FILTER_REQUIRED_FEATURE: Partial<Record<FilterKey, keyof SchoolFeatures>> = {
  difficulty: "grades",
  feedback: "feedback",
  language: "bilingualCatalogue",
};

/** The filter pills that are usable for a school, in display order. */
export function exploreFilterKeysFor(features: SchoolFeatures): readonly FilterKey[] {
  return EXPLORE_FILTER_KEYS.filter((key) => {
    const required = FILTER_REQUIRED_FEATURE[key];
    return required === undefined || features[required];
  });
}

export function filterSectionLabel(key: FilterKey): string {
  switch (key) {
    case "level":
      return tr("explore.filter.level");
    case "language":
      return tr("explore.filter.language");
    case "discipline":
      return tr("explore.filter.discipline");
    case "difficulty":
      return tr("explore.filter.difficulty");
    case "rating":
      return tr("explore.filter.rating");
    case "feedback":
      return tr("explore.filter.feedback");
    case "delivery":
      return tr("explore.filter.delivery");
    case "term":
      return tr("explore.filter.term");
    case "sort":
      return tr("explore.sort.label");
  }
}
