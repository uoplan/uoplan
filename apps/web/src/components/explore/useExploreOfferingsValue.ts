import { useCallback, useMemo, useRef } from "react";
import type Fuse from "fuse.js";
import type { Catalogue, ProfessorRatingsMap, ProfessorRegistry } from "@uoplan/core";
import { normalizeCourseCode } from "@uoplan/core";
import { useAllSchedulesData } from "../../hooks/useAllSchedulesData";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import {
  buildAliasGroups,
  buildCourseSearchEntries,
  buildExploreOfferings,
  buildExploreProfessorSearchEntries,
  buildOfferingsByComponent,
  buildOfferingsByCourseNorm,
  buildScheduleOfferings,
  buildTermPresenceIndex,
  createExploreCourseFuse,
  mergeOfferingsWithSchedule,
} from "../../lib/explore/gradesSearch";
import type {
  AliasGroups,
  ExploreCourseSearchEntry,
  ExploreOfferingFlat,
  ExploreProfessorSearchEntry,
  TermPresenceIndex,
} from "../../lib/explore/gradesSearch";

export type ExploreOfferingsValue = {
  offerings: ExploreOfferingFlat[];
  loading: boolean;
  /** Per-course offering groups, keyed by normalized course code. Built eagerly (cheap O(n)). */
  offeringsByCourseNorm: Map<string, ExploreOfferingFlat[]>;
  /** Connected-component alias grouping derived from the catalogue. */
  aliasGroups: AliasGroups;
  /** Offering groups keyed by alias-component id (alias members share one merged list). */
  offeringsByComponent: Map<string, ExploreOfferingFlat[]>;
  /** Lazily built + cached course search entries (one row per course). */
  getCourseEntries: () => ExploreCourseSearchEntry[];
  /** Lazily built + cached lookup of course entries by normalized code. */
  getCourseEntryByNorm: () => Map<string, ExploreCourseSearchEntry>;
  /** Lazily built + cached professor search entries. */
  getProfessorEntries: () => ExploreProfessorSearchEntry[];
  /** Lazily built + cached per-term presence index (courses + professors by term id). */
  getTermPresence: () => TermPresenceIndex;
  /** Lazily built + cached Fuse index over course entries (null when empty). */
  getCourseFuse: () => Fuse<ExploreCourseSearchEntry> | null;
};

function buildTitleByCode(catalogue: Catalogue | null): Map<string, string> {
  const m = new Map<string, string>();
  if (!catalogue) return m;
  for (const c of catalogue.courses) {
    m.set(normalizeCourseCode(c.code), c.title);
    for (const alias of c.aliases ?? []) {
      const key = normalizeCourseCode(alias);
      if (!m.has(key)) m.set(key, c.title);
    }
  }
  return m;
}

type DerivedCache = {
  courseEntries?: ExploreCourseSearchEntry[];
  courseEntryByNorm?: Map<string, ExploreCourseSearchEntry>;
  professorEntries?: ExploreProfessorSearchEntry[];
  termPresence?: TermPresenceIndex;
  courseFuse?: Fuse<ExploreCourseSearchEntry> | null;
};

export function useExploreOfferingsValue(
  catalogue: Catalogue | null,
  professorRatings: ProfessorRatingsMap | null,
  registry: ProfessorRegistry | null,
): ExploreOfferingsValue {
  const { loading, data: grades } = useCourseGradesPb();
  const allSchedules = useAllSchedulesData();

  const titleByCode = useMemo(() => buildTitleByCode(catalogue), [catalogue]);
  const aliasGroups = useMemo(() => buildAliasGroups(catalogue), [catalogue]);

  const offerings = useMemo(() => {
    const gradeOfferings = grades ? buildExploreOfferings(grades, titleByCode, registry) : [];
    if (allSchedules.length === 0) return gradeOfferings;
    const scheduleOfferings = buildScheduleOfferings(allSchedules, titleByCode, registry);
    return mergeOfferingsWithSchedule(gradeOfferings, scheduleOfferings);
  }, [grades, allSchedules, titleByCode, registry]);

  const offeringsByCourseNorm = useMemo(() => buildOfferingsByCourseNorm(offerings), [offerings]);
  const offeringsByComponent = useMemo(
    () => buildOfferingsByComponent(offerings, aliasGroups.componentByNorm),
    [offerings, aliasGroups],
  );

  const cacheRef = useRef<DerivedCache>({});
  const inputsRef = useRef({ offerings, titleByCode, professorRatings, aliasGroups, registry });
  if (
    inputsRef.current.offerings !== offerings ||
    inputsRef.current.titleByCode !== titleByCode ||
    inputsRef.current.professorRatings !== professorRatings ||
    inputsRef.current.aliasGroups !== aliasGroups ||
    inputsRef.current.registry !== registry
  ) {
    inputsRef.current = { offerings, titleByCode, professorRatings, aliasGroups, registry };
    cacheRef.current = {};
  }

  const getCourseEntries = useCallback(() => {
    if (!cacheRef.current.courseEntries) {
      cacheRef.current.courseEntries = buildCourseSearchEntries(
        offerings,
        titleByCode,
        professorRatings,
        aliasGroups.componentByNorm,
        aliasGroups.membersByComponent,
      );
    }
    return cacheRef.current.courseEntries;
  }, [offerings, titleByCode, professorRatings, aliasGroups]);

  const getCourseEntryByNorm = useCallback(() => {
    if (!cacheRef.current.courseEntryByNorm) {
      cacheRef.current.courseEntryByNorm = new Map(getCourseEntries().map((e) => [e.normCode, e]));
    }
    return cacheRef.current.courseEntryByNorm;
  }, [getCourseEntries]);

  const getProfessorEntries = useCallback(() => {
    if (!cacheRef.current.professorEntries) {
      cacheRef.current.professorEntries = buildExploreProfessorSearchEntries(
        offerings,
        professorRatings,
        registry,
      );
    }
    return cacheRef.current.professorEntries;
  }, [offerings, professorRatings, registry]);

  const getTermPresence = useCallback(() => {
    if (!cacheRef.current.termPresence) {
      cacheRef.current.termPresence = buildTermPresenceIndex(
        offerings,
        aliasGroups.componentByNorm,
      );
    }
    return cacheRef.current.termPresence;
  }, [offerings, aliasGroups]);

  const getCourseFuse = useCallback(() => {
    if (cacheRef.current.courseFuse === undefined) {
      const entries = getCourseEntries();
      cacheRef.current.courseFuse = entries.length === 0 ? null : createExploreCourseFuse(entries);
    }
    return cacheRef.current.courseFuse;
  }, [getCourseEntries]);

  return useMemo<ExploreOfferingsValue>(
    () => ({
      offerings,
      loading,
      offeringsByCourseNorm,
      aliasGroups,
      offeringsByComponent,
      getCourseEntries,
      getCourseEntryByNorm,
      getProfessorEntries,
      getTermPresence,
      getCourseFuse,
    }),
    [
      offerings,
      loading,
      offeringsByCourseNorm,
      aliasGroups,
      offeringsByComponent,
      getCourseEntries,
      getCourseEntryByNorm,
      getProfessorEntries,
      getTermPresence,
      getCourseFuse,
    ],
  );
}
