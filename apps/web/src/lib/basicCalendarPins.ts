const BASIC_ELECTIVES_COUNT_MAX = 8;

/** Basic mode needs at least one required course or elective slot before seed navigation / generation. */
export function canGenerateBasicSchedule(
  pinnedCourseCount: number,
  electivesCount: number,
): boolean {
  return pinnedCourseCount > 0 || electivesCount > 0;
}

/** When pinned required courses change by `pinnedDelta`, adjust elective slot count inversely. */
export function basicElectivesAfterPinnedDelta(
  currentElectives: number,
  pinnedDelta: number,
): number {
  return Math.max(0, Math.min(BASIC_ELECTIVES_COUNT_MAX, currentElectives - pinnedDelta));
}
