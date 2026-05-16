import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../store/appStore";

export function useCourseGradesPb() {
  return useAppStore(
    useShallow((s) => ({
      loading: s.loading,
      data: s.courseGrades,
      error: s.courseGradesError,
    })),
  );
}
