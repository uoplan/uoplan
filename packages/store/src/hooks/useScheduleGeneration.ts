import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/**
 * The current generated schedule plus generation status (in-flight, error, and the
 * "options changed since last run" dirty flag), with the generation lifecycle actions.
 */
export function useScheduleGeneration() {
  const reads = useAppStore(
    useShallow((s) => ({
      currentSchedule: s.currentSchedule,
      scheduleGenerating: s.scheduleGenerating,
      generationError: s.generationError,
      generationOptionsDirty: s.generationOptionsDirty,
    })),
  );

  const generateSchedules = useAppStore((s) => s.generateSchedules);
  const generateBasicSchedules = useAppStore((s) => s.generateBasicSchedules);
  const clearSchedule = useAppStore((s) => s.clearSchedule);
  const clearGenerationOptions = useAppStore((s) => s.clearGenerationOptions);
  const resetBasicCalendarSettings = useAppStore((s) => s.resetBasicCalendarSettings);
  const markBasicSettingsChanged = useAppStore((s) => s.markBasicSettingsChanged);
  const importSchedule = useAppStore((s) => s.importSchedule);

  return {
    ...reads,
    generateSchedules,
    generateBasicSchedules,
    clearSchedule,
    clearGenerationOptions,
    resetBasicCalendarSettings,
    markBasicSettingsChanged,
    importSchedule,
  };
}

/**
 * Per-schedule output maps (course → colour, course → pool/requirement) read by the
 * calendar and swap UIs to colour and attribute the generated courses.
 */
export function useScheduleResultMaps() {
  return useAppStore(
    useShallow((s) => ({
      currentColorMap: s.currentColorMap,
      currentPoolMap: s.currentPoolMap,
      chosenCourseToRequirementId: s.chosenCourseToRequirementId,
      swapPool: s.swapPool,
    })),
  );
}

/** "How many courses this semester" count plus its setter. */
export function useCoursesThisSemester() {
  const coursesThisSemester = useAppStore((s) => s.coursesThisSemester);
  const setCoursesThisSemester = useAppStore((s) => s.setCoursesThisSemester);
  return { coursesThisSemester, setCoursesThisSemester };
}

/** Basic-mode elective-slot count plus its setter. */
export function useBasicElectives() {
  const basicElectivesCount = useAppStore((s) => s.basicElectivesCount);
  const setBasicElectivesCount = useAppStore((s) => s.setBasicElectivesCount);
  return { basicElectivesCount, setBasicElectivesCount };
}
