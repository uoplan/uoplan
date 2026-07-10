import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { gradeVizGpa, normalizeCourseCode } from "@uoplan/core";
import type { GradeVizData, NormalizedCourseCode } from "@uoplan/core";
import type { ExploreFilterLevel } from "../../../lib/explore/exploreFilters";
import { facultyForDisciplineCode, localizeFacultyName } from "../../../lib/explore/faculty";
import { useScheduleSentiment } from "../../../hooks/useScheduleSentiment";
import { useDataCache, useDisciplines, useFaculties, useTerms } from "@uoplan/store/hooks";
import { useExploreOfferings } from "../exploreOfferingsContext";

/** One course's fully-resolved comparison attributes. */
export interface CourseCompareDatum {
  code: string;
  norm: NormalizedCourseCode;
  title: string;
  found: boolean;
  credits: number | null;
  facultyName: string | null;
  level: ExploreFilterLevel | null;
  language: "en" | "fr" | null;
  prereqText: string | null;
  termIds: number[];
  gradeViz: GradeVizData | null;
  avgGpa: number | null;
  passingPercent: number | null;
  maxProfessorRating: number | null;
  sentiment: number | null;
}

/**
 * Resolves the side-by-side comparison attributes for a list of course codes,
 * reusing the explore offerings index (grade viz / level / language / max
 * professor rating), the data cache (credits / prereqs), the faculty registry,
 * the term presence map, and the lazily-loaded course sentiment map. Order of
 * `codes` is preserved; unknown codes yield a `found: false` datum.
 */
export function useCourseCompareData(codes: string[]): {
  data: CourseCompareDatum[];
  loading: boolean;
} {
  const { i18n } = useLingui();
  const { loading, getCourseEntryByNorm, getTermPresence, aliasGroups } = useExploreOfferings();
  const dataCache = useDataCache();
  const disciplines = useDisciplines();
  const faculties = useFaculties();
  const terms = useTerms();
  const { courseByNorm } = useScheduleSentiment();

  return useMemo(() => {
    const entryByNorm = getCourseEntryByNorm();
    const presence = getTermPresence();
    const termIdsSorted = (terms ?? [])
      .map((t) => Number(t.termId))
      .filter((id) => Number.isFinite(id))
      .sort((a, b) => b - a);

    const data = codes.map<CourseCompareDatum>((code) => {
      const norm = normalizeCourseCode(code);
      const entry = entryByNorm.get(norm);
      const componentId = aliasGroups.componentByNorm.get(norm) ?? norm;
      const catalogueCourse = dataCache?.getCourse(code) ?? dataCache?.getCourse(norm);
      const subject = (entry?.courseCode ?? code).split(/\s+/)[0] ?? "";
      const faculty = facultyForDisciplineCode(disciplines, faculties, subject);
      const termIds = termIdsSorted.filter((termId) =>
        presence.courseComponentsByTerm.get(termId)?.has(componentId),
      );
      const gradeViz = entry?.gradeViz ?? null;

      return {
        code: entry?.courseCode ?? code,
        norm,
        title: entry?.courseTitle ?? catalogueCourse?.title ?? "",
        found: entry != null || catalogueCourse != null,
        credits:
          catalogueCourse && Number.isFinite(catalogueCourse.credits)
            ? catalogueCourse.credits
            : null,
        facultyName: faculty ? localizeFacultyName(faculty, i18n.locale) : null,
        level: entry?.level ?? null,
        language: entry?.language ?? null,
        prereqText: catalogueCourse?.prereqText ?? null,
        termIds,
        gradeViz,
        avgGpa: gradeVizGpa(gradeViz),
        passingPercent: gradeViz ? gradeViz.passingPercent : null,
        maxProfessorRating: entry?.maxProfessorRating ?? null,
        sentiment: courseByNorm?.get(norm) ?? null,
      };
    });

    return { data, loading };
  }, [
    codes,
    loading,
    getCourseEntryByNorm,
    getTermPresence,
    aliasGroups,
    dataCache,
    disciplines,
    faculties,
    terms,
    courseByNorm,
    i18n.locale,
  ]);
}
