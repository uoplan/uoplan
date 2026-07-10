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
