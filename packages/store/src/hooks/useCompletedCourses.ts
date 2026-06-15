import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/**
 * The user's completed courses (plus the derived `unassignedCompletedCourses`) with
 * the add/remove/set mutators.
 */
export function useCompletedCourses() {
  const { completedCourses, unassignedCompletedCourses } = useAppStore(
    useShallow((s) => ({
      completedCourses: s.completedCourses,
      unassignedCompletedCourses: s.unassignedCompletedCourses,
    })),
  );

  const setCompletedCourses = useAppStore((s) => s.setCompletedCourses);
  const addCompletedCourse = useAppStore((s) => s.addCompletedCourse);
  const removeCompletedCourse = useAppStore((s) => s.removeCompletedCourse);

  return {
    completedCourses,
    unassignedCompletedCourses,
    setCompletedCourses,
    addCompletedCourse,
    removeCompletedCourse,
  };
}
