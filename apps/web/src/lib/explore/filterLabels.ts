import { tr } from "../../i18n";

export type FilterKey =
  | "level"
  | "language"
  | "discipline"
  | "difficulty"
  | "rating"
  | "feedback"
  | "term"
  | "sort";

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
    case "term":
      return tr("explore.filter.term");
    case "sort":
      return tr("explore.sort.label");
  }
}
