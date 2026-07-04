import * as Comlink from "comlink";
import type { ScheduleWorkerApi } from "./scheduleWorkerApi";

/** True when a Web Worker can be spawned (browser only, not SSR/prerender/tests). */
export function isWorkerAvailable(): boolean {
  return typeof Worker !== "undefined" && typeof window !== "undefined";
}

export interface ScheduleWorkerHandle {
  /** Lazily spawn (once) and return the comlink-wrapped worker remote. */
  getRemote(): Comlink.Remote<ScheduleWorkerApi>;
  /** Terminate the current worker so a fresh one is spawned on the next call. */
  terminate(): void;
}

/**
 * Create an isolated handle around the shared `scheduleWorker` module. Each
 * handle owns a single lazily-spawned `Worker` instance so independent callers
 * (the calendar view vs. the degree planner) never contend with or cancel one
 * another's in-flight generation.
 */
export function createScheduleWorkerHandle(name: string): ScheduleWorkerHandle {
  let remote: Comlink.Remote<ScheduleWorkerApi> | null = null;
  let workerInstance: Worker | null = null;

  return {
    getRemote() {
      if (remote) return remote;
      workerInstance = new Worker(new URL("./scheduleWorker.ts", import.meta.url), {
        type: "module",
        name,
      });
      remote = Comlink.wrap<ScheduleWorkerApi>(workerInstance);
      return remote;
    },
    terminate() {
      if (workerInstance) workerInstance.terminate();
      workerInstance = null;
      remote = null;
    },
  };
}
