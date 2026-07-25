import type {
  Catalogue as ProtoCatalogue,
  CataloguePrereqHistory as ProtoCataloguePrereqHistory,
  PrereqRevision as ProtoPrereqRevision,
} from "@uoplan/proto/data";
import { fromProtoCatalogue } from "./schedules";
import type { Catalogue } from "./domain";
import type { SchoolId } from "../school";

/**
 * Reconstructs the catalogue as it was for a specific cohort `year` from the
 * union catalogue (latest metadata for every course) plus the compact
 * prerequisite-history overlay. Only prerequisites vary per cohort; every other
 * field (title/credits/component/aliases/programs) uses the union's latest
 * value. Years the overlay does not track (including the newest, whose
 * prerequisites are the union baseline) return the union unchanged.
 *
 * `union.courses[i].code` and `overlay.code` are both 0-based indices into
 * `union.courseCodes`, so revisions are matched by index without re-normalizing.
 */
export function reconstructCatalogueForYear(
  union: ProtoCatalogue,
  history: ProtoCataloguePrereqHistory | null | undefined,
  year: number,
  school?: SchoolId,
): Catalogue {
  const bit = history ? history.years.indexOf(year) : -1;
  if (!history || bit < 0) return fromProtoCatalogue(union, school);

  const mask = 1 << bit;
  const revisionByCodeIndex = new Map<number, ProtoPrereqRevision>();
  for (const overlay of history.overlays) {
    const revision = overlay.revisions.find((r) => (r.yearMask & mask) !== 0);
    if (revision) revisionByCodeIndex.set(overlay.code, revision);
  }
  if (revisionByCodeIndex.size === 0) return fromProtoCatalogue(union, school);

  const courses = union.courses.map((course) => {
    const revision = revisionByCodeIndex.get(course.code);
    if (!revision) return course;
    return {
      ...course,
      prerequisites: revision.prerequisites,
      hasPrereqText: revision.hasPrereqText,
    };
  });
  return fromProtoCatalogue({ ...union, courses }, school);
}
