import { createContext, useContext } from "react";
import type { DataCache, ProfessorRatingsMap } from "@uoplan/core";
import type { SwapCandidateOption, SwapResult } from "../../hooks/useSwapModal";

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
}

const SwapContext = createContext<SwapContextValue | null>(null);

export const SwapContextProvider = SwapContext.Provider;

export function useSwapContext(): SwapContextValue | null {
  return useContext(SwapContext);
}
