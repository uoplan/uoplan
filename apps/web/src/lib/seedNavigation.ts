/** Next seed when advancing schedule variants (0 → anchor, else +1). */
export function nextSeed(firstSeed: number, currentSeed: number): number {
  return currentSeed === 0 ? firstSeed : currentSeed + 1;
}

/**
 * Keeps currentSeed on the anchor ladder: 0 (unset) or currentSeed >= firstSeed.
 * Orphan values from the old 0→1 increment bug reset to 0 so the next navigation
 * lands on firstSeed instead of skipping straight to firstSeed+1.
 */
export function repairSeedPosition(firstSeed: number, currentSeed: number): number {
  if (currentSeed === 0) return 0;
  if (currentSeed < firstSeed) return 0;
  return currentSeed;
}

/** Record the earliest seed the user has successfully generated at this session. */
export function noteLowestVisitedSeed(lowestVisitedSeed: number | null, seed: number): number {
  if (lowestVisitedSeed == null) return seed;
  return Math.min(lowestVisitedSeed, seed);
}

/**
 * When restoring from share/localStorage (no explicit visit history), assume the user
 * reached `currentSeed` from `firstSeed` so Previous stays available after refresh.
 */
export function inferLowestVisitedSeedFromPersisted(
  firstSeed: number,
  currentSeed: number,
): number | null {
  if (currentSeed === 0) return null;
  if (currentSeed <= firstSeed) return currentSeed;
  return firstSeed;
}

/** True only when the user has generated at least two distinct seed positions. */
export function canGoToPreviousSeed(
  currentSeed: number,
  lowestVisitedSeed: number | null,
): boolean {
  if (lowestVisitedSeed == null) return false;
  return currentSeed > lowestVisitedSeed;
}
