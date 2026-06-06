/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initEngineWasmFromModule } from "../lib/engine/engineHost";

// The Node test environment can't fetch the `?url` wasm asset the browser glue
// uses, so eagerly compile + sync-init the engine WASM from the built package so
// generation/swap code paths work in unit tests.
const wasmPath = fileURLToPath(
  new URL("../../../../packages/engine/pkg/uoplan_engine_bg.wasm", import.meta.url),
);
const bytes = readFileSync(wasmPath);
const ModuleCtor = WebAssembly.Module as unknown as new (b: Uint8Array) => WebAssembly.Module;
initEngineWasmFromModule(new ModuleCtor(bytes));
