import { notifications } from "@mantine/notifications";
import type { AppState } from "@uoplan/store/types";
import type { CacheDataKey } from "../lib/dataCacheLoader";
import { pickGenerateSchedulesInput } from "@uoplan/store/generationInput";
import type { GenerateSchedulesInput } from "@uoplan/store/generationInput";
import type { GenerateSchedulesMode } from "@uoplan/store/services";
import type { GenerateSchedulesResult } from "../lib/generateSchedulesAction";
import { tr } from "../i18n";
import { formatTermNameEn } from "@uoplan/core";
import { getAnalytics } from "../lib/analytics";
import { createScheduleWorkerHandle, isWorkerAvailable } from "./scheduleWorkerRemote";

const SCHEDULE_WORKER_FALLBACK_TITLE_ID = "notifications.scheduleWorkerFallback.title";
const SCHEDULE_WORKER_FALLBACK_MESSAGE_ID = "notifications.scheduleWorkerFallback.message";

/**
 * Hard cap on a single schedule-generation run; the worker is killed past this.
 * This is only a last-resort safety net — the Rust engine bounds its own work
 * internally (work-charged budgets in `advanced.rs` / `timetable.rs`), so a run's
 * latency is a function of the inputs, not the seed or wall clock. The cap is set
 * above the engine's worst-case bound (including the ~1.5-2x WASM slowdown) so a
 * legitimately hard-but-feasible request is never killed mid-search.
 */
const SCHEDULE_GENERATION_TIMEOUT_MS = 3_000;

/** Sentinel error thrown when generation exceeds {@link SCHEDULE_GENERATION_TIMEOUT_MS}. */
class ScheduleGenerationTimeoutError extends Error {
  constructor() {
    super("schedule-generation-timeout");
    this.name = "ScheduleGenerationTimeoutError";
  }
}

/** Sentinel error thrown when a run is cancelled via {@link cancelScheduleGeneration}. */
class ScheduleGenerationCancelledError extends Error {
  constructor() {
    super("schedule-generation-cancelled");
    this.name = "ScheduleGenerationCancelledError";
  }
}

/**
 * Reject hook for the in-flight generation, set while a worker call is racing.
 * {@link cancelScheduleGeneration} invokes it to abort the current run; it is
 * cleared once the run settles.
 */
let cancelInFlightGeneration: (() => void) | null = null;

/**
 * Abort the in-flight schedule generation, if any. Terminates the worker so the
 * running computation is abandoned; {@link runScheduleGeneration} then returns
 * `null` (no result applied). Safe to call when nothing is running.
 */
export function cancelScheduleGeneration(): void {
  cancelInFlightGeneration?.();
}

/** Structured result surfaced to the store when generation is killed for timing out. */
function timeoutGenerationResult(): GenerateSchedulesResult {
  return {
    currentSchedule: null,
    swapPool: [],
    chosenCourseToRequirementId: {},
    currentPoolMap: {},
    currentColorMap: {},
    generationError: { message: { kind: "timeout" }, details: null },
  };
}

/**
 * Return true if we can spawn a Web Worker in this environment. False for
 * Node-side SSR/prerender and for test runs where workers aren't available.
 */
const workerHandle = createScheduleWorkerHandle("schedule-worker");
const getRemote = () => workerHandle.getRemote();
const terminateScheduleWorker = () => workerHandle.terminate();

/**
 * Race a worker call against a timeout and an external cancel signal. On timeout
 * the returned promise rejects with a {@link ScheduleGenerationTimeoutError}; on
 * cancel it rejects with a {@link ScheduleGenerationCancelledError}. Either way
 * the caller is responsible for tearing down the (now-unresponsive) worker.
 * While the call is in flight {@link cancelInFlightGeneration} is set so
 * {@link cancelScheduleGeneration} can abort it.
 */
function withGenerationTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ScheduleGenerationTimeoutError()), ms);
    const settle = () => {
      clearTimeout(timer);
      cancelInFlightGeneration = null;
    };
    cancelInFlightGeneration = () => {
      settle();
      reject(new ScheduleGenerationCancelledError());
    };
    void (async () => {
      try {
        const value = await promise;
        settle();
        resolve(value);
      } catch (err) {
        settle();
        reject(err);
      }
    })();
  });
}

/**
 * Compute the {@link CacheDataKey} for the current AppState. We need a
 * `termId` and the completed-course list (OPT subset matters); `firstYear`
 * picks the year-catalogue merge.
 */
function dataKeyFromState(state: AppState): CacheDataKey | null {
  if (!state.selectedTermId) return null;
  return {
    termId: state.selectedTermId,
    firstYear: state.firstYear,
    completedCourses: state.completedCourses,
  };
}

/**
 * Build the worker input from an AppState snapshot. Wraps
 * {@link pickGenerateSchedulesInput} with a sensible default for `mode`.
 */
function inputFromState(state: AppState, mode: GenerateSchedulesMode): GenerateSchedulesInput {
  return pickGenerateSchedulesInput(state, mode);
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function generationErrorReason(result: GenerateSchedulesResult | null): string {
  return result?.generationError?.message.kind ?? "empty";
}

/**
 * Run schedule generation. Uses the worker when available; otherwise falls
 * back to running the pure action in-process (SSR/tests).
 */
export async function runScheduleGeneration(
  state: AppState,
  mode: GenerateSchedulesMode,
): Promise<GenerateSchedulesResult | null> {
  const analytics = getAnalytics();
  const termId = state.selectedTermId ?? undefined;
  const termName = termId ? formatTermNameEn(termId) : undefined;
  // Non-PII segmentation dimensions shared across every generation event so the
  // funnel/drop-off can be broken down by program and academic load.
  const segment = {
    programId: state.program?.slug ?? state.program?.url ?? undefined,
    completedCount: state.completedCourses.length,
    requirementCount: state.remainingRequirements.length,
    optimizations: state.optimizationPriorities.filter((p) => p.enabled).map((p) => p.kind),
  };
  const startedAt = nowMs();
  analytics.capture("schedule_generate_started", { termId, termName, mode, ...segment });

  try {
    const result = await runScheduleGenerationInternal(state, mode);
    const durationMs = Math.round(nowMs() - startedAt);
    if (result?.currentSchedule) {
      analytics.capture("schedule_generated", {
        resultCount: 1,
        durationMs,
        termId,
        termName,
        ...segment,
      });
    } else if (result?.generationError) {
      analytics.capture("schedule_generate_empty", {
        termId,
        termName,
        reason: generationErrorReason(result),
        ...segment,
      });
    } else {
      analytics.capture("schedule_generate_failed", {
        termId,
        termName,
        reason: "cancelled",
        ...segment,
      });
    }
    return result;
  } catch (err) {
    analytics.capture("schedule_generate_failed", {
      termId,
      termName,
      reason: "error",
      ...segment,
    });
    throw err;
  }
}

async function runScheduleGenerationInternal(
  state: AppState,
  mode: GenerateSchedulesMode,
): Promise<GenerateSchedulesResult | null> {
  const input = inputFromState(state, mode);
  const dataKey = dataKeyFromState(state);

  if (isWorkerAvailable() && dataKey) {
    try {
      return await withGenerationTimeout(
        getRemote().generateSchedules(dataKey, input),
        SCHEDULE_GENERATION_TIMEOUT_MS,
      );
    } catch (err) {
      if (err instanceof ScheduleGenerationCancelledError) {
        // The user changed a generation option mid-run; abandon this stale
        // computation. Kill the worker (the comlink call can't be aborted) and
        // pre-warm a fresh one. Return null so the caller applies nothing and
        // simply resolves its loading state, leaving the previous schedule and
        // the now-dirty options in place for a manual re-run.
        terminateScheduleWorker();
        void prewarmScheduleWorker(state);
        return null;
      }
      if (err instanceof ScheduleGenerationTimeoutError) {
        // The worker is stuck in a runaway generation; kill it so the hung
        // computation is abandoned, then respawn a clean one for next time.
        // oxlint-disable-next-line no-console -- intentional schedule worker timeout logging
        console.error("[scheduleWorker] generation timed out, terminating worker", err);
        terminateScheduleWorker();
        // Pre-warm a fresh worker in the background so the next run is ready.
        // Do NOT fall back to in-process generation: that would freeze the
        // main thread for the same runaway computation we just escaped.
        void prewarmScheduleWorker(state);
        // Return a structured error result (rather than null) so the caller
        // resolves its loading state and surfaces the timeout to the user,
        // instead of hanging forever on "Loading course data...".
        return timeoutGenerationResult();
      }
      // oxlint-disable-next-line no-console -- intentional schedule worker fallback logging
      console.error("[scheduleWorker] generation failed, falling back in-process", err);
      notifications.show({
        color: "yellow",
        title: tr(SCHEDULE_WORKER_FALLBACK_TITLE_ID),
        message: tr(SCHEDULE_WORKER_FALLBACK_MESSAGE_ID),
      });
      // fall through to the in-process path so the user still gets a result
    }
  }

  // Fallback: build the WASM engine on the main thread and run the action
  // in-process (SSR/tests, or when the worker is unavailable/failed). Prefer the
  // in-memory catalogue/schedules already in state (no asset refetch); fall back
  // to loading by data key when those aren't present.
  const { generateSchedulesAction } = await import("../lib/generateSchedulesAction");
  if (state.catalogue && state.schedulesData && state.cache) {
    const [{ getInMemoryEngine }, { getEffectiveCatalogue }] = await Promise.all([
      import("../lib/engine/engineHost"),
      import("@uoplan/store/slices/catalogueUtils"),
    ]);
    const effectiveCatalogue =
      getEffectiveCatalogue(state.catalogue, state.yearCatalogueCourses, state.completedCourses) ??
      state.catalogue;
    const engine = await getInMemoryEngine(effectiveCatalogue, state.schedulesData);
    if (!engine) return null;
    return generateSchedulesAction(input, state.cache, engine);
  }
  if (!dataKey) return null;
  const { getScheduleEngine } = await import("../lib/engine/engineHost");
  const { engine, cache } = await getScheduleEngine(dataKey);
  return generateSchedulesAction(input, cache, engine);
}

/** Pre-warm the worker's DataCache. Safe to call once after main-thread data loads. */
export async function prewarmScheduleWorker(state: AppState): Promise<void> {
  if (!isWorkerAvailable()) return;
  const dataKey = dataKeyFromState(state);
  if (!dataKey) return;
  try {
    await getRemote().loadData(dataKey);
  } catch (err) {
    // Worker prewarm is intentionally best-effort; generation can load data on demand.
    // oxlint-disable-next-line no-console -- intentional best-effort worker prewarm logging
    console.warn("[scheduleWorker] prewarm failed", err);
  }
}

/** Test-only: tear down the worker singleton. */
export function __resetScheduleWorkerClientForTests(): void {
  terminateScheduleWorker();
}
