import { useCallback, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { nextSeed } from "@uoplan/store/seedNavigation";
import { useStoreApi } from "@uoplan/store/hooks";
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
    setTermResult,
    setTermSeed,
    clearGeneratedFrom,
    clearAllGenerated,
  } = useGraphPlannerStore(
    useShallow((s) => ({
      enableTerm: s.enableTerm,
      disableTerm: s.disableTerm,
      setCountForTerm: s.setCountForTerm,
      setDefaultCount: s.setDefaultCount,
      setGeneratedTerm: s.setGeneratedTerm,
      setTermResult: s.setTermResult,
      setTermSeed: s.setTermSeed,
      clearGeneratedFrom: s.clearGeneratedFrom,
      clearAllGenerated: s.clearAllGenerated,
    })),
  );

  /**
   * Regenerate `startTermId` (or all enabled terms when omitted) and every later
   * enabled term. Earlier terms' picks are reused as the completed base.
   */
  const regenerateFrom = useCallback(
    async (startTermId?: string, opts?: { startSeed?: number }): Promise<void> => {
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

      // Advance each target term's engine seed so a repeat "Regenerate" yields a
      // different variant. `nextSeed(firstSeed, 0)` returns `firstSeed` (first
      // gen matches the calendar's anchor); each later run increments from there.
      // `opts.startSeed` pins the *start* term to an explicit seed instead of
      // advancing — used by "Previous" to step back down the variant ladder.
      const startSeed = opts?.startSeed;
      const seedByTermId: Record<string, number> = { ...planner.seedByTermId };
      for (const id of termsToRun) {
        const seed =
          startSeed !== undefined && id === termsToRun[0]
            ? startSeed
            : nextSeed(base.firstSeed, planner.seedByTermId[id] ?? 0);
        seedByTermId[id] = seed;
        setTermSeed(id, seed);
      }

      const config: PlannerRunConfig = {
        enabledTermIds: termsToRun,
        countByTermId: planner.countByTermId,
        defaultCount: planner.defaultCount,
        cartByTermId: planner.cartByTerm,
        seedByTermId,
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
          if (outcome.result) setTermResult(outcome.termId, outcome.result);
        });
      } finally {
        if (runToken.current === token) {
          setIsGenerating(false);
          setRunningTermId(null);
        }
      }
    },
    [storeApi, clearGeneratedFrom, setGeneratedTerm, setTermResult, setTermSeed],
  );

  const enableAndGenerate = useCallback(
    async (termId: string): Promise<void> => {
      enableTerm(termId);
      await regenerateFrom(termId);
    },
    [enableTerm, regenerateFrom],
  );

  /**
   * Step the term back to its previous schedule variant (seed − 1), down to the
   * anchor (`firstSeed`). Later terms depend on this term's picks, so they
   * regenerate too. No-op once the term is already on its first variant.
   */
  const previousTermVariant = useCallback(
    async (termId: string): Promise<void> => {
      const base = storeApi.getState();
      const planner = useGraphPlannerStore.getState();
      const current = planner.seedByTermId[termId] ?? 0;
      if (current === 0 || current <= base.firstSeed) return;
      await regenerateFrom(termId, { startSeed: current - 1 });
    },
    [storeApi, regenerateFrom],
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
    previousTermVariant,
    clearAllGenerated,
  };
}
