import type { GenerateSchedulesResult } from "../generateSchedulesAction";
import type { AppState } from "../../store/types";
import { generatePlannerTermViaWorker } from "../../workers/plannerWorkerClient";
import type { PlannerTermStatus } from "../../store/graphPlannerStore";
import { buildPlannerTermInput, plannerTermDataKey } from "./buildTermInput";
import type { PlannerRunConfig, PlannerTermOutcome } from "./types";

/** Course codes enrolled in a generated schedule, in order. */
function scheduleCourses(result: GenerateSchedulesResult | null): string[] {
  return result?.currentSchedule?.enrollments.map((e) => e.courseCode) ?? [];
}

/** Classify a term's generation outcome for UI coloring. */
function classify(
  result: GenerateSchedulesResult | null,
  courses: string[],
  requestedCount: number,
): PlannerTermStatus {
  if (!result) return "error";
  if (result.generationError?.message.kind === "timeout") return "error";
  if (courses.length === 0) return "empty";
  if (courses.length < requestedCount) return "partial";
  return "ok";
}

/** Requested count for a term, falling back to the config default. */
function countFor(config: PlannerRunConfig, termId: string): number {
  return config.countByTermId[termId] ?? config.defaultCount;
}

/**
 * Generate one future term, given the effective completed set (base transcript
 * plus everything the earlier terms already picked).
 */
async function generatePlannerTerm(
  base: AppState,
  termId: string,
  requestedCount: number,
  effectiveCompleted: string[],
  forcedCourses: string[],
  seed: number | undefined,
): Promise<PlannerTermOutcome> {
  const input = buildPlannerTermInput(
    base,
    effectiveCompleted,
    requestedCount,
    forcedCourses,
    seed,
  );
  const dataKey = plannerTermDataKey(base, termId);
  const result = await generatePlannerTermViaWorker(dataKey, input);
  const courses = scheduleCourses(result);
  return {
    termId,
    courses,
    requestedCount,
    status: classify(result, courses, requestedCount),
    result,
  };
}

/**
 * Generate every enabled term in chronological order, threading each term's
 * picks forward as "completed" for the terms that follow. `onOutcome` fires
 * after each term so the UI can render progressively.
 *
 * `baseCompleted` is the student's real completed set (from the transcript /
 * main store); the returned outcomes are also applied by the caller to the
 * planner store.
 */
export async function runPlanner(
  base: AppState,
  config: PlannerRunConfig,
  baseCompleted: string[],
  onOutcome?: (outcome: PlannerTermOutcome) => void,
): Promise<PlannerTermOutcome[]> {
  const outcomes: PlannerTermOutcome[] = [];
  const accumulated = new Set(baseCompleted);

  for (const termId of config.enabledTermIds) {
    const requestedCount = countFor(config, termId);
    const forcedCourses = config.cartByTermId?.[termId] ?? [];
    const seed = config.seedByTermId?.[termId];
    const outcome = await generatePlannerTerm(
      base,
      termId,
      requestedCount,
      [...accumulated],
      forcedCourses,
      seed,
    );
    for (const code of outcome.courses) accumulated.add(code);
    outcomes.push(outcome);
    onOutcome?.(outcome);
  }

  return outcomes;
}
