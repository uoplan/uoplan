import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  analyzeFrenchImmersionProgress,
  normalizeCourseCode,
  programTitleIndicatesNursing,
} from "@uoplan/core";
import { useAppStore } from "../../store/appStore";

export function useFrenchImmersionProgressState() {
  const { frenchImmersionStream, completedCourses, currentSchedule, cache, program } = useAppStore(
    useShallow((s) => ({
      frenchImmersionStream: s.frenchImmersionStream,
      completedCourses: s.completedCourses,
      currentSchedule: s.currentSchedule,
      cache: s.cache,
      program: s.program,
    })),
  );

  const progress = useMemo(() => {
    const scheduleCodes = currentSchedule?.enrollments.map((e) => e.courseCode) ?? [];
    const merged = [...completedCourses, ...scheduleCodes].map((c) => normalizeCourseCode(c));
    return analyzeFrenchImmersionProgress(merged, cache, {
      isNursingProgram: programTitleIndicatesNursing(program?.title),
    });
  }, [completedCourses, currentSchedule, cache, program?.title]);

  return { frenchImmersionStream, completedCourses, progress };
}
