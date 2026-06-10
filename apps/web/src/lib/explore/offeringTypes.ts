/**
 * Shared offering identity primitives used by both the Explore search-index
 * builders (`gradesSearch.ts`) and the offering-grouping/merge logic
 * (`offeringGroups.ts`): the flat offering row type plus the helpers that decide
 * "is this an unassigned instructor?" and resolve a professor to his canonical
 * registry identity. Extracted so the two larger modules share one definition
 * without an import cycle.
 */
import type { PredictedInstructor, ProfessorRegistry } from "@uoplan/core";
import {
  normalizeProfessorName,
  normalizeInstructorName,
  professorIndexByName,
} from "@uoplan/core";

export type ExploreOfferingFlat = {
  id: string;
  courseCode: string;
  courseTitle: string;
  professorName: string;
  legacyId?: number;
  /** 0-based canonical professor registry index; the primary identity key when present. */
  professorRef?: number;
  termId: number;
  termLabel: string;
  section?: string;
  fuseText: string;
  distribution: Record<string, number>;
  /** True when the section has no real instructor (e.g. the "Staff" placeholder). */
  unassignedInstructor?: boolean;
  /**
   * Build-time guess of who might teach this (unassigned) section, deduped across
   * the sections that share the exact same combination. Informational only — never
   * fed into grade lookups, professor-rating filters, or schedule generation.
   */
  predictedInstructors?: PredictedInstructor[];
  /**
   * True for a predicted copy of an unassigned offering placed under a candidate
   * professor's group (see `groupOfferingsByProfessor`). Marks the row as a
   * build-time guess rather than a confirmed teaching assignment.
   */
  predicted?: boolean;
};

/**
 * Display name used for offerings without a real instructor. Kept empty so these
 * rows never surface "Staff" in search text, links, or professor indices.
 */
export const UNASSIGNED_INSTRUCTOR = "";

/** Stable group id collecting every unassigned-instructor offering of a course. */
export const UNASSIGNED_GROUP_ID = "unassigned";

/**
 * "Staff" is uOttawa's placeholder for an unassigned instructor. Treat it (and an
 * already-empty name) as "no professor" rather than a real person.
 */
export function isUnassignedInstructorName(name: string): boolean {
  const norm = normalizeProfessorName(name).toLowerCase();
  return norm === "" || norm === "staff";
}

/** Whether an offering has no real instructor (collapsed into the unassigned group). */
export function isUnassignedOffering(o: ExploreOfferingFlat): boolean {
  return o.unassignedInstructor === true || isUnassignedInstructorName(o.professorName);
}

/**
 * Stable group id for a professor: the canonical registry index when resolved
 * (so every data source collapses into one group), else a RateMyProfessors
 * legacyId, else the normalized name.
 */
export function professorGroupId(
  professorRef: number | undefined,
  legacyId: number | undefined,
  name: string,
): string {
  if (professorRef != null) return `ref:${professorRef}`;
  return legacyId != null ? `id:${legacyId}` : `name:${normalizeProfessorName(name).toLowerCase()}`;
}

/**
 * Resolve a professor to his canonical registry identity. Prefers an explicit
 * 0-based registry index, then a RateMyProfessors legacyId, then a first+last
 * name-key lookup. Returns the canonical display name when resolved so every
 * data source shows one name per person; falls back to the raw name otherwise.
 */
export function resolveCanonicalProfessor(
  registry: ProfessorRegistry | null | undefined,
  index: number | null | undefined,
  legacyId: number | undefined,
  name: string,
): { professorRef?: number; professorName: string } {
  if (!registry) return { professorName: name };
  let idx: number | null = index ?? null;
  if (idx == null && legacyId != null) idx = registry.byLegacyId.get(legacyId) ?? null;
  if (idx == null) idx = professorIndexByName(registry, name);
  if (idx == null) return { professorName: name };
  const entry = registry.entries[idx];
  return { professorRef: idx, professorName: entry?.name ?? name };
}

/**
 * Stable signature of a predicted-instructor combination, identifying it by
 * legacyId (or normalized name when absent), order-independent. Empty string for
 * "no guess". Unassigned offerings sharing this key are grouped together.
 */
export function predictedComboKey(guess: readonly PredictedInstructor[] | undefined): string {
  if (!guess || guess.length === 0) return "";
  return guess
    .map((p) =>
      p.legacyId != null ? `id:${p.legacyId}` : `name:${normalizeInstructorName(p.name)}`,
    )
    .sort()
    .join("|");
}
