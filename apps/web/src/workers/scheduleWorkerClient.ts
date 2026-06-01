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
        return await getRemote().generateSchedules(dataKey, input);
      } catch (err) {
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
