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
  enableTerm: (termId: string) => void;
  disableTerm: (termId: string) => void;
  changeCount: (termId: string, count: number) => void;
  regenerateTerm: (termId: string) => void;
  /** Open a future term in the calendar view to edit it closely. */
  openInCalendar: (termId: string) => void;
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
