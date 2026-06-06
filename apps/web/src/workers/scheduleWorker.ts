import * as Comlink from "comlink";
import { type CacheDataKey } from "../lib/dataCacheLoader";
import {
  generateSchedulesAction,
  type GenerateSchedulesInput,
  type GenerateSchedulesResult,
} from "../lib/generateSchedulesAction";
import { getScheduleEngine } from "../lib/engine/engineHost";
import type { ScheduleWorkerApi } from "./scheduleWorkerApi";

const api: ScheduleWorkerApi = {
  async loadData(dataKey: CacheDataKey): Promise<void> {
    await getScheduleEngine(dataKey);
  },

  async generateSchedules(
    dataKey: CacheDataKey,
    input: GenerateSchedulesInput,
  ): Promise<GenerateSchedulesResult | null> {
    const { engine, cache } = await getScheduleEngine(dataKey);
    return generateSchedulesAction(input, cache, engine);
  },
};

Comlink.expose(api);
