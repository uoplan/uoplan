/**
 * Projection-hooks layer for the app store. These hooks are the only sanctioned
 * consumers of `useAppStore` / `useAppStoreApi` outside the store itself — components
 * import a domain hook from here instead of selecting raw store fields. See
 * `docs/store-architecture.md` (projection-hooks layer).
 */
export { useDataset, useDataCache, useCatalogue, useIndices, useLoadData } from "./useDataset";
export {
  useLazyData,
  useProfessorRegistry,
  useProfessorRatings,
  useDisciplines,
} from "./useLazyData";
export { useTermSelection, useTerms, useYearCatalogue } from "./useTermSelection";
export { useProgramSelection, useActiveProgram } from "./useProgramSelection";
export { useCompletedCourses } from "./useCompletedCourses";
export { useRequirementState, useRequirementActions } from "./useRequirements";
export { useGenerationConstraints } from "./useGenerationConstraints";
export {
  useScheduleGeneration,
  useScheduleResultMaps,
  useCoursesThisSemester,
  useBasicElectives,
} from "./useScheduleGeneration";
export { useSeedNavigation } from "./useSeedNavigation";
export { useScheduleSwaps } from "./useScheduleSwaps";
export { useCalendarView, useBlockedTimes } from "./useCalendarView";
export { useShareState, useGetShareUrl } from "./useShareState";
export { useSaveStatus } from "./useSaveStatus";
export { useGlobalActions } from "./useGlobalActions";
export { useStoreApi } from "./useStoreApi";
