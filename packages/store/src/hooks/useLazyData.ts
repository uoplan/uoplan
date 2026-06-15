import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/**
 * Lazily-loaded secondary assets (grades, professor registry/ratings, disciplines)
 * with their loading/error flags and the idempotent `ensureX` triggers. Consumers
 * gate skeletons on the loading flags (not null checks), since an asset may be
 * legitimately absent.
 */
export function useLazyData() {
  const reads = useAppStore(
    useShallow((s) => ({
      courseGrades: s.courseGrades,
      courseGradesError: s.courseGradesError,
      courseGradesLoading: s.courseGradesLoading,
      professors: s.professors,
      professorsLoading: s.professorsLoading,
      professorRatings: s.professorRatings,
      professorRatingsLoading: s.professorRatingsLoading,
      disciplines: s.disciplines,
    })),
  );

  const ensureCourseGrades = useAppStore((s) => s.ensureCourseGrades);
  const ensureProfessorRatings = useAppStore((s) => s.ensureProfessorRatings);
  const ensureProfessors = useAppStore((s) => s.ensureProfessors);
  const ensureDisciplines = useAppStore((s) => s.ensureDisciplines);

  return {
    ...reads,
    ensureCourseGrades,
    ensureProfessorRatings,
    ensureProfessors,
    ensureDisciplines,
  };
}

/** Professor registry (slug/legacyId lookups), or null until `ensureProfessors` settles. */
export function useProfessorRegistry() {
  return useAppStore((s) => s.professors);
}

/** RateMyProfessors ratings map, or null until `ensureProfessorRatings` settles. */
export function useProfessorRatings() {
  return useAppStore((s) => s.professorRatings);
}

/** Disciplines list, or null until `ensureDisciplines` settles. */
export function useDisciplines() {
  return useAppStore((s) => s.disciplines);
}

/** Canonical faculty registry, or null until `ensureDisciplines` settles. */
export function useFaculties() {
  return useAppStore((s) => s.faculties);
}
