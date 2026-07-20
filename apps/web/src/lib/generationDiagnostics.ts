import type {
  FilterHintDescriptor,
  GenerationErrorDetails,
  GenerationErrorState,
  GenerationMessageDescriptor,
} from "@uoplan/store/types";
import { diagnoseTimetableFailure } from "@uoplan/core";
import type {
  cacheWithClosedFilter,
  GenerationConstraints,
  MappedGenerationResult,
  TimetableFailureDiagnostics,
} from "@uoplan/core";

/** Pool diagnostics shape carried by a mapped engine response. */
type PoolDiagnostics = NonNullable<MappedGenerationResult["poolDiagnostics"]>;

export function buildTimetableFailureDiagnostics(
  poolDiagnostics: PoolDiagnostics | null,
  pinned: string[],
  filteredOptionalPool: string[],
  coursesThisSemester: number,
  cache: ReturnType<typeof cacheWithClosedFilter>,
  constraints: GenerationConstraints,
  activeFilterHints?: FilterHintDescriptor[],
): { details: GenerationErrorDetails; timetableFailure: TimetableFailureDiagnostics } {
  const timetableFailure = diagnoseTimetableFailure({
    pinnedCourseCodes: pinned,
    optionalCourseCodes: filteredOptionalPool,
    targetCount: coursesThisSemester,
    cache,
    constraints,
  });
  const details: GenerationErrorDetails = {
    emptyPools: poolDiagnostics?.emptyPools ?? [],
    totalAvailable: poolDiagnostics?.totalAvailable ?? pinned.length + filteredOptionalPool.length,
    totalNeeded: poolDiagnostics?.totalNeeded ?? coursesThisSemester,
    timetableFailure,
    activeFilterHints,
  };
  return { details, timetableFailure };
}

export function generationErrorState(
  message: GenerationMessageDescriptor,
  details: GenerationErrorDetails | null = null,
): GenerationErrorState {
  return { message, details };
}
