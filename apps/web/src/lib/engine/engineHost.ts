import initWasm, { initSync, Engine } from "@uoplan/engine";
// Vite resolves the package's "./wasm" export to the compiled module and `?url`
// yields its asset URL, which the wasm-bindgen `web` glue fetches + instantiates.
import wasmUrl from "@uoplan/engine/wasm?url";
import { Catalogue, SchedulesData } from "@uoplan/proto/data";
import {
  type Catalogue as DomainCatalogue,
  type DataCache,
  type SchedulesData as DomainSchedulesData,
  type ScheduleEngine,
  normalizeCourseCode,
  toProtoCatalogue,
  toProtoSchedulesData,
} from "@uoplan/core";
import type { CacheDataKey } from "@uoplan/data";
import { dataClient } from "../dataClient";

let initPromise: Promise<void> | null = null;
let wasmReady = false;

function ensureWasm(): Promise<void> {
  if (wasmReady) return Promise.resolve();
  if (!initPromise) {
    initPromise = initWasm({ module_or_path: wasmUrl })
      .then(() => {
        wasmReady = true;
      })
      .catch((err) => {
        // Allow a later call to retry rather than caching the rejected promise.
        initPromise = null;
        throw err;
      });
  }
  return initPromise;
}

/**
 * Synchronously initializes the engine WASM from an already-compiled
 * {@link WebAssembly.Module}. Used by the Node test harness (which cannot fetch
 * the `?url` asset) to make {@link getEngineSync} usable without async init.
 */
export function initEngineWasmFromModule(module: WebAssembly.Module): void {
  if (wasmReady) return;
  initSync({ module });
  wasmReady = true;
}

function buildEngine(
  catalogue: DomainCatalogue,
  schedulesData: DomainSchedulesData,
): ScheduleEngine {
  const catalogueBytes = Catalogue.encode(toProtoCatalogue(catalogue)).finish();
  const schedulesBytes = SchedulesData.encode(toProtoSchedulesData(schedulesData)).finish();
  return new Engine(catalogueBytes, schedulesBytes) as unknown as ScheduleEngine;
}

function datasetKey(dataKey: CacheDataKey): string {
  const completed = [...dataKey.completedCourses].map(normalizeCourseCode).sort().join(",");
  return `${dataKey.termId}|${dataKey.firstYear ?? "-"}|${completed}`;
}

interface EngineEntry {
  engine: ScheduleEngine;
  cache: DataCache;
}

const engineMemo = new Map<string, EngineEntry>();
const engineBuilding = new Map<string, Promise<EngineEntry>>();
const ENGINE_CACHE_SIZE = 4;

/**
 * Loads (and memoizes) a WASM {@link Engine} built from the merged catalogue +
 * schedules for a data key, re-encoding the domain objects back into the
 * `data.proto` bytes the engine decodes. Returns the engine plus the matching
 * {@link DataCache} used to map responses back into enrollments.
 */
export async function getScheduleEngine(dataKey: CacheDataKey): Promise<EngineEntry> {
  const key = datasetKey(dataKey);
  const hit = engineMemo.get(key);
  if (hit) {
    engineMemo.delete(key);
    engineMemo.set(key, hit);
    return hit;
  }

  // Coalesce concurrent builds for the same key so we don't construct (and then
  // leak) duplicate engines when prewarm and generation race.
  const inFlight = engineBuilding.get(key);
  if (inFlight) return inFlight;

  const building = (async (): Promise<EngineEntry> => {
    await ensureWasm();
    const { cache, catalogue, schedulesData } = await dataClient.loadEffectiveDataset(dataKey);
    const engine = buildEngine(catalogue, schedulesData);
    const entry: EngineEntry = { engine, cache };
    engineMemo.set(key, entry);
    while (engineMemo.size > ENGINE_CACHE_SIZE) {
      const oldest = engineMemo.keys().next().value;
      if (oldest === undefined) break;
      const evicted = engineMemo.get(oldest);
      engineMemo.delete(oldest);
      // Free the WASM-side allocation for evicted engines.
      (evicted?.engine as unknown as { free?: () => void } | undefined)?.free?.();
    }
    return entry;
  })();

  engineBuilding.set(key, building);
  try {
    return await building;
  } finally {
    engineBuilding.delete(key);
  }
}

interface SyncEngineEntry {
  catalogue: DomainCatalogue;
  schedulesData: DomainSchedulesData;
  engine: ScheduleEngine;
}

let syncEntry: SyncEngineEntry | null = null;

/**
 * Synchronously builds (and identity-memoizes) a WASM {@link Engine} for the
 * given domain catalogue + schedules. Returns `null` when the WASM module has
 * not finished initializing yet (callers should have prewarmed via
 * {@link getScheduleEngine} on data load); a background init is kicked off so a
 * subsequent call succeeds. Used by synchronous store swap paths.
 */
export function getEngineSync(
  catalogue: DomainCatalogue,
  schedulesData: DomainSchedulesData,
): ScheduleEngine | null {
  if (!wasmReady) {
    void ensureWasm();
    return null;
  }
  if (syncEntry && syncEntry.catalogue === catalogue && syncEntry.schedulesData === schedulesData) {
    return syncEntry.engine;
  }
  if (syncEntry) {
    (syncEntry.engine as unknown as { free?: () => void }).free?.();
  }
  const engine = buildEngine(catalogue, schedulesData);
  syncEntry = { catalogue, schedulesData, engine };
  return engine;
}

/**
 * Async variant of {@link getEngineSync}: ensures the WASM module is initialized
 * (awaiting the fetch-based init when needed), then builds/memoizes an engine
 * from in-memory domain data. Used by the main-thread generation fallback (no
 * worker / tests), where the data already lives in the store rather than being
 * loaded by data key.
 */
export async function getInMemoryEngine(
  catalogue: DomainCatalogue,
  schedulesData: DomainSchedulesData,
): Promise<ScheduleEngine | null> {
  await ensureWasm();
  return getEngineSync(catalogue, schedulesData);
}
