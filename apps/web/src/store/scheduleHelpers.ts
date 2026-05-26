// Pool helpers have been moved to @uoplan/schedule.
// Re-exported here for backward compatibility with existing imports.
export {
  type RequirementPool,
  buildRequirementPools,
  computeCoursesPerPool,
  buildPoolCaps,
  poolCourseCap,
  isBroadElectivePoolType,
  isElectiveRequirementType,
  isWithinElectiveLevelCap,
  isWithinElectiveLevelBuckets,
  virtualScheduleFilterApplies,
  enumerateSingleRedistributions,
  shuffleInPlace,
  weightedRandomPick,
  courseLevelSortKey,
  candidatePoolWeight,
  LEVEL_WEIGHT_BASE,
} from "@uoplan/schedule";

// reorderGeneralPoolForDisciplineDiversity is used only by the web app.
function disciplinePrefixFromCourseCode(code: string): string {
  return code.split(/\s+/)[0]?.toUpperCase() ?? "";
}

export function reorderGeneralPoolForDisciplineDiversity(
  codes: string[],
  chosenCodes: Set<string>,
): void {
  const chosenDisciplines = new Set<string>();
  for (const code of chosenCodes) {
    chosenDisciplines.add(disciplinePrefixFromCourseCode(code));
  }
  codes.sort((a, b) => {
    const da = disciplinePrefixFromCourseCode(a);
    const db = disciplinePrefixFromCourseCode(b);
    const aSeen = chosenDisciplines.has(da);
    const bSeen = chosenDisciplines.has(db);
    if (aSeen !== bSeen) return aSeen ? 1 : -1;
    return 0;
  });
}
