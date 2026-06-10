/**
 * Offering grouping, schedule-offering construction, and grade+schedule merge.
 * Split out of `gradesSearch.ts` (which owns the search indices) so the
 * grouping/aggregation concern lives on its own. Shares offering identity
 * primitives with the search module via `offeringTypes.ts`.
 */
import type { PredictedInstructor, ProfessorRegistry, SchedulesData } from "@uoplan/core";
import {
  normalizeCourseCode,
  normalizeProfessorName,
  normalizeInstructorName,
  sectionInstructors,
} from "@uoplan/core";
import { formatTermLabelPlain } from "../term/termLabelPlain";
import {
  type ExploreOfferingFlat,
  UNASSIGNED_GROUP_ID,
  UNASSIGNED_INSTRUCTOR,
  isUnassignedOffering,
  predictedComboKey,
  professorGroupId,
  resolveCanonicalProfessor,
} from "./offeringTypes";

export type ProfessorOfferingGroup = {
  groupId: string;
  legacyId?: number;
  /** 0-based canonical registry index of this group's professor, when resolved. */
  professorRef?: number;
  /** Canonical URL slug for this group's professor, when resolved from the registry. */
  slug?: string;
  displayName: string;
  offerings: ExploreOfferingFlat[];
  /** True for a synthetic group collecting sections with no real instructor. */
  unassigned?: boolean;
  /**
   * For the unassigned group, the build-time guesses (when any). Predicted
   * offerings are normally fanned out under each candidate professor instead;
   * this stays populated only for the residual no-instructor rows.
   */
  predictedInstructors?: PredictedInstructor[];
  /** True when this group contains at least one predicted (guessed) offering. */
  hasPredicted?: boolean;
};

/**
 * Stable group id for a professor: see `professorGroupId` in `./offeringTypes`.
 */
export function groupOfferingsByProfessor(
  items: ExploreOfferingFlat[],
  registry?: ProfessorRegistry | null,
): ProfessorOfferingGroup[] {
  const byGroup = new Map<string, ExploreOfferingFlat[]>();
  const meta = new Map<
    string,
    {
      legacyId?: number;
      professorRef?: number;
      displayName: string;
      unassigned: boolean;
      predictedInstructors?: PredictedInstructor[];
      hasPredicted?: boolean;
    }
  >();
  // (groupId|course|term) keys already covered by a confirmed offering, so a
  // predicted copy for the same professor/term is suppressed as redundant.
  const confirmedKeys = new Set<string>();
  // Reconcile predicted profs (keyed by legacyId) with confirmed schedule rows
  // (which may be keyed by name when no legacyId was backfilled): map a normalized
  // professor name to its existing confirmed group id and course/term coverage.
  const confirmedGroupByName = new Map<string, string>();
  const confirmedNameCourseTerm = new Set<string>();
  const profName = (name: string) => normalizeProfessorName(name).toLowerCase();
  const nameCourseTermKey = (name: string, o: ExploreOfferingFlat) =>
    `${profName(name)}|${normalizeCourseCode(o.courseCode)}|${o.termId}`;
  const slot = (groupId: string) => {
    let list = byGroup.get(groupId);
    if (!list) {
      list = [];
      byGroup.set(groupId, list);
    }
    return list;
  };
  const offeringTermKey = (groupId: string, o: ExploreOfferingFlat) =>
    `${groupId}|${normalizeCourseCode(o.courseCode)}|${o.termId}`;

  // First pass: real (confirmed) offerings define professor groups.
  for (const o of items) {
    if (isUnassignedOffering(o)) continue;
    const groupId = professorGroupId(o.professorRef, o.legacyId, o.professorName);
    slot(groupId).push(o);
    confirmedKeys.add(offeringTermKey(groupId, o));
    const name = profName(o.professorName);
    if (name) {
      if (!confirmedGroupByName.has(name)) confirmedGroupByName.set(name, groupId);
      confirmedNameCourseTerm.add(nameCourseTermKey(o.professorName, o));
    }
    if (!meta.has(groupId)) {
      meta.set(groupId, {
        legacyId: o.legacyId,
        professorRef: o.professorRef,
        displayName: o.professorName,
        unassigned: false,
      });
    }
  }

  // Second pass: each unassigned offering is fanned out as a predicted copy under
  // every candidate professor's group (so it appears in their dropdown). Rows with
  // no guess remain in the single shared "no instructor assigned" group.
  for (const o of items) {
    if (!isUnassignedOffering(o)) continue;
    const guesses = o.predictedInstructors ?? [];
    if (guesses.length === 0) {
      const groupId = `${UNASSIGNED_GROUP_ID}:`;
      slot(groupId).push(o);
      if (!meta.has(groupId)) {
        meta.set(groupId, {
          displayName: UNASSIGNED_INSTRUCTOR,
          unassigned: true,
          predictedInstructors: undefined,
        });
      }
      continue;
    }
    for (const guess of guesses) {
      const guessLegacyId = guess.legacyId ?? undefined;
      // Resolve the guess to its canonical registry identity so a predicted copy
      // lands in the same group as the professor's confirmed/registry-keyed rows.
      const canonical = resolveCanonicalProfessor(registry, null, guessLegacyId, guess.name);
      const guessRef = canonical.professorRef;
      const guessName = canonical.professorName;
      // The professor may already have a confirmed group keyed by name (no
      // backfilled legacyId / registry ref); reuse it so we never split one person.
      const groupId =
        (guessRef != null ? `ref:${guessRef}` : undefined) ??
        confirmedGroupByName.get(profName(guessName)) ??
        professorGroupId(guessRef, guessLegacyId, guessName);
      const termKey = offeringTermKey(groupId, o);
      // Don't shadow a confirmed teaching (matched by group id or by name), and
      // don't duplicate a guess already placed under this professor for the term.
      if (confirmedKeys.has(termKey)) continue;
      if (confirmedNameCourseTerm.has(nameCourseTermKey(guessName, o))) continue;
      const list = slot(groupId);
      if (list.some((e) => e.predicted && offeringTermKey(groupId, e) === termKey)) continue;
      list.push({
        ...o,
        id: `${o.id}|pred:${groupId}`,
        predicted: true,
        unassignedInstructor: false,
        professorName: guessName,
        legacyId: guessLegacyId,
        ...(guessRef != null ? { professorRef: guessRef } : {}),
      });
      const m = meta.get(groupId);
      if (m) {
        m.hasPredicted = true;
      } else {
        meta.set(groupId, {
          legacyId: guessLegacyId,
          professorRef: guessRef,
          displayName: guessName,
          unassigned: false,
          hasPredicted: true,
        });
      }
    }
  }

  const groups: ProfessorOfferingGroup[] = [];
  for (const [groupId, offerings] of byGroup) {
    const m = meta.get(groupId);
    if (!m) continue;
    offerings.sort((a, b) => {
      const c = a.courseCode.localeCompare(b.courseCode, "en");
      if (c !== 0) return c;
      if (b.termId !== a.termId) return b.termId - a.termId;
      return String(a.section ?? "").localeCompare(String(b.section ?? ""), "en");
    });
    groups.push({
      groupId,
      legacyId: m.legacyId,
      professorRef: m.professorRef,
      ...(m.professorRef != null && registry?.entries[m.professorRef]?.slug
        ? { slug: registry.entries[m.professorRef]!.slug }
        : {}),
      displayName: m.displayName,
      offerings,
      unassigned: m.unassigned,
      predictedInstructors: m.predictedInstructors,
      hasPredicted: m.hasPredicted,
    });
  }

  // Real professors sorted by name; the unassigned group always sorts last.
  groups.sort((a, b) => {
    if (a.unassigned !== b.unassigned) return a.unassigned ? 1 : -1;
    return a.displayName.localeCompare(b.displayName, "en");
  });
  return groups;
}

export type CourseOfferingGroup = {
  groupId: string;
  courseCode: string;
  courseTitles: string[];
  offerings: ExploreOfferingFlat[];
};

function scheduleOfferingId(courseCode: string, name: string, termId: number, combo = "") {
  return [courseCode, "", normalizeProfessorName(name).toLowerCase(), String(termId), combo].join(
    "|",
  );
}

/**
 * Dedup key for schedule-derived offerings, which carry no grade data and are
 * combined per professor per term (section is intentionally ignored). For
 * unassigned rows the predicted-instructor combo keeps distinct guesses apart.
 */
function scheduleOfferingDedupKey(courseCode: string, name: string, termId: number, combo = "") {
  return [
    normalizeCourseCode(courseCode),
    normalizeProfessorName(name).toLowerCase(),
    String(termId),
    combo,
  ].join("|");
}

export function buildScheduleOfferings(
  allSchedules: SchedulesData[],
  titleByCode: Map<string, string>,
  registry?: ProfessorRegistry | null,
): ExploreOfferingFlat[] {
  const seen = new Set<string>();
  const out: ExploreOfferingFlat[] = [];

  for (const schedData of allSchedules) {
    const termId = Number.parseInt(schedData.termId, 10);
    if (!Number.isFinite(termId)) continue;
    const termLabel = formatTermLabelPlain(termId);

    for (const sched of schedData.schedules) {
      const norm = normalizeCourseCode(sched.courseCode);
      const title = titleByCode.get(norm) ?? sched.title ?? "";

      // Collapse this course+term's sections to one row per real instructor, plus
      // up to two unassigned rows: one carrying the union of every predicted
      // instructor (fanned out under each candidate professor's group later), and
      // a separate "no guess" row when some unassigned sections have no prediction
      // at all (so those genuinely-unstaffed sections still surface). Raw section
      // labels (e.g. "M00-LEC FullSess.") are not meaningful here, so section is
      // dropped.
      const realInstructors = new Set<string>();
      const predictedByKey = new Map<string, PredictedInstructor>();
      let hasNoGuessSection = false;
      for (const sections of Object.values(sched.components)) {
        for (const section of sections) {
          const info = sectionInstructors(section);
          if (info.kind === "known") {
            for (const name of info.names) realInstructors.add(name);
          } else if (info.guess.length === 0) {
            hasNoGuessSection = true;
          } else {
            for (const guess of info.guess) {
              const key =
                guess.legacyId != null
                  ? `id:${guess.legacyId}`
                  : `name:${normalizeInstructorName(guess.name)}`;
              if (!predictedByKey.has(key)) predictedByKey.set(key, guess);
            }
          }
        }
      }

      const pushOffering = (
        rawName: string,
        unassigned: boolean,
        combo: string,
        predictedInstructors: PredictedInstructor[] | undefined,
      ) => {
        // Resolve real instructors to their canonical registry identity so two
        // spelling variants of one person collapse into a single offering/group.
        const canonical = unassigned
          ? { professorName: rawName }
          : resolveCanonicalProfessor(registry, null, undefined, rawName);
        const professorName = canonical.professorName;
        const professorRef = canonical.professorRef;
        const key = scheduleOfferingDedupKey(sched.courseCode, professorName, termId, combo);
        if (seen.has(key)) return;
        seen.add(key);
        const fuseText = [sched.courseCode, norm, title, professorName, termLabel]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        out.push({
          id: scheduleOfferingId(sched.courseCode, professorName, termId, combo),
          courseCode: sched.courseCode,
          courseTitle: title,
          professorName,
          ...(professorRef != null ? { professorRef } : {}),
          termId,
          termLabel,
          fuseText,
          distribution: {},
          unassignedInstructor: unassigned,
          predictedInstructors,
        });
      };

      for (const instructor of realInstructors) {
        pushOffering(instructor, false, "", undefined);
      }
      if (predictedByKey.size > 0) {
        const guesses = [...predictedByKey.values()];
        pushOffering(UNASSIGNED_INSTRUCTOR, true, predictedComboKey(guesses), guesses);
      }
      if (hasNoGuessSection) {
        pushOffering(UNASSIGNED_INSTRUCTOR, true, "", undefined);
      }
    }
  }

  return out;
}

/**
 * Maps each professor's normalized name to its grade-data legacyId, but only
 * when that name resolves to exactly one legacyId. Names shared by distinct
 * professors (multiple legacyIds) are omitted so we never mis-merge two people.
 */
function buildUnambiguousLegacyIdByName(
  gradeOfferings: ExploreOfferingFlat[],
): Map<string, number> {
  const idsByName = new Map<string, Set<number>>();
  for (const o of gradeOfferings) {
    if (o.legacyId == null) continue;
    const name = normalizeProfessorName(o.professorName).toLowerCase();
    if (!name) continue;
    let ids = idsByName.get(name);
    if (!ids) {
      ids = new Set();
      idsByName.set(name, ids);
    }
    ids.add(o.legacyId);
  }
  const out = new Map<string, number>();
  for (const [name, ids] of idsByName) {
    if (ids.size === 1) out.set(name, [...ids][0]);
  }
  return out;
}

export function mergeOfferingsWithSchedule(
  gradeOfferings: ExploreOfferingFlat[],
  scheduleOfferings: ExploreOfferingFlat[],
): ExploreOfferingFlat[] {
  // Identity for dedup prefers the canonical registry index so two name variants
  // of one person never produce duplicate grade+schedule rows; falls back to the
  // normalized name when a professor is not in the registry.
  const identityToken = (o: ExploreOfferingFlat) =>
    o.professorRef != null
      ? `ref:${o.professorRef}`
      : `name:${normalizeProfessorName(o.professorName).toLowerCase()}`;
  const mergeKey = (o: ExploreOfferingFlat) =>
    `${normalizeCourseCode(o.courseCode)}|${identityToken(o)}|${o.termId}`;
  // Schedule offerings have no section, while grade offerings do, so dedup by
  // (course, prof, term) ignoring section: a prof/term already present in grade
  // data should not be duplicated by a section-less schedule row.
  const gradeKeys = new Set<string>();
  for (const o of gradeOfferings) {
    gradeKeys.add(mergeKey(o));
  }
  // Backfill legacyId onto schedule rows so a professor who has grade data is not
  // split into a separate name-keyed entry by their schedule-only offerings.
  const legacyIdByName = buildUnambiguousLegacyIdByName(gradeOfferings);
  const newEntries = scheduleOfferings
    .filter((o) => !gradeKeys.has(mergeKey(o)))
    .map((o) => {
      if (o.legacyId != null) return o;
      const legacyId = legacyIdByName.get(normalizeProfessorName(o.professorName).toLowerCase());
      return legacyId == null ? o : { ...o, legacyId };
    });
  return [...gradeOfferings, ...newEntries];
}

export function groupOfferingsByCourse(items: ExploreOfferingFlat[]): CourseOfferingGroup[] {
  const byGroup = new Map<string, ExploreOfferingFlat[]>();
  const titles = new Map<string, Set<string>>();

  for (const o of items) {
    const normCode = normalizeCourseCode(o.courseCode);

    // Add to group
    let list = byGroup.get(normCode);
    if (!list) {
      list = [];
      byGroup.set(normCode, list);
    }
    list.push(o);

    // Track unique titles
    let titleSet = titles.get(normCode);
    if (!titleSet) {
      titleSet = new Set();
      titles.set(normCode, titleSet);
    }
    if (o.courseTitle.trim()) {
      titleSet.add(o.courseTitle.trim());
    }
  }

  const groups: CourseOfferingGroup[] = [];
  for (const [normCode, offerings] of byGroup) {
    // Sort offerings: most recent term first, then by section
    offerings.sort((a, b) => {
      if (b.termId !== a.termId) return b.termId - a.termId;
      return String(a.section ?? "").localeCompare(String(b.section ?? ""), "en");
    });

    const courseTitles = Array.from(titles.get(normCode) ?? []);

    groups.push({
      groupId: normCode,
      courseCode: offerings[0].courseCode,
      courseTitles,
      offerings,
    });
  }

  // Sort groups alphabetically by course code
  groups.sort((a, b) => a.courseCode.localeCompare(b.courseCode, "en"));
  return groups;
}
