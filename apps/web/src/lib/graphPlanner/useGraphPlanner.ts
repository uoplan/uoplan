import { useCallback, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStoreApi } from "../../store/hooks";
import { useGraphPlannerStore } from "../../store/graphPlannerStore";
import type { PlannerRunConfig } from "./types";
import { runPlanner } from "./runPlanner";

/** Lowest term id (chronological) reachable from a set of ids. */
function fromTermOnward(enabledTermIds: string[], termId: string): string[] {
  const threshold = Number(termId);
  return enabledTermIds.filter((id) => Number(id) >= threshold);
}

/**
 * Orchestrates degree-planner generation against the main app store and the
 * isolated planner store. Enabling, disabling, or re-counting a term re-runs
 * that term and every later one (their "completed" base changes), threading each
 * term's picks forward. Results are written to the planner store as they land.
 */
export function useGraphPlanner() {
  const storeApi = useStoreApi();
  const [isGenerating, setIsGenerating] = useState(false);
  const [runningTermId, setRunningTermId] = useState<string | null>(null);
  // Guards against overlapping runs (each run is sequential and mutates the
  // shared planner worker); the latest requested run wins.
  const runToken = useRef(0);

  const {
    enableTerm,
    disableTerm,
    setCountForTerm,
    setDefaultCount,
    setGeneratedTerm,
    clearGeneratedFrom,
    clearAllGenerated,
  } = useGraphPlannerStore(
    useShallow((s) => ({
      enableTerm: s.enableTerm,
      disableTerm: s.disableTerm,
      setCountForTerm: s.setCountForTerm,
      setDefaultCount: s.setDefaultCount,
      setGeneratedTerm: s.setGeneratedTerm,
      clearGeneratedFrom: s.clearGeneratedFrom,
      clearAllGenerated: s.clearAllGenerated,
    })),
  );

  /**
   * Regenerate `startTermId` (or all enabled terms when omitted) and every later
   * enabled term. Earlier terms' picks are reused as the completed base.
   */
  const regenerateFrom = useCallback(
    async (startTermId?: string): Promise<void> => {
      const base = storeApi.getState();
      if (!base.program || !base.cache) return;

      const planner = useGraphPlannerStore.getState();
      const enabled = planner.enabledTermIds;
      if (enabled.length === 0) return;

      const termsToRun = startTermId ? fromTermOnward(enabled, startTermId) : enabled;
      if (termsToRun.length === 0) return;

      // Seed the accumulated completed set with the real transcript plus the
      // picks of every enabled term *before* the first term we're regenerating.
      const firstRunId = Number(termsToRun[0]);
      const accumulated = new Set(base.completedCourses);
      for (const id of enabled) {
        if (Number(id) < firstRunId) {
          for (const code of planner.generatedByTermId[id]?.courses ?? []) accumulated.add(code);
        }
      }

      const config: PlannerRunConfig = {
        enabledTermIds: termsToRun,
        countByTermId: planner.countByTermId,
        defaultCount: planner.defaultCount,
        cartByTermId: planner.cartByTerm,
      };

      const token = ++runToken.current;
      setIsGenerating(true);
      // Invalidate the terms we're about to recompute so stale picks never show.
      clearGeneratedFrom(termsToRun[0]);
      try {
        await runPlanner(base, config, [...accumulated], (outcome) => {
          if (runToken.current !== token) return;
          setRunningTermId(outcome.termId);
          setGeneratedTerm({
            termId: outcome.termId,
            courses: outcome.courses,
            requestedCount: outcome.requestedCount,
            status: outcome.status,
            generatedAt: Date.now(),
          });
        });
      } finally {
        if (runToken.current === token) {
          setIsGenerating(false);
          setRunningTermId(null);
        }
      }
    },
    [storeApi, clearGeneratedFrom, setGeneratedTerm],
  );

  const enableAndGenerate = useCallback(
    async (termId: string): Promise<void> => {
      enableTerm(termId);
      await regenerateFrom(termId);
    },
    [enableTerm, regenerateFrom],
  );

  const disableAndReflow = useCallback(
    async (termId: string): Promise<void> => {
      const before = useGraphPlannerStore.getState().enabledTermIds;
      const nextAfter = before.find((id) => Number(id) > Number(termId));
      disableTerm(termId);
      // Later terms relied on this term's picks as completed; recompute them.
      if (nextAfter) await regenerateFrom(nextAfter);
    },
    [disableTerm, regenerateFrom],
  );

  const changeCount = useCallback(
    async (termId: string, count: number): Promise<void> => {
      setCountForTerm(termId, count);
      await regenerateFrom(termId);
    },
    [setCountForTerm, regenerateFrom],
  );

  const regenerateAll = useCallback(async (): Promise<void> => {
    await regenerateFrom();
  }, [regenerateFrom]);

  return {
    isGenerating,
    runningTermId,
    enableTerm: enableAndGenerate,
    disableTerm: disableAndReflow,
    changeCount,
    setDefaultCount,
    regenerateAll,
    regenerateFrom,
    clearAllGenerated,
  };
}
