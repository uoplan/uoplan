import type { ComponentSection, PredictedInstructor } from "./dataTypes/domain";
import { normalizeInstructorName } from "./gradeLookup";

/**
 * uOttawa placeholders for an unassigned instructor. A section whose every
 * meeting time matches one of these (or is blank) has no real instructor and is
 * eligible for a build-time prediction.
 */
const UNKNOWN_INSTRUCTOR_NAMES = new Set(["", "staff", "tba", "to be announced", "tbd"]);

/** Whether an instructor name is a placeholder for "no assigned instructor". */
export function isUnknownInstructorName(name: string | null | undefined): boolean {
  if (typeof name !== "string") return true;
  return UNKNOWN_INSTRUCTOR_NAMES.has(normalizeInstructorName(name));
}

/** Distinct, real instructor names assigned to a section (placeholders dropped). */
export function knownSectionInstructors(section: ComponentSection): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const time of section.times) {
    const raw = time.instructor;
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || isUnknownInstructorName(trimmed)) continue;
    const norm = normalizeInstructorName(trimmed);
    if (seen.has(norm)) continue;
    seen.add(norm);
    names.push(trimmed);
  }
  return names;
}

export type SectionInstructorInfo =
  | { kind: "known"; names: string[] }
  | { kind: "unknown"; guess: PredictedInstructor[] };

/**
 * Resolve a section's instructor status: `known` with the real instructor names
 * when at least one is assigned, otherwise `unknown` with the build-time guess
 * (possibly empty). The guess is informational only and is never fed into
 * grade lookups, professor-rating filters, or the generation engine.
 */
export function sectionInstructors(section: ComponentSection): SectionInstructorInfo {
  const names = knownSectionInstructors(section);
  if (names.length > 0) return { kind: "known", names };
  return { kind: "unknown", guess: section.predictedInstructors ?? [] };
}
