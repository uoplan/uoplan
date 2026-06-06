import { initSync, Engine } from "@uoplan/engine";
import type {
  Catalogue as DomainCatalogue,
  SchedulesData as DomainSchedulesData,
} from "@uoplan/core";
import { toProtoCatalogue, toProtoSchedulesData, type ScheduleEngine } from "@uoplan/core";
import { Catalogue, SchedulesData } from "@uoplan/proto/data";

// @ts-ignore - wrangler handles .wasm imports as WebAssembly.Module
import engineWasm from "@uoplan/engine/engine.wasm";

let wasmInitialized = false;

function ensureWasm() {
  if (wasmInitialized) return;
  initSync({ module: engineWasm as WebAssembly.Module });
  wasmInitialized = true;
}

/**
 * Builds the shared Rust/WASM schedule {@link ScheduleEngine} from the worker's
 * decoded catalogue + schedules. The engine owns all schedule generation; the
 * OG-image worker only renders the resulting schedule. Mirrors the resvg WASM
 * init pattern (`initSync` with a wrangler-provided `WebAssembly.Module`).
 */
export function buildEngine(
  catalogue: DomainCatalogue,
  schedulesData: DomainSchedulesData,
): ScheduleEngine {
  ensureWasm();
  const catalogueBytes = Catalogue.encode(toProtoCatalogue(catalogue)).finish();
  const schedulesBytes = SchedulesData.encode(toProtoSchedulesData(schedulesData)).finish();
  return new Engine(catalogueBytes, schedulesBytes) as unknown as ScheduleEngine;
}
