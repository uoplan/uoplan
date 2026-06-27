import type {
  CanonicalProfessorName,
  ProfessorRegistry,
  UnpredictedInstructor,
  UnpredictedReason,
} from "@uoplan/core";
import { professorAt, professorByLegacyId, professorIndexFromRef, unsafeBrand } from "@uoplan/core";
import { DAY_LABELS } from "@uoplan/calendar";
import { tr } from "../../i18n";
import { EMPTY_EXPLORE_SEARCH } from "./exploreFilters";
import { professorRouteParam } from "./professorRoute";
import { formatTimeRange } from "../../components/calendar/calendarEventDisplayUtils";

export { EMPTY_EXPLORE_SEARCH };

/** Human sentence for why one historical instructor isn't the prediction. */
function reasonText(reason: UnpredictedReason): string {
  switch (reason.kind) {
    case "conflict":
      return tr("explore.schedule.whyNot.conflict", {
        course: reason.courseCode,
        section: reason.section,
        time: `${DAY_LABELS[reason.day]} ${formatTimeRange(reason.startMinutes, reason.endMinutes)}`,
      });
    case "stale":
      return tr("explore.schedule.whyNot.stale", { year: String(reason.lastYear) });
    case "inactive":
      return tr("explore.schedule.whyNot.inactive");
    case "lowerPriority":
      return tr("explore.schedule.whyNot.lowerPriority");
  }
}

/** Order reason groups are shown in: hard blockers first, soft reasons last. */
export const REASON_ORDER: UnpredictedReason["kind"][] = [
  "conflict",
  "inactive",
  "stale",
  "lowerPriority",
];

/** Short heading shared by every instructor dropped for the same kind of reason. */
export function reasonGroupLabel(kind: UnpredictedReason["kind"]): string {
  switch (kind) {
    case "conflict":
      return tr("explore.schedule.whyNot.conflictGroup");
    case "stale":
      return tr("explore.schedule.whyNot.staleGroup");
    case "inactive":
      return tr("explore.schedule.whyNot.inactive");
    case "lowerPriority":
      return tr("explore.schedule.whyNot.lowerPriority");
  }
}

/**
 * Per-instructor detail surfaced on hover (the specific class/time or year),
 * shown only when the group heading doesn't already say everything.
 */
export function reasonDetailTitle(reason: UnpredictedReason): string | undefined {
  return reason.kind === "conflict" || reason.kind === "stale" ? reasonText(reason) : undefined;
}

/** Short inline qualifier shown after the name (the clashing class or last year). */
export function reasonInlineDetail(reason: UnpredictedReason): string | undefined {
  switch (reason.kind) {
    case "conflict":
      return reason.courseCode;
    case "stale":
      return String(reason.lastYear);
    default:
      return undefined;
  }
}

/** Resolve the best `/explore/professor/$slug` path segment for an excluded prof. */
export function professorLinkParam(
  registry: ProfessorRegistry | null,
  prof: UnpredictedInstructor,
): string {
  let entry = null;
  if (registry) {
    if (prof.professorRef != null) {
      entry = professorAt(registry, professorIndexFromRef(prof.professorRef));
    }
    if (!entry && prof.legacyId != null) {
      entry = professorByLegacyId(registry, prof.legacyId)?.entry ?? null;
    }
  }
  return professorRouteParam({
    slug: entry?.slug,
    displayName: entry?.name ?? unsafeBrand<CanonicalProfessorName>(prof.name),
  });
}

/** Stable React key for an excluded-instructor list row. */
export function unpredictedKey(prof: UnpredictedInstructor): string {
  return `${prof.name}-${prof.legacyId ?? prof.professorRef ?? "x"}`;
}
