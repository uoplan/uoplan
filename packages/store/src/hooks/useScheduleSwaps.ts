import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/**
 * Swap state (applied swaps for the current schedule + per-seed history) with the
 * swap actions used by the calendar's course-swap overlay. The per-course swap
 * eligibility/tooltip logic lives in `hooks/useSwapActions`, which builds on these.
 */
export function useScheduleSwaps() {
  const { currentSwaps, swapsPerSeed } = useAppStore(
    useShallow((s) => ({
      currentSwaps: s.currentSwaps,
      swapsPerSeed: s.swapsPerSeed,
    })),
  );

  const getSwapCandidates = useAppStore((s) => s.getSwapCandidates);
  const swapCourseInSchedule = useAppStore((s) => s.swapCourseInSchedule);
  const undoLastSwap = useAppStore((s) => s.undoLastSwap);

  return {
    currentSwaps,
    swapsPerSeed,
    getSwapCandidates,
    swapCourseInSchedule,
    undoLastSwap,
  };
}
