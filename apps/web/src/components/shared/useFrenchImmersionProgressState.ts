import { useMemo } from "react";
import {
  analyzeFrenchImmersionProgress,
  normalizeCourseCode,
  programTitleIndicatesNursing,
} from "@uoplan/core";
import {
  useCompletedCourses,
  useDataCache,
  useProgramSelection,
  useScheduleGeneration,
} from "../../store/hooks";

export function useFrenchImmersionProgressState() {
  const { frenchImmersionStream, program } = useProgramSelection();
  const { completedCourses } = useCompletedCourses();
  const { currentSchedule } = useScheduleGeneration();
  const cache = useDataCache();

  const progress = useMemo(() => {
    const scheduleCodes = currentSchedule?.enrollments.map((e) => e.courseCode) ?? [];
    const merged = [...completedCourses, ...scheduleCodes].map((c) => normalizeCourseCode(c));
    return analyzeFrenchImmersionProgress(merged, cache, {
      isNursingProgram: programTitleIndicatesNursing(program?.title),
    });
  }, [completedCourses, currentSchedule, cache, program?.title]);

  return { frenchImmersionStream, completedCourses, progress };
}
