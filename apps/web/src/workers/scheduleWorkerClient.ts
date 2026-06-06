import * as Comlink from "comlink";
import { notifications } from "@mantine/notifications";
import type { AppState } from "../store/types";
import type { CacheDataKey } from "../lib/dataCacheLoader";
import {
  pickGenerateSchedulesInput,
  type GenerateSchedulesInput,
  type GenerateSchedulesMode,
  type GenerateSchedulesResult,
} from "../lib/generateSchedulesAction";
import { tr } from "../i18n";
import type { ScheduleWorkerApi } from "./scheduleWorkerApi";

const SCHEDULE_WORKER_FALLBACK_TITLE_ID = "notifications.scheduleWorkerFallback.title";
const SCHEDULE_WORKER_FALLBACK_MESSAGE_ID = "notifications.scheduleWorkerFallback.message";

/** Hard cap on a single schedule-generation run; the worker is killed past this. */
const SCHEDULE_GENERATION_TIMEOUT_MS = 10_000;

/** Sentinel error thrown when generation exceeds {@link SCHEDULE_GENERATION_TIMEOUT_MS}. */
class ScheduleGenerationTimeoutError extends Error {
  constructor() {
    super("schedule-generation-timeout");
    this.name = "ScheduleGenerationTimeoutError";
  }
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
function isWorkerAvailable(): boolean {
  return typeof Worker !== "undefined" && typeof window !== "undefined";
}

let remote: Comlink.Remote<ScheduleWorkerApi> | null = null;
let workerInstance: Worker | null = null;

function getRemote(): Comlink.Remote<ScheduleWorkerApi> {
  if (remote) return remote;
  workerInstance = new Worker(new URL("./scheduleWorker.ts", import.meta.url), {
    type: "module",
    name: "schedule-worker",
  });
  remote = Comlink.wrap<ScheduleWorkerApi>(workerInstance);
  return remote;
}

/** Terminate the current worker so a fresh one is spawned on the next call. */
function terminateScheduleWorker(): void {
  if (workerInstance) workerInstance.terminate();
  workerInstance = null;
  remote = null;
}

/**
 * Race a worker call against a timeout. On timeout the returned promise rejects
 * with a {@link ScheduleGenerationTimeoutError}; the caller is responsible for
 * tearing down the (now-unresponsive) worker.
 */
function withGenerationTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ScheduleGenerationTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Compute the {@link CacheDataKey} for the current AppState. We need a
 * `termId` and the completed-course list (OPT subset matters); `firstYear`
 * picks the year-catalogue merge.
 */
export function dataKeyFromState(state: AppState): CacheDataKey | null {
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
export function inputFromState(
  state: AppState,
  mode: GenerateSchedulesMode,
): GenerateSchedulesInput {
  return pickGenerateSchedulesInput(state, mode);
}

/**
 * Run schedule generation. Uses the worker when available; otherwise falls
 * back to running the pure action in-process (SSR/tests).
 */
export async function runScheduleGeneration(
  state: AppState,
  mode: GenerateSchedulesMode,
): Promise<GenerateSchedulesResult | null> {
  const input = inputFromState(state, mode);

  if (isWorkerAvailable()) {
    const dataKey = dataKeyFromState(state);
    if (dataKey) {
      try {
        return await withGenerationTimeout(
          getRemote().generateSchedules(dataKey, input),
          SCHEDULE_GENERATION_TIMEOUT_MS,
        );
      } catch (err) {
        if (err instanceof ScheduleGenerationTimeoutError) {
          // The worker is stuck in a runaway generation; kill it so the hung
          // computation is abandoned, then respawn a clean one for next time.
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
        console.error("[scheduleWorker] generation failed, falling back in-process", err);
        notifications.show({
          color: "yellow",
          title: tr(SCHEDULE_WORKER_FALLBACK_TITLE_ID),
          message: tr(SCHEDULE_WORKER_FALLBACK_MESSAGE_ID),
        });
        // fall through to the in-process path so the user still gets a result
      }
    }
  }

  // Fallback: load the action and run it on the main thread using the
  // already-built DataCache from state.
  if (!state.cache) return null;
  const { generateSchedulesAction } = await import("../lib/generateSchedulesAction");
  return generateSchedulesAction(input, state.cache);
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
    console.warn("[scheduleWorker] prewarm failed", err);
  }
}

/** Test-only: tear down the worker singleton. */
export function __resetScheduleWorkerClientForTests(): void {
  if (workerInstance) workerInstance.terminate();
  workerInstance = null;
  remote = null;
}
