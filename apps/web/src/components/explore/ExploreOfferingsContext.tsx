import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import type Fuse from "fuse.js";
import type { Catalogue, ProfessorRatingsMap, Term } from "@uoplan/core";
import { normalizeCourseCode } from "@uoplan/core";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import { useAllSchedulesData } from "../../hooks/useAllSchedulesData";
import {
  buildCourseSearchEntries,
  buildExploreOfferings,
  buildExploreProfessorSearchEntries,
  buildOfferingsByCourseNorm,
  buildScheduleOfferings,
  createExploreCourseFuse,
  mergeOfferingsWithSchedule,
  type ExploreCourseSearchEntry,
  type ExploreOfferingFlat,
  type ExploreProfessorSearchEntry,
} from "../../lib/explore/gradesSearch";

type ExploreOfferingsCtx = {
  offerings: ExploreOfferingFlat[];
  loading: boolean;
  /** Per-course offering groups, keyed by normalized course code. Built eagerly (cheap O(n)). */
  offeringsByCourseNorm: Map<string, ExploreOfferingFlat[]>;
  /** Lazily built + cached course search entries (one row per course). */
  getCourseEntries: () => ExploreCourseSearchEntry[];
  /** Lazily built + cached lookup of course entries by normalized code. */
  getCourseEntryByNorm: () => Map<string, ExploreCourseSearchEntry>;
  /** Lazily built + cached professor search entries. */
  getProfessorEntries: () => ExploreProfessorSearchEntry[];
  /** Lazily built + cached Fuse index over course entries (null when empty). */
  getCourseFuse: () => Fuse<ExploreCourseSearchEntry> | null;
};

const ExploreOfferingsContext = createContext<ExploreOfferingsCtx>({
  offerings: [],
  loading: true,
  offeringsByCourseNorm: new Map(),
  getCourseEntries: () => [],
  getCourseEntryByNorm: () => new Map(),
  getProfessorEntries: () => [],
  getCourseFuse: () => null,
});

function buildTitleByCode(catalogue: Catalogue | null): Map<string, string> {
  const m = new Map<string, string>();
  if (!catalogue) return m;
  for (const c of catalogue.courses) m.set(normalizeCourseCode(c.code), c.title);
  return m;
}

function buildTermNameById(terms: Term[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const t of terms) {
    const id = Number.parseInt(t.termId, 10);
    if (Number.isFinite(id)) m.set(id, t.name);
  }
  return m;
}

type DerivedCache = {
  courseEntries?: ExploreCourseSearchEntry[];
  courseEntryByNorm?: Map<string, ExploreCourseSearchEntry>;
  professorEntries?: ExploreProfessorSearchEntry[];
  courseFuse?: Fuse<ExploreCourseSearchEntry> | null;
};

export function ExploreOfferingsProvider({
  catalogue,
  terms,
  professorRatings,
  children,
}: {
  catalogue: Catalogue | null;
  terms: Term[];
  professorRatings: ProfessorRatingsMap | null;
  children: ReactNode;
}) {
  const { loading, data: grades } = useCourseGradesPb();
  const allSchedules = useAllSchedulesData();

  const titleByCode = useMemo(() => buildTitleByCode(catalogue), [catalogue]);
  const termNameById = useMemo(() => buildTermNameById(terms), [terms]);

  const offerings = useMemo(() => {
    const gradeOfferings = grades ? buildExploreOfferings(grades, titleByCode, termNameById) : [];
    if (allSchedules.length === 0) return gradeOfferings;
    const scheduleOfferings = buildScheduleOfferings(allSchedules, termNameById, titleByCode);
    return mergeOfferingsWithSchedule(gradeOfferings, scheduleOfferings);
  }, [grades, allSchedules, titleByCode, termNameById]);

  const offeringsByCourseNorm = useMemo(() => buildOfferingsByCourseNorm(offerings), [offerings]);

  // Lazily build + cache the corpus-wide derived indices on first use. Reset the
  // cache (in render) whenever an input it depends on changes, so consumers never
  // read stale data without paying the build cost up front.
  const cacheRef = useRef<DerivedCache>({});
  const inputsRef = useRef({ offerings, titleByCode, professorRatings });
  if (
    inputsRef.current.offerings !== offerings ||
    inputsRef.current.titleByCode !== titleByCode ||
    inputsRef.current.professorRatings !== professorRatings
  ) {
    inputsRef.current = { offerings, titleByCode, professorRatings };
    cacheRef.current = {};
  }

  const getCourseEntries = useCallback(() => {
    if (!cacheRef.current.courseEntries) {
      cacheRef.current.courseEntries = buildCourseSearchEntries(
        offerings,
        titleByCode,
        professorRatings,
      );
    }
    return cacheRef.current.courseEntries;
  }, [offerings, titleByCode, professorRatings]);

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
      );
    }
    return cacheRef.current.professorEntries;
  }, [offerings, professorRatings]);

  const getCourseFuse = useCallback(() => {
    if (cacheRef.current.courseFuse === undefined) {
      const entries = getCourseEntries();
      cacheRef.current.courseFuse = entries.length === 0 ? null : createExploreCourseFuse(entries);
    }
    return cacheRef.current.courseFuse;
  }, [getCourseEntries]);

  const value = useMemo<ExploreOfferingsCtx>(
    () => ({
      offerings,
      loading,
      offeringsByCourseNorm,
      getCourseEntries,
      getCourseEntryByNorm,
      getProfessorEntries,
      getCourseFuse,
    }),
    [
      offerings,
      loading,
      offeringsByCourseNorm,
      getCourseEntries,
      getCourseEntryByNorm,
      getProfessorEntries,
      getCourseFuse,
    ],
  );

  return (
    <ExploreOfferingsContext.Provider value={value}>{children}</ExploreOfferingsContext.Provider>
  );
}

export function useExploreOfferings(): ExploreOfferingsCtx {
  return useContext(ExploreOfferingsContext);
}
