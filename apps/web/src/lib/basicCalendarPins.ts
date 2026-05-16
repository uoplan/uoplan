export const BASIC_ELECTIVES_COUNT_MAX = 8;

/** When pinned required courses change by `pinnedDelta`, adjust elective slot count inversely. */
export function basicElectivesAfterPinnedDelta(
  currentElectives: number,
  pinnedDelta: number,
): number {
  return Math.max(0, Math.min(BASIC_ELECTIVES_COUNT_MAX, currentElectives - pinnedDelta));
}
