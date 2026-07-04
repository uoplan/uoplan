import type { CacheDataKey } from "../lib/dataCacheLoader";
import type { GenerateSchedulesInput } from "../lib/generateSchedulesInput";
import type { GenerateSchedulesResult } from "../lib/generateSchedulesAction";
import { createScheduleWorkerHandle, isWorkerAvailable } from "./scheduleWorkerRemote";

/**
 * Dedicated worker client for the degree-planner graph (beta). It spawns its
 * own instance of the shared `scheduleWorker` module so the planner's
 * sequential, multi-term generation never contends with (or cancels) the main
 * calendar view's in-flight run. The worker code is identical — only the engine
 * memoization cache is per-instance, which is fine: the planner generates a
 * handful of future terms one at a time.
 */

/**
 * Per-term hard cap. The planner runs terms sequentially and each call is an
 * ordinary generation, so we reuse the calendar's safety-net budget; the Rust
 * engine bounds its own work internally.
 */
const PLANNER_GENERATION_TIMEOUT_MS = 4_000;

class PlannerGenerationTimeoutError extends Error {
  constructor() {
    super("planner-generation-timeout");
    this.name = "PlannerGenerationTimeoutError";
  }
}

const workerHandle = createScheduleWorkerHandle("planner-worker");
const getRemote = () => workerHandle.getRemote();
const terminatePlannerWorker = () => workerHandle.terminate();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PlannerGenerationTimeoutError()), ms);
    void (async () => {
      try {
        const value = await promise;
        clearTimeout(timer);
        resolve(value);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    })();
  });
}

/**
 * Generate a single planner term. Uses the dedicated worker when available;
 * otherwise falls back to running the pure action in-process (SSR/tests). On
 * timeout the stuck worker is killed and `null` is returned so the caller can
 * mark the term as failed and continue.
 */
export async function generatePlannerTermViaWorker(
  dataKey: CacheDataKey,
  input: GenerateSchedulesInput,
): Promise<GenerateSchedulesResult | null> {
  if (isWorkerAvailable()) {
    try {
      return await withTimeout(
        getRemote().generateSchedules(dataKey, input),
        PLANNER_GENERATION_TIMEOUT_MS,
      );
    } catch (err) {
      if (err instanceof PlannerGenerationTimeoutError) {
        // oxlint-disable-next-line no-console -- intentional planner worker timeout logging
        console.error("[plannerWorker] term generation timed out, terminating worker", err);
        terminatePlannerWorker();
        return null;
      }
      // oxlint-disable-next-line no-console -- intentional planner worker fallback logging
      console.error("[plannerWorker] term generation failed, falling back in-process", err);
      // fall through to the in-process path
    }
  }

  const { generateSchedulesAction } = await import("../lib/generateSchedulesAction");
  const { getScheduleEngine } = await import("../lib/engine/engineHost");
  const { engine, cache } = await getScheduleEngine(dataKey);
  return generateSchedulesAction(input, cache, engine);
}
