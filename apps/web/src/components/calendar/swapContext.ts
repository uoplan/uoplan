import { createContext, useContext } from "react";
import type { DataCache, ProfessorRatingsMap } from "@uoplan/core";
import type { SwapCandidateOption, SwapResult } from "../../hooks/useSwapModal";

/** Sort order for the swap candidate list. */
export type SwapSortKey = "best" | "aplus" | "rating" | "alpha";
/** Difficulty bucket filter for the swap candidate list. */
export type SwapDifficulty = "easy" | "moderate" | "tough";

/**
 * Shared controller for the calendar swap overlay. Provided by `CalendarView`
 * and consumed by each `WeekCalendarEvent` so the popover (desktop) / drawer
 * (mobile) can render details for whichever event is currently active.
 */
export interface SwapContextValue {
  /** enrollmentIndex of the event whose overlay is open, or null. */
  activeEnrollmentIndex: number | null;
  /** Unique id of the specific clicked event instance (anchors the desktop popover). */
  activeEventId: string | null;
  isMobile: boolean;
  loading: boolean;
  result: SwapResult;
  candidateOptions: SwapCandidateOption[];
  query: string;
  setQuery: (q: string) => void;
  closeModal: () => void;
  onSwap: (enrollmentIndex: number, newCourseCode: string) => void;
  cache: DataCache | null;
  professorRatings: ProfessorRatingsMap | null;
  /** "Prefer easier courses" generation preference — drives candidate ranking. */
  preferEasier: boolean;

  /**
   * Fullscreen overlay state. When `isFullscreen` is true the desktop popover is
   * suppressed and `CalendarView` renders the same details in a large overlay over
   * the calendar area. The overlay reuses this context, so no candidates are recomputed.
   */
  isFullscreen: boolean;
  openFullscreen: () => void;
  closeFullscreen: () => void;

  /**
   * Swap-list UI state lifted into context so it is preserved when the details swap
   * between the popover and fullscreen overlay instances (only one is mounted at a time).
   */
  sortKey: SwapSortKey;
  setSortKey: (key: SwapSortKey) => void;
  difficulty: SwapDifficulty | null;
  setDifficulty: (difficulty: SwapDifficulty | null) => void;
}

const SwapContext = createContext<SwapContextValue | null>(null);

export const SwapContextProvider = SwapContext.Provider;

export function useSwapContext(): SwapContextValue | null {
  return useContext(SwapContext);
}
