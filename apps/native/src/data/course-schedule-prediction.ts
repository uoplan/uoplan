import { DAY_LABELS } from "@uoplan/calendar/layout";
import {
  explainUnpredictedInstructors,
  type UnpredictedInstructor,
  type UnpredictedReason,
} from "@uoplan/core";
import {
  professorByLegacyId,
  professorIndexFromRef,
  type ProfessorRegistry,
} from "@uoplan/core/professorRegistry";
import { slugifyProfessor } from "@uoplan/core/professorIdentity";

export { explainUnpredictedInstructors };
export type { UnpredictedInstructor, UnpredictedReason };

function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function unpredictedReasonLabel(reason: UnpredictedReason): string {
  switch (reason.kind) {
    case "conflict":
      return `Teaching ${reason.courseCode} ${reason.section} (${DAY_LABELS[reason.day]} ${formatMinutes(
        reason.startMinutes,
      )}–${formatMinutes(reason.endMinutes)})`;
    case "stale":
      return `Hasn't taught it since ${reason.lastYear}`;
    case "inactive":
      return "Not teaching this term";
    case "lowerPriority":
      return "A more recent instructor was predicted";
  }
}

export function professorSlugForUnpredicted(
  registry: ProfessorRegistry,
  instructor: UnpredictedInstructor,
): string {
  if (instructor.legacyId != null) {
    const byLegacyId = professorByLegacyId(registry, instructor.legacyId);
    if (byLegacyId?.entry.slug) return byLegacyId.entry.slug;
  }

  const refIndex = professorIndexFromRef(instructor.professorRef);
  const byRef = refIndex == null ? undefined : registry.entries[refIndex];
  return byRef?.slug ?? slugifyProfessor(instructor.name);
}
