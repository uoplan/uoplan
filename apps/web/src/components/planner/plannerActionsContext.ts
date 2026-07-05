import { createContext, useContext } from "react";

/**
 * Planner actions + status exposed to React Flow custom nodes (band headers)
 * without threading them through node `data` (which would rebuild every node on
 * each render). Provided by {@link DegreePlannerPage}.
 */
export interface PlannerActions {
  /** Whether a program is selected (advanced generation requires one). */
  hasProgram: boolean;
  /** A generation run is in flight. */
  isGenerating: boolean;
  /** The term currently being generated, if any. */
  runningTermId: string | null;
  /** The term currently focused in the panel (its node is highlighted). */
  selectedTermId: string | null;
  enableTerm: (termId: string) => void;
  disableTerm: (termId: string) => void;
  changeCount: (termId: string, count: number) => void;
  regenerateTerm: (termId: string) => void;
  /** Step the term back to its previous schedule variant. */
  previousTerm: (termId: string) => void;
  /** Open a future term in the calendar view to edit it closely. */
  openInCalendar: (termId: string) => void;
  /** Focus a term in the panel (or `null` for the Overview tab). */
  selectTerm: (termId: string | null) => void;
  /** Download a single planned term's timetable as an `.ics` file. */
  downloadTerm: (termId: string) => void;
  /** Download every planned term as one combined `.ics` file. */
  downloadAllTerms: () => void;
  /** Route the user to Personalize to pick a program. */
  goToPersonalize: () => void;
}

const PlannerActionsContext = createContext<PlannerActions | null>(null);

export const PlannerActionsProvider = PlannerActionsContext.Provider;

export function usePlannerActions(): PlannerActions {
  const ctx = useContext(PlannerActionsContext);
  if (!ctx) throw new Error("usePlannerActions must be used within PlannerActionsProvider");
  return ctx;
}
