import {
  diagnoseTimetableFailure,
  countValidCombosForCourse,
  type TimetableFailureDiagnostics,
} from "@uoplan/core/generationDiagnostics";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import type { SchedulesData } from "@uoplan/core/dataTypes";
import { courseSentimentByNorm, professorSentimentByName } from "@uoplan/core/feedback";
import { formatTermNameEn } from "@uoplan/core/gradeTrends";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useBasket } from "@/data/basket-provider";
import { useCompletedCourses } from "@/data/completed-courses-provider";
import { useAppData } from "@/data/data-provider";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import { engineController } from "@/lib/engine/native-engine";
import {
  buildGenerationConstraints,
  buildScheduleDataCache,
  createScheduleGenerator,
  firstYearCreditCapFor,
  type ScheduleGenerator,
  type ScheduleVariant,
  type SkippedCourse,
} from "@/lib/generate-schedule";
import {
  getActiveScheduleRequirementContext,
  subscribeScheduleRequirementContext,
} from "@/lib/personalize-requirements";
import { getAnalytics } from "@/lib/analytics/client";

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
  /**
   * Basket courses automatically excluded from generation — each with the
   * reason it was left out (prerequisites unmet, or no schedulable section this
   * term). Surfaced so the UI can tell the user what was left out and how to fix
   * it — even when generation otherwise succeeds.
   */
  skippedCourses?: SkippedCourse[];
  error?: string;
}

/**
 * The schedule-generation hook result: the current generation {@link
 * GenerationState} plus an unbounded pager over the lazily-generated variants.
 * Variants are produced one at a time (seed by seed) — {@link
 * ScheduleGenerationResult.hasNext} stays true until the engine can't produce
 * another distinct arrangement, at which point {@link next} stops advancing.
 */
export interface ScheduleGenerationResult extends GenerationState {
  /** Index of the variant currently shown (0-based). */
  index: number;
  /** Whether there's an earlier already-generated variant to step back to. */
  hasPrev: boolean;
  /** Whether another variant exists (cached or still generatable). */
  hasNext: boolean;
  /** True while the next variant is being generated on demand. */
  loadingMore: boolean;
  /** Show the next variant, generating it lazily if it isn't cached yet. */
  next: () => void;
  /** Show the previous already-generated variant. */
  prev: () => void;
  /** Force a fresh generation run (e.g. a manual retry). */
  regenerate: () => void;
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
export function useScheduleGeneration(): ScheduleGenerationResult {
  const { bundle, schedulesByTerm, feedback } = useAppData();
  const { codes } = useBasket();
  const { codes: completedCodes } = useCompletedCourses();
  const { options, personalization } = useScheduleOptions();
  const [nonce, setNonce] = useState(0);

  const [status, setStatus] = useState<GenerationStatus>("empty");
  const [variants, setVariants] = useState<ScheduleVariant[]>([]);
  const [index, setIndex] = useState(0);
  const [termId, setTermId] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<TimetableFailureDiagnostics | null>(null);
  const [skippedCourses, setSkippedCourses] = useState<SkippedCourse[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // The live generator + its abort controller for the current run, replaced on
  // every regeneration. `next()` pulls additional variants from the generator.
  const generatorRef = useRef<ScheduleGenerator | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

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
  const completedKey = completedCodes.join(",");
  // Re-generate whenever any option changes (a stable signature of the options).
  const optionsKey = JSON.stringify(options);
  // The planner has academic grounding once a program or start year is set; it
  // gates prerequisite-based skipping during generation (see generate-schedule).
  const hasProfileContext =
    Boolean(personalization.programUrl) || Boolean(personalization.startYear);
  const requirementKey = useSyncExternalStore(
    subscribeScheduleRequirementContext,
    () => JSON.stringify(getActiveScheduleRequirementContext()),
    () => "null",
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    controllerRef.current = controller;
    generatorRef.current = null;
    setLoadingMore(false);
    setIndex(0);

    const activeRequirements = getActiveScheduleRequirementContext();

    if (codes.length === 0 && !activeRequirements?.programUrl) {
      setStatus("empty");
      setVariants([]);
      setTermId(null);
      setDiagnostics(null);
      setSkippedCourses(undefined);
      setError(undefined);
      setCanLoadMore(false);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const term = pickTerm(schedulesByTerm, codes);
    if (!term) {
      setStatus("error");
      setVariants([]);
      setTermId(null);
      setDiagnostics(null);
      setSkippedCourses(undefined);
      setError("No schedule data");
      setCanLoadMore(false);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const schedules = schedulesByTerm.get(term)!;
    const startedAt = Date.now();
    // Non-PII segmentation dimensions shared across every generation event so
    // the funnel/drop-off can be broken down by program and academic load.
    const segment = {
      programId: activeRequirements?.programUrl ?? personalization.programUrl ?? undefined,
      completedCount: completedCodes.length,
    };
    const termName = formatTermNameEn(term);
    setStatus("generating");
    setTermId(term);
    setDiagnostics(null);
    setVariants([]);
    setError(undefined);
    setCanLoadMore(false);
    getAnalytics().capture("schedule_generate_started", {
      termId: term,
      termName,
      mode: activeRequirements ? "advanced" : "basic",
      ...segment,
    });

    void (async () => {
      try {
        const generator = await createScheduleGenerator({
          datasetKey: term,
          catalogue: bundle.catalogue,
          schedules,
          disciplines: { disciplines: bundle.disciplines, faculties: bundle.faculties },
          ratings: bundle.ratings,
          grades: bundle.grades,
          sentiment,
          basketCodes: codes,
          completedCourses: completedCodes,
          hasProfileContext,
          ...(activeRequirements ? { requirements: activeRequirements } : {}),
          options,
          signal: controller.signal,
          engine: engineController,
        });
        if (cancelled) return;
        generatorRef.current = generator;
        const skipped = generator.skippedCourses.length > 0 ? generator.skippedCourses : undefined;

        // Paint the first conflict-free timetable as soon as it's found; further
        // variants are pulled lazily on demand by `next()` (unbounded — until the
        // engine can't produce another distinct arrangement).
        const first = await generator.next(controller.signal);
        if (cancelled) return;
        if (first) {
          setVariants([first]);
          setIndex(0);
          setSkippedCourses(skipped);
          setCanLoadMore(true);
          setStatus("ready");
          getAnalytics().capture("schedule_generated", {
            resultCount: 1,
            durationMs: Date.now() - startedAt,
            hasConflicts: false,
            relaxationsApplied: Boolean(skipped?.length),
            termId: term,
            termName,
            ...segment,
          });
          return;
        }

        // No conflict-free timetable at all. For the basket case, run the SAME
        // core diagnostics the web app uses (pinned = basket, no optional pool)
        // so the UI can show a friendly lead + quick-fix suggestions instead of a
        // generic error. Requirement-driven generation (no basket courses) falls
        // back to a generic shared message in the UI (diagnostics null).
        let diag: TimetableFailureDiagnostics | null = null;
        if (codes.length > 0) {
          try {
            const { cache } = buildScheduleDataCache(
              bundle.catalogue,
              schedules,
              { disciplines: bundle.disciplines, faculties: bundle.faculties },
              bundle.grades,
            );
            const constraints = buildGenerationConstraints(
              options,
              bundle.ratings,
              firstYearCreditCapFor(options, completedCodes, cache),
            );
            // Diagnose only the courses that are actually schedulable this term;
            // every skipped course (prerequisites unmet or no open section) is
            // reported separately, so the suggestions should be about real
            // conflicts among the remaining basket, not the excluded ones.
            const skippedNorm = new Set((skipped ?? []).map((s) => normalizeCourseCode(s.code)));
            const schedulable = codes.filter(
              (c) =>
                !skippedNorm.has(normalizeCourseCode(c)) &&
                countValidCombosForCourse(c, cache, constraints) > 0,
            );
            if (schedulable.length > 0) {
              diag = diagnoseTimetableFailure({
                pinnedCourseCodes: schedulable,
                optionalCourseCodes: [],
                targetCount: schedulable.length,
                cache,
                constraints,
              });
            }
          } catch {
            diag = null;
          }
        }
        setVariants([]);
        setSkippedCourses(skipped);
        setDiagnostics(diag);
        setCanLoadMore(false);
        setStatus("none");
        getAnalytics().capture("schedule_generate_empty", {
          termId: term,
          termName,
          reason: skipped && skipped.length > 0 && !diag ? "all_courses_skipped" : "no_schedule",
          ...segment,
        });
      } catch (err: unknown) {
        if (cancelled) return;
        setVariants([]);
        setDiagnostics(null);
        setCanLoadMore(false);
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
        getAnalytics().capture("schedule_generate_failed", {
          termId: term,
          termName,
          reason: err instanceof Error && err.name ? err.name : "error",
          ...segment,
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    key,
    completedKey,
    nonce,
    schedulesByTerm,
    bundle,
    sentiment,
    optionsKey,
    requirementKey,
    hasProfileContext,
  ]);

  const next = useCallback(() => {
    if (index < variants.length - 1) {
      setIndex(index + 1);
      return;
    }
    // At the end of the cached variants — lazily pull the next one (if any).
    if (!canLoadMore || loadingMore) return;
    const generator = generatorRef.current;
    if (!generator) return;
    setLoadingMore(true);
    void generator
      .next(controllerRef.current?.signal)
      .then((variant) => {
        setLoadingMore(false);
        if (variant) {
          setVariants((vs) => [...vs, variant]);
          setIndex((i) => i + 1);
        } else {
          setCanLoadMore(false);
        }
      })
      .catch(() => {
        setLoadingMore(false);
        setCanLoadMore(false);
      });
  }, [index, variants.length, canLoadMore, loadingMore]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  return {
    status,
    variants,
    termId,
    diagnostics,
    skippedCourses,
    error,
    index,
    hasPrev: index > 0,
    hasNext: index < variants.length - 1 || canLoadMore,
    loadingMore,
    next,
    prev,
    regenerate: () => setNonce((n) => n + 1),
  };
}
