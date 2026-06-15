import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/**
 * Seed navigation state (current/first/lowest-visited seed + the "no variety" flag)
 * with the prev/next/randomize actions that drive the calendar's schedule shuffler.
 */
export function useSeedNavigation() {
  const reads = useAppStore(
    useShallow((s) => ({
      firstSeed: s.firstSeed,
      currentSeed: s.currentSeed,
      lowestVisitedSeed: s.lowestVisitedSeed,
      scheduleNoVariety: s.scheduleNoVariety,
    })),
  );

  const goToPreviousSeed = useAppStore((s) => s.goToPreviousSeed);
  const goToNextSeed = useAppStore((s) => s.goToNextSeed);
  const randomizeSeed = useAppStore((s) => s.randomizeSeed);

  return { ...reads, goToPreviousSeed, goToNextSeed, randomizeSeed };
}
