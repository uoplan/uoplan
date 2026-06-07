import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../store/appStore";

/**
 * Read the lazily-loaded grade dataset, triggering its fetch on first use. The
 * underlying `ensureCourseGrades` action is idempotent and memoized, so calling
 * this hook from several places fetches `grades.pb` at most once.
 */
export function useCourseGradesPb() {
  const ensureCourseGrades = useAppStore((s) => s.ensureCourseGrades);

  useEffect(() => {
    void ensureCourseGrades();
  }, [ensureCourseGrades]);

  return useAppStore(
    useShallow((s) => ({
      loading: s.courseGradesLoading,
      data: s.courseGrades,
      error: s.courseGradesError,
    })),
  );
}
