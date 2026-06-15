import {
  diagnoseTimetableFailure,
  type TimetableFailureDiagnostics,
} from "@uoplan/core/generationDiagnostics";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import type { SchedulesData } from "@uoplan/core/dataTypes";
import { courseSentimentByNorm, professorSentimentByName } from "@uoplan/core/feedback";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useBasket } from "@/data/basket-provider";
import { useAppData } from "@/data/data-provider";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import { engineController } from "@/lib/engine/native-engine";
import {
  buildGenerationConstraints,
  buildScheduleDataCache,
  generateScheduleVariants,
  type ScheduleVariant,
} from "@/lib/generate-schedule";
import {
  getActiveScheduleRequirementContext,
  subscribeScheduleRequirementContext,
} from "@/lib/personalize-requirements";

type GenerationStatus = "empty" | "generating" | "ready" | "none" | "error";

export interface GenerationState {
  status: GenerationStatus;
  variants: ScheduleVariant[];
  termId: string | null;
  /**
   * Structured failure diagnostics for the `"none"` status (no conflict-free
   * timetable), computed for the basket case so the UI can show the same
   * friendly lead + quick-fix suggestions as the web app. Null for the
   * requirement-driven case and whenever generation succeeds.
   */
  diagnostics?: TimetableFailureDiagnostics | null;
  error?: string;
}

/** Pick the schedule term offering the most basket courses (ties → newest). */
function pickTerm(schedulesByTerm: Map<string, SchedulesData>, codes: string[]): string | null {
  const terms = [...schedulesByTerm.keys()].sort().reverse();
  if (terms.length === 0) return null;
  if (codes.length === 0) return terms[0]!;
  const wanted = new Set(codes.map((c) => normalizeCourseCode(c)));
  let best = terms[0]!;
  let bestCount = -1;
  for (const termId of terms) {
    const schedules = schedulesByTerm.get(termId)!;
    let count = 0;
    for (const cs of schedules.schedules) if (wanted.has(cs.courseCode)) count++;
    if (count > bestCount) {
      bestCount = count;
      best = termId;
    }
  }
  return best;
}

/**
 * Generate real conflict-free timetables from the basket using the native Rust
 * engine (the same crate the web app runs as WASM). Re-runs whenever the basket
 * changes or {@link regenerate} is called. The engine memoises its per-term
 * dataset load, so subsequent generations within a term are fast.
 */
export function useScheduleGeneration(): GenerationState & { regenerate: () => void } {
  const { bundle, schedulesByTerm, feedback } = useAppData();
  const { codes } = useBasket();
  const { options } = useScheduleOptions();
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<GenerationState>({
    status: "empty",
    variants: [],
    termId: null,
  });

  // Per-course / per-professor satisfaction (1-5) maps from the loaded feedback
  // dataset — surfaced inline on calendar events and in the event detail drawer.
  const sentiment = useMemo(
    () => ({
      courseByNorm: courseSentimentByNorm(feedback),
      professorByName: professorSentimentByName(feedback),
    }),
    [feedback],
  );

  const key = codes.join(",");
  // Re-generate whenever any option changes (a stable signature of the options).
  const optionsKey = JSON.stringify(options);
  const requirementKey = useSyncExternalStore(
    subscribeScheduleRequirementContext,
    () => JSON.stringify(getActiveScheduleRequirementContext()),
    () => "null",
  );

  useEffect(() => {
    let cancelled = false;
    const activeRequirements = getActiveScheduleRequirementContext();

    if (codes.length === 0 && !activeRequirements?.programUrl) {
      setState({ status: "empty", variants: [], termId: null, diagnostics: null });
      return;
    }

    const termId = pickTerm(schedulesByTerm, codes);
    if (!termId) {
      setState({
        status: "error",
        variants: [],
        termId: null,
        diagnostics: null,
        error: "No schedule data",
      });
      return;
    }

    const schedules = schedulesByTerm.get(termId)!;
    setState((s) => ({ ...s, status: "generating", termId, diagnostics: null }));

    void generateScheduleVariants({
      datasetKey: termId,
      catalogue: bundle.catalogue,
      schedules,
      disciplines: { disciplines: bundle.disciplines, faculties: bundle.faculties },
      ratings: bundle.ratings,
      grades: bundle.grades,
      sentiment,
      basketCodes: codes,
      ...(activeRequirements ? { requirements: activeRequirements } : {}),
      options,
      variantCount: 8,
      engine: engineController,
    })
      .then((variants) => {
        if (cancelled) return;
        if (variants.length > 0) {
          setState({ status: "ready", variants, termId, diagnostics: null });
          return;
        }
        // No conflict-free timetable. For the basket case, run the SAME core
        // diagnostics the web app uses (pinned = basket, no optional pool) so
        // the UI can show a friendly lead + quick-fix suggestions instead of a
        // generic error. Requirement-driven generation (no basket courses)
        // falls back to a generic shared message in the UI (diagnostics null).
        let diagnostics: TimetableFailureDiagnostics | null = null;
        if (codes.length > 0) {
          try {
            const { cache } = buildScheduleDataCache(
              bundle.catalogue,
              schedules,
              { disciplines: bundle.disciplines, faculties: bundle.faculties },
              bundle.grades,
            );
            diagnostics = diagnoseTimetableFailure({
              pinnedCourseCodes: codes,
              optionalCourseCodes: [],
              targetCount: codes.length,
              cache,
              constraints: buildGenerationConstraints(options, bundle.ratings),
            });
          } catch {
            diagnostics = null;
          }
        }
        setState({ status: "none", variants, termId, diagnostics });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          variants: [],
          termId,
          diagnostics: null,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce, schedulesByTerm, bundle, sentiment, optionsKey, requirementKey]);

  return { ...state, regenerate: () => setNonce((n) => n + 1) };
}
