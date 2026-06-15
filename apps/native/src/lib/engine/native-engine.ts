import { getUoplanEngineModule } from "../../../modules/uoplan-engine";
import type { EngineBridge } from "@/lib/generate-schedule";

/**
 * {@link EngineBridge} backed by the native Rust engine
 * (`UoplanEngine.xcframework`). Generation runs off the JS thread in native code;
 * the dataset (catalogue + schedules) is decoded once per term and reused. This
 * is the native analogue of the web app's in-process WASM engine — the exact same
 * Rust crate — so generated timetables are identical across platforms.
 */
class NativeEngineController implements EngineBridge {
  private loadedKey: string | null = null;

  async loadDataset(
    datasetKey: string,
    catalogue: Uint8Array,
    schedules: Uint8Array,
  ): Promise<void> {
    // The native side memoises by key too, but skip re-sending the ~2.6 MB
    // catalogue across the bridge when the term hasn't changed.
    if (this.loadedKey === datasetKey) return;
    const mod = requireModule();
    await mod.loadDataset(datasetKey, catalogue, schedules);
    this.loadedKey = datasetKey;
  }

  async generate(request: Uint8Array): Promise<Uint8Array> {
    return requireModule().generate(request);
  }
}

function requireModule() {
  const mod = getUoplanEngineModule();
  if (!mod) {
    throw new Error("uoplan schedule engine native module is unavailable");
  }
  return mod;
}

/** Whether the native engine binding is linked in this build. */
export function isEngineAvailable(): boolean {
  return getUoplanEngineModule() !== null;
}

/** Singleton engine bridge passed to {@link generateScheduleVariants}. */
export const engineController: EngineBridge = new NativeEngineController();
