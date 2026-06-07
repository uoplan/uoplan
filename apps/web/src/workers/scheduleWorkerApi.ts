import type { CacheDataKey } from "../lib/dataCacheLoader";
import type { GenerateSchedulesInput } from "../lib/generateSchedulesInput";
import type { GenerateSchedulesResult } from "../lib/generateSchedulesAction";

/**
 * Typed RPC surface exposed by the schedule worker. Both the worker entry
 * (`scheduleWorker.ts`) and the main-thread client (`scheduleWorkerClient.ts`)
 * import this type so any signature drift is caught at compile time on both
 * sides.
 */
export interface ScheduleWorkerApi {
  /**
   * Pre-warm the worker's internal DataCache for the given key. Optional —
   * `generateSchedules` will load the cache lazily on first call. Call this
   * eagerly after the main thread finishes its own data load to hide the
   * worker's first-call latency.
   */
  loadData(dataKey: CacheDataKey): Promise<void>;

  /**
   * Run schedule generation in the worker. The `dataKey` tells the worker
   * which DataCache to use (it builds/memoizes internally); the `input` is
   * the serializable subset of AppState the generator reads.
   */
  generateSchedules(
    dataKey: CacheDataKey,
    input: GenerateSchedulesInput,
  ): Promise<GenerateSchedulesResult | null>;
}
