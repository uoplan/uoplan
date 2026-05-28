import * as Comlink from "comlink";
import { loadEffectiveCacheFromAssets, type CacheDataKey } from "../lib/dataCacheLoader";
import {
  generateSchedulesAction,
  type GenerateSchedulesInput,
  type GenerateSchedulesResult,
} from "../lib/generateSchedulesAction";
import type { ScheduleWorkerApi } from "./scheduleWorkerApi";

const api: ScheduleWorkerApi = {
  async loadData(dataKey: CacheDataKey): Promise<void> {
    await loadEffectiveCacheFromAssets(dataKey);
  },

  async generateSchedules(
    dataKey: CacheDataKey,
    input: GenerateSchedulesInput,
  ): Promise<GenerateSchedulesResult | null> {
    const cache = await loadEffectiveCacheFromAssets(dataKey);
    return generateSchedulesAction(input, cache);
  },
};

Comlink.expose(api);
